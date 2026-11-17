import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { SUNLAND, SUNLAND_BUILDINGS, SUNLAND_LANDMARKS, ECHO_VIADUCT_DECK } from './sunland-art.js';

const METRE = HERO_HEIGHT / 1.85;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export const UNDERPASS_WEST = 36120;
export const UNDERPASS_EAST = 41040;
export const AIRPORT_GATES = [36490, 40880];
export const inAirport = x => x >= AIRPORT_GATES[0] && x <= AIRPORT_GATES[1];

const VEHICLES = [
  { kind: 'sedan', length: 4.5 * METRE, height: 1.45 * METRE, weight: 4 },
  { kind: 'hatch', length: 3.9 * METRE, height: 1.5 * METRE, weight: 3 },
  { kind: 'taxi', length: 4.5 * METRE, height: 1.45 * METRE, weight: 3 },
  { kind: 'pickup', length: 5.2 * METRE, height: 1.8 * METRE, weight: 2 },
  { kind: 'jeep', length: 4.2 * METRE, height: 1.75 * METRE, weight: 3 },
  { kind: 'bus', length: 11 * METRE, height: 3.1 * METRE, weight: 1 },
];

const AIRPORT_VEHICLES = [
  { kind: 'airtug', length: 4.0 * METRE, height: 1.5 * METRE, weight: 4 },
  { kind: 'baggagetug', length: 8.5 * METRE, height: 1.6 * METRE, weight: 3 },
  { kind: 'followme', length: 4.4 * METRE, height: 1.6 * METRE, weight: 2 },
  { kind: 'airportsecurity', length: 4.8 * METRE, height: 1.8 * METRE, weight: 3 },
  { kind: 'airfire', length: 8.5 * METRE, height: 2.8 * METRE, weight: 4 },
];
const AIRPORT_KINDS = new Set(AIRPORT_VEHICLES.map(v => v.kind));
const AIRPORT_SPANS = [[AIRPORT_GATES[0] - 80, AIRPORT_GATES[1] + 80]];

const CRUISE = [7 * METRE, 11 * METRE];
const PAINT = [0xe2dcd0, 0xd4b882, 0xa85438, 0x4a7888, 0x5a6450, 0x242830];
const MIL_GREEN = 0x4a5640;
const MIL_DARK = 0x283226;

const HOTSPOTS = {
  'redrock-citadel': [6, 60],
  'temple-of-the-sun': [8, 80, () => ({ shirt: 0xf5f3ed, pants: 0xd5d0c2, calm: true })],
  'hanging-gardens': [14, 90, () => ({ shirt: 0x5cb24a, calm: true })],
  'golden-pyramid': [7, 75, () => ({ shirt: 0xd4b282, hat: 'wrap', calm: true })],
  'suncity-transit-hub': [8, 70, i => ({ suitcase: i % 2 === 0, shirt: 0x3a6080 })],
  'airport-gate-west': [4, 35, () => ({ shirt: 0x141e2c, pants: 0x101824, cap: 'peaked', badge: true, calm: true })],
  'suncity-air-cargo': [5, 50, () => ({ shirt: 0xffaa00, pants: 0x222226, helmet: true, vest: true })],
  'airport-terminal': [14, 100, i => ({ suitcase: i % 2 === 0, shirt: 0x4a78a6 })],
  'airport-tower': [4, 30, () => ({ shirt: 0x334455, calm: true })],
  'airport-hangar': [6, 45, () => ({ shirt: 0xff6600, pants: 0x242428, vest: true, helmet: true })],
  'airport-cargo-depot': [5, 45, () => ({ shirt: 0xffaa00, pants: 0x222226, vest: true, helmet: true })],
  'airport-fire-station': [5, 40, () => ({ shirt: 0xee3322, pants: 0x222222, helmet: true })],
  'airport-heliport-terminal': [4, 35, () => ({ shirt: 0xffffff, epaulets: true, hat: 'pilot', suitcase: true })],
  'airport-gate-east': [4, 35, () => ({ shirt: 0x141e2c, pants: 0x101824, cap: 'peaked', badge: true, calm: true })],
  'savanna-wind-turbine-1': [3, 30, () => ({ shirt: 0xdd7722, helmet: true })],
  'savanna-homestead': [5, 50, () => ({ shirt: 0x4a7c59, pants: 0x3d3024, hat: 'straw' })],
  'savanna-wildlife-station': [4, 40, () => ({ shirt: 0xc8b88a, pants: 0x4a3c28, cap: 'safari' })],
  'savanna-grain-mill': [5, 45, () => ({ shirt: 0x8a7050, pants: 0x2e241c })],
  'longfield-town-hall': [7, 60, () => ({ shirt: 0x3d5a80, pants: 0x293241, calm: true })],
  'longfield-trading-post': [6, 50, () => ({ shirt: 0xb5651d, pants: 0x3d2b1f })],
  'savanna-artisan-barn': [5, 45, () => ({ shirt: 0x7a3020, pants: 0x222226, apron: true })],
  'longfield-chapel': [6, 45, () => ({ shirt: 0xd4c2a2, pants: 0x3a3024, calm: true })],
  'savanna-radio-mast': [2, 25, () => ({ shirt: 0x4a5560 })],
  'echo-canyon-viaduct': [6, 80, () => ({ calm: true, shirt: 0xd4a872 })],
};

const STOPS = [36320, 37600, 41400];

export class SunlandLife extends AreaLife {
  constructor(random = Math.random, weather = null) {
    super(random, {
      area: SUNLAND,
      landmarks: SUNLAND_LANDMARKS,
      hotspots: HOTSPOTS,
      stops: STOPS,
      ends: [SUNLAND.from, SUNLAND.to],
      weather,
      weatherEdge: 1200,
      walkerSpacing: 140,
      carSpacing: 340,
      seed: 880,
    });
    this.doors = SUNLAND_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: (hash(b.x) * 6) + 2, id: b.id }));
    this.bridgeDecks = [ECHO_VIADUCT_DECK];
    this.bridges = this.bridgeDecks.map(deck => [deck.from, deck.to]);
    // Underpasses divert civilian road traffic below the airport complex
    this.underpasses = [
      { x: UNDERPASS_WEST, dir: 1 },
      { x: UNDERPASS_EAST, dir: -1 },
    ];
    // Public road spans terminate at the underpasses so surface stays free of civilian traffic
    this.roadSpans = [
      [SUNLAND.from, UNDERPASS_WEST + 20],
      [UNDERPASS_EAST - 20, SUNLAND.to],
    ];
    // Restrict walking pedestrians to populated cities, towns, and designated districts in Sunland
    this.walkSpans = [
      [31200, 32700], // Redrock Pueblo Village & Golden Pyramid
      [32800, 35000], // Echo Canyon Settlement, Hanging Gardens & Sun Temple
      [36350, 40950], // Sun City International Airport Complex
      [41400, 42600], // Long Plains Ranches & Longfield Savanna Village
    ];
  }

  walkBounds(person) {
    if (this.walkSpans && person) {
      for (const [from, to] of this.walkSpans) {
        if (person.x >= from && person.x <= to) {
          return [from + 20, to - 20];
        }
      }
    }
    const from = this.area?.from ?? SUNLAND.from;
    const to = this.area?.to ?? SUNLAND.to;
    return [from + 20, to - 20];
  }

  person(x, r = this.random()) {
    const p = super.person(x, r);
    // Airport Personnel inside the Airport Complex (36490 - 40880)
    if (inAirport(x)) {
      const roll = hash(x * 0.083 + r * 17.1);
      if (roll < 0.3) {
        // Airport Security Officer on Patrol
        return Object.assign(p, {
          shirt: 0x141e2c,
          pants: 0x101824,
          cap: 'peaked',
          badge: true,
          calm: true,
          routine: 'stroll',
          patrol: true,
        });
      } else if (roll < 0.55) {
        // Ramp Agent / Ground Handling Crew in Hi-Vis Vest
        return Object.assign(p, {
          shirt: 0xff6600,
          pants: 0x222226,
          vest: true,
          earDefenders: true,
          helmet: true,
          calm: true,
          routine: 'stroll',
        });
      } else if (roll < 0.75) {
        // Airline Captain / Pilot
        return Object.assign(p, {
          shirt: 0xffffff,
          pants: 0x142030,
          epaulets: true,
          suitcase: true,
          calm: true,
          routine: 'commute',
          target: 37600,
        });
      } else if (roll < 0.88) {
        // Flight Attendant / Cabin Crew
        return Object.assign(p, {
          shirt: 0x1a385c,
          pants: 0x1a385c,
          suitcase: true,
          calm: true,
          routine: 'commute',
          target: 37600,
        });
      } else {
        // Air Traveler / Commuter with luggage
        return Object.assign(p, {
          shirt: 0x4a78a6,
          pants: 0x334455,
          suitcase: true,
          calm: true,
          routine: 'commute',
          target: 37600,
        });
      }
    }

    if (!this.doors) return p;
    // Assign purposeful daily routine & destinations
    const roll = hash(x * 0.071 + r * 13.7);
    if (roll < 0.4) {
      // Shopper/visitor walking to enter a nearby building
      const bounds = this.walkBounds(p);
      const candidates = this.doors.filter(d => d.x >= bounds[0] && d.x <= bounds[1] && Math.abs(d.x - x) > 20 && Math.abs(d.x - x) < 700);
      if (candidates.length) {
        const door = candidates[Math.floor(hash(x * 0.033) * candidates.length)];
        p.routine = 'visit';
        p.targetDoor = door;
        p.target = door.x;
        p.dir = Math.sign(door.x - x) || p.dir;
      } else {
        p.routine = 'stroll';
      }
    } else if (roll < 0.65) {
      // Commuter heading toward a transit stop, airport terminal, or landmark
      const bounds = this.walkBounds(p);
      const candidates = (this.stops ?? []).filter(s => s.x >= bounds[0] && s.x <= bounds[1]);
      if (candidates.length) {
        const stop = candidates[Math.floor(hash(x * 0.051) * candidates.length)];
        p.routine = 'commute';
        p.target = stop.x;
        p.dir = Math.sign(stop.x - x) || p.dir;
      } else {
        p.routine = 'stroll';
      }
    } else if (roll < 0.85) {
      p.routine = 'socialize';
      p.socialTimer = 3 + hash(r * 19) * 6;
    } else {
      p.routine = 'stroll';
    }
    return p;
  }

  stepPerson(person, dt, hero) {
    // Stepping toward purposeful destinations
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
        // Pause to chat outside with nearby pedestrian
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

  stepTraffic(dt, hero) {
    super.stepTraffic(dt, hero);
    // Guarantee no civilian cars drive through the airport on the surface
    this.cars = this.cars.filter(car => AIRPORT_KINDS.has(car.kind) || car.dispatch !== undefined || car.wreck || car.fall
      || car.held || car.hurt !== undefined || !inAirport(car.x));
  }

  carEnd(car, dir) {
    if (AIRPORT_KINDS.has(car.kind)) {
      const spans = this.roadSpans;
      this.roadSpans = AIRPORT_SPANS;
      const end = super.carEnd(car, dir);
      this.roadSpans = spans;
      return end;
    }
    return super.carEnd(car, dir);
  }

  car(x, lane) {
    const fromTunnel = Math.abs(x - UNDERPASS_WEST) < 2 || Math.abs(x - UNDERPASS_EAST) < 2;
    const airport = !fromTunnel && (inAirport(x) || (x >= AIRPORT_GATES[0] - 80 && x <= AIRPORT_GATES[1] + 80));
    const type = this.pickVehicle(airport ? AIRPORT_VEHICLES : VEHICLES);
    const cruise = CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0]);
    const kind = type.kind;
    const paint = airport ? (type.kind === 'followme' ? 0xffcc00 : type.kind === 'airportsecurity' ? 0x1e3a5f : type.kind === 'airfire' ? 0xee2222 : 0xffdd22) : PAINT[Math.floor(this.random() * PAINT.length)];
    return {
      x,
      lane,
      ...type,
      kind,
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
    if (car.kind === 'airtug') this.drawAirTug(g, car, groundAt);
    else if (car.kind === 'baggagetug') this.drawBaggageTug(g, car, groundAt);
    else if (car.kind === 'followme') this.drawFollowMe(g, car, groundAt);
    else if (car.kind === 'airportsecurity') this.drawAirportSecurity(g, car, groundAt);
    else if (car.kind === 'airfire') this.drawAirFire(g, car, groundAt);
    else if (car.kind === 'jeep') this.drawJeep(g, car, groundAt);
    else super.drawVehicle(g, car, groundAt);
  }

  drawAirTug(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 4;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const belt = sill - 5;
    // Low heavy industrial chassis in airport yellow
    g.fillStyle(0xffcc00);
    g.fillRect(c.left, belt, c.length, sill - belt);
    // Heavy counterweight bumpers front and back
    g.fillStyle(0x222222);
    g.fillRect(c.left, sill - 3, 4, 4);
    g.fillRect(c.left + c.length - 4, sill - 3, 4, 4);
    // Open low cab with steel roll cage
    const cabX = c.dir > 0 ? c.left + c.length * 0.35 : c.left + c.length * 0.15;
    const cabW = c.length * 0.5;
    g.fillStyle(0x333840);
    g.fillRect(Math.round(cabX), roof, Math.round(cabW), belt - roof);
    g.fillStyle(0x99ccff, 0.7);
    g.fillRect(Math.round(cabX) + 2, roof + 2, Math.round(cabW) - 4, belt - roof - 3);
    // Flashing amber roof beacon
    const flash = Math.sin(this.clock * 8) > 0;
    g.fillStyle(flash ? 0xffaa00 : 0x664400);
    g.fillCircle(Math.round(cabX + cabW / 2), roof - 2, 2);
    // Driver in safety vest
    g.fillStyle(0xff7700);
    g.fillRect(Math.round(cabX + cabW * 0.4), roof + 4, 4, 5);
    this.lights(g, car, c, belt + 1);
    this.wheels(g, c, [0.22, 0.78], wheel);
    g.restore();
  }

  drawBaggageTug(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const belt = sill - 4;
    // Front tractor unit (first 35% of length)
    const front = c.dir > 0 ? c.left + c.length * 0.65 : c.left;
    const frontW = c.length * 0.35;
    g.fillStyle(0xffdd22);
    g.fillRect(Math.round(front), belt, Math.round(frontW), sill - belt);
    // Tractor steering column & driver in hi-vis orange
    const drX = c.dir > 0 ? front + frontW * 0.4 : front + frontW * 0.2;
    g.fillStyle(0x222222);
    g.fillRect(Math.round(drX), roof + 3, 2, belt - roof - 3);
    g.fillStyle(0xff7700);
    g.fillRect(Math.round(drX) - 2, roof + 2, 5, 5);
    // Rooftop beacon on tractor
    g.fillStyle(0xff9900);
    g.fillCircle(Math.round(drX), roof, 1.8);
    // Hitch bars and 2 baggage dollies
    const d1X = c.dir > 0 ? c.left + c.length * 0.32 : c.left + c.length * 0.4;
    const d2X = c.dir > 0 ? c.left : c.left + c.length * 0.72;
    const dW = c.length * 0.28;
    for (const dx of [d1X, d2X]) {
      // Dolly silver steel platform
      g.fillStyle(0x606870);
      g.fillRect(Math.round(dx), sill - 3, Math.round(dW), 3);
      // Colorful stacked suitcases
      g.fillStyle(0x2255aa);
      g.fillRect(Math.round(dx) + 2, sill - 9, Math.round(dW * 0.45), 6);
      g.fillStyle(0xaa2222);
      g.fillRect(Math.round(dx) + Math.round(dW * 0.45) + 3, sill - 8, Math.round(dW * 0.45), 5);
      g.fillStyle(0x228833);
      g.fillRect(Math.round(dx) + 4, sill - 14, Math.round(dW * 0.5), 5);
      // Dolly canopy frame
      g.fillStyle(0x3a424a);
      g.fillRect(Math.round(dx), sill - 15, Math.round(dW), 1.5);
      g.fillRect(Math.round(dx), sill - 15, 1.5, 12);
      g.fillRect(Math.round(dx + dW - 1.5), sill - 15, 1.5, 12);
    }
    // Tow link bar
    g.fillStyle(0x111111);
    g.fillRect(c.left + 2, sill - 2, c.length - 4, 1.5);
    this.lights(g, car, c, belt + 1);
    this.wheels(g, c, [0.12, 0.28, 0.46, 0.62, 0.82], wheel);
    g.restore();
  }

  drawFollowMe(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const belt = sill - 5;
    // Yellow body with black checkerboard pattern
    g.fillStyle(0xffcc00);
    g.fillRect(c.left, belt, c.length, sill - belt);
    // Checkerboard pattern
    g.fillStyle(0x111111);
    for (let cx = c.left + 2; cx < c.left + c.length - 4; cx += 6) {
      g.fillRect(cx, belt + 1, 3, 2);
      g.fillRect(cx + 3, belt + 3, 3, 2);
    }
    // Cabin
    const [ca, cb] = [c.front(0.18), c.front(0.72)].sort((a, b) => a - b);
    g.fillStyle(0xffcc00);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), belt - roof);
    g.fillStyle(0x99ccff, 0.7);
    g.fillRect(Math.round(ca) + 2, roof + 2, Math.round(cb - ca) - 4, belt - roof - 3);
    // Roof lightbar (flashing amber LEDs)
    const flash = Math.sin(this.clock * 10) > 0;
    g.fillStyle(0x222222);
    g.fillRect(Math.round(ca) + 3, roof - 3, Math.round(cb - ca) - 6, 2);
    g.fillStyle(flash ? 0xffaa00 : 0xffdd22);
    g.fillRect(Math.round(ca) + 4, roof - 4, Math.round(cb - ca) - 8, 2);
    // High-mounted rear "FOLLOW ME" digital LED sign
    const signX = c.dir > 0 ? c.left - 2 : c.left + c.length - 12;
    g.fillStyle(0x111111);
    g.fillRect(Math.round(signX), roof + 1, 14, 6);
    g.fillStyle(0xffcc00);
    g.fillRect(Math.round(signX) + 1, roof + 2, 12, 4);
    this.lights(g, car, c, belt + 1);
    this.wheels(g, c, [0.2, 0.8], wheel);
    g.restore();
  }

  drawAirportSecurity(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3.5;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const belt = sill - 6;
    // Crisp white SUV body with navy bottom stripe
    g.fillStyle(0xf0f4f8);
    g.fillRect(c.left, belt, c.length, sill - belt);
    g.fillStyle(0x1a2e4a);
    g.fillRect(c.left, sill - 3, c.length, 3);
    // Gold security star emblem on door
    g.fillStyle(0xffd700);
    g.fillCircle(c.left + c.length * 0.45, belt + 3, 2);
    // Cabin with tinted glass
    const [ca, cb] = [c.front(0.16), c.front(0.74)].sort((a, b) => a - b);
    g.fillStyle(0xf0f4f8);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), belt - roof);
    g.fillStyle(0x223348);
    g.fillRect(Math.round(ca) + 2, roof + 2, Math.round(cb - ca) - 4, belt - roof - 3);
    // Emergency rooftop lightbar (alternating red, blue, amber flash)
    const flash = Math.sin(this.clock * 12);
    g.fillStyle(0x222222);
    g.fillRect(Math.round((ca + cb) / 2) - 6, roof - 2, 12, 2);
    g.fillStyle(flash > 0 ? 0x2288ff : 0xee2222);
    g.fillRect(Math.round((ca + cb) / 2) - 5, roof - 4, 5, 2);
    g.fillStyle(flash <= 0 ? 0x2288ff : 0xee2222);
    g.fillRect(Math.round((ca + cb) / 2), roof - 4, 5, 2);
    // Heavy push-bumper in front
    const nose = c.dir > 0 ? c.left + c.length : c.left - 2;
    g.fillStyle(0x111114);
    g.fillRect(Math.round(nose), belt - 1, 2, 7);
    this.lights(g, car, c, belt + 1);
    this.wheels(g, c, [0.2, 0.8], wheel);
    g.restore();
  }

  drawAirFire(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 4.5;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const belt = sill - 8;
    // Massive aerodynamic ARFF body in bright emergency red
    g.fillStyle(0xdd2211);
    g.fillRect(c.left, belt, c.length, sill - belt);
    // Fluorescent lime-yellow safety belt stripe
    g.fillStyle(0xccff00);
    g.fillRect(c.left, belt + 2, c.length, 3);
    // Sloped aerodynamic cab in front
    const cab = c.dir > 0 ? c.left + c.length * 0.6 : c.left;
    const cabW = c.length * 0.4;
    g.fillStyle(0xdd2211);
    g.fillRect(Math.round(cab), roof, Math.round(cabW), belt - roof);
    // Panoramic wraparound windshield
    g.fillStyle(0x1a3044);
    g.fillRect(Math.round(cab) + 2, roof + 2, Math.round(cabW) - 4, belt - roof - 3);
    g.fillStyle(0x77bbff, 0.6);
    g.fillRect(Math.round(cab) + 3, roof + 3, Math.round(cabW) - 6, belt - roof - 5);
    // Roll-up aluminum equipment shutter doors along side
    const body = c.dir > 0 ? c.left + 2 : c.left + cabW + 2;
    const bodyW = c.length - cabW - 4;
    g.fillStyle(0xbbbcc4);
    for (let sx = body + 2; sx < body + bodyW - 4; sx += 8) {
      g.fillRect(Math.round(sx), belt + 6, 6, sill - belt - 7);
    }
    // Heavy roof-mounted high-flow water cannon turret (monitor nozzle)
    const turretX = c.dir > 0 ? cab + cabW * 0.7 : cab + cabW * 0.3;
    g.fillStyle(0x333338);
    g.fillRect(Math.round(turretX) - 3, roof - 3, 6, 3);
    g.fillRect(Math.round(turretX) + (c.dir > 0 ? 2 : -6), roof - 4, 5, 2);
    // Flashing emergency beacons
    const flash = Math.sin(this.clock * 14) > 0;
    g.fillStyle(flash ? 0x2288ff : 0xee1111);
    g.fillCircle(Math.round(cab + cabW * 0.5), roof - 2, 2.5);
    g.fillCircle(Math.round(body + bodyW * 0.8), belt - 2, 2);
    this.lights(g, car, c, belt + 3);
    // 6x6 Heavy All-Terrain Tires
    this.wheels(g, c, [0.18, 0.42, 0.82], wheel);
    g.restore();
  }

  drawJeep(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const belt = sill - 5;
    const [ca, cb] = [c.front(0.15), c.front(0.78)].sort((a, b) => a - b);
    g.fillStyle(car.paint);
    g.fillRect(c.left, belt, c.length, sill - belt);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), belt - roof);
    g.fillStyle(0xdbeaf2);
    g.fillRect(Math.round(ca) + 2, roof + 2, Math.round(cb - ca) - 4, belt - roof - 3);
    g.fillStyle(car.paint);
    g.fillRect(Math.round((ca + cb) / 2), roof + 2, 1, belt - roof - 3);
    // Roof roll cage / roof rack
    g.fillStyle(0x282c30);
    g.fillRect(Math.round(ca), roof - 2, Math.round(cb - ca), 1);
    // Spare tire mounted on rear
    const tail = c.dir > 0 ? c.left - 1 : c.left + c.length - 1;
    g.fillStyle(0x181a1c);
    g.fillRect(tail, belt - 2, 2, 5);
    this.lights(g, car, c, belt + 1);
    this.wheels(g, c, [0.2, 0.8], wheel);
    g.restore();
  }

  drawPerson(g, person, groundAt) {
    super.drawPerson(g, person, groundAt);
    if (person.fade < 1 || person.state === 'flinch' || person.state === 'held') return;
    const x = Math.round(person.x + this.shift);
    const feet = Math.round(groundAt(x)) + 1 + person.lane * 3 - (person.lift ?? 0);
    const h = person.height;
    const unit = v => Math.max(1, Math.round(v * h / 18));
    const width = unit(5);
    const head = unit(4);
    const legs = unit(7);
    const torso = unit(7);
    const base = feet;
    const left = x - Math.floor(width / 2);
    const shoulders = base - legs - torso;
    const headLeft = x - Math.floor(head / 2) + (person.dir > 0 ? 0 : -1) + 1;
    const headTop = shoulders - head;

    // 1. Hi-Vis Safety Vest (Ramp / Ground crew)
    if (person.vest) {
      g.fillStyle(0xff6600); // Neon orange
      g.fillRect(left, shoulders, width, torso);
      g.fillStyle(0xffffff); // Silver reflective stripes
      g.fillRect(left, shoulders + unit(2), width, 1.5);
      g.fillRect(left, shoulders + unit(4), width, 1.5);
    }

    // 2. Security Officer Peaked Cap & Badge
    if (person.cap === 'peaked' || person.badge) {
      // Peaked navy security hat
      g.fillStyle(0x101824);
      g.fillRect(headLeft - 1, headTop - 2, head + 2, 2);
      g.fillRect(headLeft + (person.dir > 0 ? 2 : -2), headTop - 1, head, 1.5);
      // Gold shield badge on chest & cap
      g.fillStyle(0xffd700);
      g.fillRect(headLeft + (person.dir > 0 ? 1 : 0), headTop - 3, 2, 2);
      g.fillRect(left + (person.dir > 0 ? 3 : 1), shoulders + 2, 2, 2);
    }

    // 3. Airline Pilot Cap & Gold Epaulets
    if (person.epaulets) {
      // White top captain's peaked hat with black visor & gold band
      g.fillStyle(0xffffff);
      g.fillRect(headLeft - 0.5, headTop - 2.5, head + 1, 2);
      g.fillStyle(0x111111);
      g.fillRect(headLeft + (person.dir > 0 ? 2 : -2), headTop - 1, head, 1.5);
      g.fillStyle(0xffd700);
      g.fillRect(headLeft - 0.5, headTop - 1, head + 1, 1);
      // Gold Captain stripes on shoulders
      g.fillRect(left, shoulders, 2, 1);
      g.fillRect(left + width - 2, shoulders, 2, 1);
    }

    // 4. Over-Ear Hearing Protection / Ear Defenders
    if (person.earDefenders) {
      g.fillStyle(0xee2222);
      g.fillRect(headLeft - 1, headTop + 1, 1.5, 3);
      g.fillRect(headLeft + head - 0.5, headTop + 1, 1.5, 3);
      g.fillRect(headLeft, headTop, head, 1);
    }

    // 5. Rolling Flight Luggage Case
    if (person.suitcase) {
      const caseX = person.dir > 0 ? left - unit(3.5) : left + width + unit(1.5);
      g.fillStyle(0x1e242c);
      g.fillRect(Math.round(caseX), base - unit(5), unit(3), unit(5));
      // Silver telescoping handle
      g.fillStyle(0xcccccc);
      g.fillRect(Math.round(caseX + (person.dir > 0 ? unit(2) : 0)), base - unit(8), 1, unit(4));
      // Tiny rolling wheels
      g.fillStyle(0x111111);
      g.fillCircle(Math.round(caseX + 1), base, 1);
      g.fillCircle(Math.round(caseX + unit(3) - 1), base, 1);
    }
  }
}
