import { isWater, lerpColor, regionAt, wrapX } from './planet.js';
import { HERO_HEIGHT, restyled } from './city-life.js';
import { segmentBox } from './hero-combat.js';
import { sound } from './sound.js';
import { LIFT } from './enemy-throw.js';
import { EMBER_BASE_ZONE } from './frostland-art.js';

// Civil air traffic in the hero's own airspace: news and tour helicopters, light aircraft,
// airliners, a jumbo, a Beluga freighter and skeins of geese. Unlike the pale
// crossings far behind the scenery (sky-life.js, city-life.js), these fly in front of the towns at
// the hero's scale (city-life-rules.md), so the hero can fly up to them, and in evil mode bring them
// down.
// - Each region has its own mix (ROSTER), so the sky differs from place to place: news helicopters
//   over Green City, light aircraft over the fields, airliners and the Beluga into Bayport, the jumbo
//   over the open sea.
// - Sparse: at most MAX aircraft near the view, one arriving every GAP seconds.
// - Aircraft hold the height they came in at. Helicopters fly to a spot in view, hover a while and
//   move on.
// - Evil mode: RAM, a fist or the laser damages an aircraft (never an aim target; it is hit when
//   the attack passes through it). A damaged one trails smoke; once it has taken `tough` hits it
//   falls burning, ploughs through any building in its way, and blows up on the ground (the scene
//   is told through onCrash) or splashes into water and sinks. Each goose is killed on its own.
// - Grab and throw (enemy-throw.js): the hero lifts a helicopter or an aeroplane within reach, even
//   one already falling, and hurls it. It blows up on what it hits (its blast grows with its
//   length), then falls on burning, through any building in its way, to blow up again where it
//   lands. Let go, it simply falls. Geese are not lifted.
const METRE = HERO_HEIGHT / 1.85;
// Life size. Lower it if the big jets swamp the view.
const SCALE = 1;
const m = v => v * METRE * SCALE;

// length and height: the hit box (px). altitude and speed: [low, high]. tough: hits to bring it
// down; the laser lands one hit every COOK seconds on it.
// Helicopters are drawn and boxed at HELI of life size: at full size they swamped the towns and
// dwarfed the hero. At 0.5 one is about 6.5 m (3.5 hero heights) with a cabin about hero-tall.
const HELI = 0.5;
// Airliners scaled down 20% (0.8 of life size) to look realistic and well-proportioned in view.
export const AIRLINER_SCALE = 0.8;
// One metre of helicopter art as drawn, in px (the enemy lab places its door gunners by it).
export const HELI_METRE = m(1) * HELI;
// Brought down, a helicopter loses its tail rotor: the fuselage yaws round the mast (seen side-on,
// it turns edge-on and back), the main rotor keeps turning, and drag holds the drop to about
// GRAVITY / HELI_DRAG px/s.
const HELI_DRAG = 1.3;
// Rotor turn rate (rad/s), when the tail snaps off after the hit (s), and where along the airframe
// the snapped tail section's middle sits (drawing units, see helicopter()).
const ROTOR_SPIN = 26;
const TAIL_SNAP = 0.55;
const TAIL_MID = -3.9;
// Propeller turn rate at full revs and windmilling with the engine dead (rad/s).
const PROP_SPIN = 45;
const PROP_WINDMILL = 7;
const FAN_SPIN = 9;
// A downed airliner's burning engine tears off this long after it starts to fall (s); on the jumbo
// the next one catches and goes ENGINE_TEAR later.
const ENGINE_TEAR = 0.9;
// How long a hit spark and a crash fireball last (s).
const SPARK = 0.22;
const FIREBALL = 0.9;
const KINDS = {
  newsheli: { length: m(13) * HELI, height: m(4) * HELI, altitude: [150, 300], speed: [60, 85], tough: 1, hover: true },
  tourheli: { length: m(12) * HELI, height: m(3.8) * HELI, altitude: [120, 260], speed: [55, 80], tough: 1, hover: true },
  // Heat levels 2 and 3 (heat-and-enemies.md): never in a roster; the enemy lab sends and flies them.
  // The SWAT door gunner helicopter is bigger and takes two hits.
  policeheli: { length: m(12) * HELI, height: m(3.8) * HELI, altitude: [120, 200], speed: [70, 90], tough: 1, hover: true },
  gunheli: { length: m(13) * HELI, height: m(4) * HELI, altitude: [120, 200], speed: [90, 110], tough: 2, hover: true },
  // Heat level 4: the army's attack chopper, slim and fast, three hits.
  attackheli: { length: m(15.4) * HELI, height: m(4.16) * HELI, altitude: [120, 220], speed: [100, 120], tough: 3, hover: true },
  // Heat levels 5 and 6: military jets (the VTOL hovers), drawn and boxed at HELI scale like the helicopters. The
  // enemy lab steers them (craft.steered).
  strikejet: { length: m(15) * HELI, height: m(4.5) * HELI, altitude: [120, 200], speed: [480, 520], tough: 1, war: true },
  fighter: { length: m(15) * HELI, height: m(4.5) * HELI, altitude: [120, 200], speed: [420, 460], tough: 2, war: true },
  vtol: { length: m(14) * HELI, height: m(4.5) * HELI, altitude: [120, 200], speed: [580, 620], tough: 3, war: true },
  prop: { length: m(8.3), height: m(2.8), altitude: [220, 420], speed: [110, 140], tough: 1 },
  // Airliners cruise along the top of the low-ground view (map lab: ~1300 px above the ground at
  // full zoom-out). The jumbo and Beluga ride its top edge, bellies low enough for the hero at the
  // ~1280 px low-ground ceiling to punch.
  jet: { length: m(37) * AIRLINER_SCALE, height: m(11) * AIRLINER_SCALE, altitude: [1080, 1180], speed: [200, 240], tough: 2 },
  jumbo: { length: m(70), height: m(18), altitude: [1290, 1330], speed: [190, 215], tough: 3 },
  beluga: { length: m(56), height: m(17), altitude: [1280, 1320], speed: [170, 195], tough: 3 },
  geese: { length: 120, height: 50, altitude: [130, 330], speed: [60, 80], tough: 1 },
};
// [kind, weight] per region name; anywhere else gets DEFAULT.
const ROSTER = {
  'Green City': [['newsheli', 3], ['jet', 1], ['geese', 1]],
  'Windmill Fields': [['prop', 3], ['geese', 1]],
  Windmill: [['prop', 3], ['geese', 1]],
  Oakwood: [['geese', 3], ['prop', 2]],
  'Mirror Lake': [['geese', 3], ['prop', 2]],
  Rivertown: [['tourheli', 3], ['geese', 1], ['jet', 1]],
  'Orchard Fields': [['prop', 2], ['geese', 1]],
  Orchard: [['prop', 2], ['geese', 1]],
  Bayport: [['jet', 3], ['beluga', 1], ['newsheli', 1]],
  'Shell Beach': [['tourheli', 2], ['prop', 2], ['geese', 1]],
  'Blue Sea': [['jumbo', 2], ['tourheli', 1], ['geese', 2]],
  'Golden Beach': [['tourheli', 2], ['prop', 2], ['jumbo', 1]],
  Sandport: [['jet', 2], ['newsheli', 1], ['prop', 1]],
  'Red Dunes': [['prop', 2], ['jet', 2]],
  'Palm Oasis': [['prop', 2], ['jet', 1]],
  Redrock: [['jet', 2], ['prop', 2], ['tourheli', 1]],
  'Echo Canyon': [['tourheli', 3], ['prop', 2]],
  'Sun City': [['jet', 3], ['tourheli', 3], ['newsheli', 2], ['jumbo', 2], ['prop', 2], ['beluga', 1]],
  'Long Plains': [['prop', 2], ['jet', 2], ['geese', 1]],
  Longfield: [['prop', 3], ['geese', 1]],
  'Snowcap Peaks': [['tourheli', 2], ['geese', 3]],
  Highpass: [['prop', 2], ['geese', 2]],
  'Pine Woods': [['prop', 2], ['geese', 2]],
  Pinetown: [['prop', 3], ['beluga', 1]],
  'Frozen Plains': [['prop', 2], ['geese', 2]],
  'Ice Lake': [['tourheli', 2], ['prop', 2]],
  'Snow City': [['jet', 3], ['jumbo', 2], ['newsheli', 1]],
  Birchwood: [['prop', 2], ['tourheli', 1]],
  'Whale Fjord': [['tourheli', 2], ['prop', 2]],
  'Whale Harbor': [['beluga', 2], ['jumbo', 1], ['newsheli', 1]],
  'Mount Ember': [['tourheli', 2], ['prop', 1]],
};
const DEFAULT = [['jet', 2], ['geese', 2], ['prop', 1]];
// Names for the dev panel's spawn list.
export const AIR_KINDS = { newsheli: 'News helicopter', tourheli: 'Tour helicopter', prop: 'Light aircraft', jet: 'Airliner',
  jumbo: 'Jumbo jet (747)', beluga: 'Beluga freighter', geese: 'Geese' };
export const AIRPORT_RUNWAY = { from: 36720, to: 40680, threshold: 37020, rotate: 37700 };
export const AIRPORT_HELIPADS = [36480, 38460, 40200];
const MAX = 2;
// Ember Base is restricted airspace: civilian aircraft climb above FLOOR (px over the ground) from
// EDGE before the fence, never hover over it, and helicopters spawned there start up high.
const CIVIL = new Set(['newsheli', 'tourheli', 'prop', 'jet', 'jumbo', 'beluga']);
const BASE_SKY = { from: EMBER_BASE_ZONE.from, to: EMBER_BASE_ZONE.to, edge: 600, floor: 950 };
const baseSkyDepth = (x, w = wrapX(x)) => Math.min(w - BASE_SKY.from, BASE_SKY.to - w) + BASE_SKY.edge;
const GAP = [10, 24];
const SPAWN_MARGIN = 90;
const DESPAWN = 900;
const COOK = 0.6;
const GRAVITY = 260;
// A wreck burns for BURN seconds and is cleared WRECK_STAY seconds after it came down.
const BURN = 14;
const WRECK_STAY = 30;
const SINK = 3.5;
const CHAR = 0x26221f;
const GLASS = 0x9fb8c6;
const WHITE = 0xe9ebe8;
const SHADE = 0xc9ccc9;
const DARK = 0x4a5058;
const GOOSE = [0x6e6a60, 0x8a8478];
const BOX = { x: 0, y: 0, width: 0, height: 0 };
const END = { x: 0, y: 0 };
const P1 = { x: 0, y: 0 };
const P2 = { x: 0, y: 0 };
const CRAFT_BOXES = [];
const CRAFT_BOX_LIST = [];

// Precision multi-part hitboxes in local aircraft coordinates [x, y, w, h, requireTail] (metres).
// Scaled by METRE * scale (where scale incorporates AIRLINER_SCALE or HELI).
// Accurately matches the visual fuselage tube, hump/bulge, tail fin, wings/engines, and cabin.
export const AIRCRAFT_PARTS = {
  jet: [
    [0, 0, 37, 4, false], // Fuselage tube
    [-2, 2.5, 14, 3.5, false], // Wing & engines
    [-14.5, -5, 7.5, 6.5, true], // Tail fin
  ],
  jumbo: [
    [0, 0, 70, 6.4, false], // Fuselage
    [16, -4.6, 36, 3.0, false], // Upper deck hump
    [-2, 4.5, 28, 5.5, false], // Wing & engines
    [-29.5, -8.7, 11, 11, true], // Tail fin
  ],
  beluga: [
    [0, 0, 56, 5.4, false], // Fuselage
    [3.6, -4.65, 45.8, 4.2, false], // Cargo hold bulge
    [-2.5, 3.8, 19, 4.5, false], // Wing & engines
    [-23.7, -7.2, 9, 9, true], // Tail fin
  ],
  prop: [
    [0, 0, 8.3, 1.8, false], // Fuselage & cabin
    [-3.65, -1.15, 1.3, 1.5, true], // Tail fin
    [1.5, 1.2, 2.5, 0.8, false], // Landing gear
  ],
  newsheli: [
    [1.75, 0.3, 9.5, 3.2, false], // Cabin
    [-3.75, -0.2, 5.5, 2.2, true], // Tail boom & fin
    [0, -2.0, 10.0, 1.0, false], // Main rotor disc
  ],
  tourheli: [
    [1.2, 0.3, 9.6, 3.0, false], // Cabin
    [-3.5, -0.3, 5.0, 2.2, true], // Tail boom & fin
    [0, -2.0, 10.0, 1.0, false], // Main rotor disc
  ],
};

export function toLocal(craft, point, out) {
  const down = craft.down;
  const sunk = down?.sink >= 0 ? Math.min(1, down.sink / SINK) : 0;
  const bob = !down && craft.spec.hover ? Math.sin(craft.phase * 1.3) * 3 : 0;
  const originX = craft.x;
  const originY = craft.y + bob + sunk * craft.spec.height;
  const dx = point.x - originX;
  const dy = point.y - originY;
  const cos = Math.cos(craft.angle);
  const sin = Math.sin(craft.angle);
  const rx = dx * cos + dy * sin;
  const ry = -dx * sin + dy * cos;
  out.x = rx * craft.dir;
  out.y = ry;
  return out;
}

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class AirLife {
  // groundAt(world x): the land or sea surface.
  constructor(groundAt, random = Math.random) {
    this.groundAt = groundAt;
    this.random = random;
    this.crafts = [];
    // Geese shot out of a skein, falling or lying where they landed.
    this.fallen = [];
    this.timer = 4;
    this.clock = 0;
    this.centre = null;
    this.tireSmokes = [];
    // Evil mode hooks, set by the scene. onCrash(x, y, length, power 0..1, grounded): an aircraft
    // blew up there. solidAt(x, y): is there standing building at that point?
    this.onCrash = null;
    this.solidAt = null;
  }

  spawnTireSmoke(x, y) {
    for (let i = 0; i < 6; i++) {
      this.tireSmokes.push({
        x: x + (this.random() - 0.5) * 16,
        y: y - 2,
        radius: 3 + this.random() * 3,
        age: 0,
        life: 0.6 + this.random() * 0.4,
      });
    }
  }

  // The other areas' interface that means nothing up here.
  setBridgeStanding() {}
  drawSky() {}
  alarm() {}
  crush() {}
  heroPound() {}

  // Entering, leaving or rebuilding evil mode clears wrecks and anything on its way down.
  setBuildingsIntact() {
    this.crafts = this.crafts.filter(craft => !craft.down);
    for (const craft of this.crafts) craft.damage = 0;
    this.fallen = [];
  }

  // One of the region's own mix flies in from past the view's edge; or, for the dev panel, the
  // given kind. Returns it.
  spawn(left, right, kind = null) {
    const centre = (left + right) / 2;
    if (!kind) {
      const roster = ROSTER[regionAt(centre).name] ?? DEFAULT;
      let roll = this.random() * roster.reduce((sum, [, weight]) => sum + weight, 0);
      kind = (roster.find(([, weight]) => (roll -= weight) < 0) ?? roster[0])[0];
    }
    const spec = KINDS[kind];
    const dir = this.random() < 0.5 ? -1 : 1;
    const x = dir > 0 ? left - spec.length / 2 - SPAWN_MARGIN : right + spec.length / 2 + SPAWN_MARGIN;
    const altitude = spec.altitude[0] + this.random() * (spec.altitude[1] - spec.altitude[0]);
    // Helicopters apply their base HELI art size in drawCraft; scale is an extra multiplier.
    const scale = kind === 'jet' ? AIRLINER_SCALE : 1;
    const craft = {
      kind, spec, scale, x, y: this.groundAt(centre) - altitude, dir, vy: 0, angle: 0, phase: this.random() * 6,
      speed: spec.speed[0] + this.random() * (spec.speed[1] - spec.speed[0]), damage: 0, down: null, seed: this.random(),
      // A ring of smoke puffs, reused.
      trail: Array.from({ length: 14 }, () => ({ x: 0, y: 0, age: 9 })), puff: 0, puffTimer: 0,
      rotor: this.random() * 6, flash: -9,
    };
    craft.vx = dir * craft.speed;
    if (spec.hover) Object.assign(craft, { spot: left + (0.25 + this.random() * 0.5) * (right - left), hover: 7 + this.random() * 8 });
    if (CIVIL.has(kind) && baseSkyDepth(craft.x) > 0) craft.y = Math.min(craft.y, this.groundAt(craft.x) - BASE_SKY.floor);
    if (CIVIL.has(kind) && craft.spot !== undefined && baseSkyDepth(craft.spot) > -200) craft.hover = 0;
    // Near Sun City Airport (36000 - 41000): active flight cycles
    const nearAirport = centre >= 36000 && centre <= 41000;
    if (nearAirport && (kind === 'jet' || kind === 'jumbo' || kind === 'prop' || kind === 'beluga') && this.random() < 0.75) {
      const isTakeoff = this.random() < 0.5;
      if (isTakeoff) {
        craft.flightMode = 'takeoff';
        craft.flightPhase = 'roll';
        craft.dir = 1;
        craft.x = AIRPORT_RUNWAY.threshold - 40;
        craft.targetAltitude = altitude;
        craft.speed = spec.speed[0] + this.random() * (spec.speed[1] - spec.speed[0]);
        craft.vx = 45;
        const clearance = this.clearance(craft);
        craft.y = this.groundAt(craft.x) - clearance;
        craft.angle = 0;
      } else {
        craft.flightMode = 'landing';
        craft.flightPhase = 'approach';
        craft.dir = 1;
        craft.x = AIRPORT_RUNWAY.threshold - 600;
        craft.speed = spec.speed[0] * 0.8;
        craft.vx = craft.speed;
        craft.y = this.groundAt(AIRPORT_RUNWAY.threshold) - 110;
        craft.angle = 0.08;
      }
    } else if (nearAirport && (kind === 'newsheli' || kind === 'tourheli') && this.random() < 0.75) {
      // Civilian Helicopter Airport Operations (Takeoff / Landing at Helipads)
      const padIdx = Math.floor(this.random() * AIRPORT_HELIPADS.length);
      const helipadX = AIRPORT_HELIPADS[padIdx];
      const isHeliTakeoff = this.random() < 0.5;
      const clearance = this.clearance(craft);
      if (isHeliTakeoff) {
        craft.flightMode = 'heli-takeoff';
        craft.flightPhase = 'ground';
        craft.groundTimer = 2.0 + this.random() * 3.0;
        craft.x = helipadX;
        craft.y = this.groundAt(helipadX) - clearance;
        craft.vx = 0;
        craft.vy = 0;
        craft.angle = 0;
        craft.targetAltitude = altitude;
      } else {
        craft.flightMode = 'heli-landing';
        craft.flightPhase = 'approach';
        craft.targetHelipad = helipadX;
        craft.dir = craft.x < helipadX ? 1 : -1;
        craft.vx = craft.dir * craft.speed * 0.7;
        craft.targetAltitude = altitude;
      }
    }
    if (kind === 'geese') {
      // A V: the leader, then pairs trailing back and out.
      const count = 5 + Math.floor(this.random() * 5);
      craft.birds = Array.from({ length: count }, (_, i) => {
        const rank = Math.ceil(i / 2);
        return { dx: -rank * 12, dy: (i % 2 ? 1 : -1) * rank * 5, phase: this.random() * 6, color: GOOSE[i % 2] };
      });
    }
    this.crafts.push(craft);
    return craft;
  }

  // left/right: the view's world span. The hero is not needed: nothing up here reacts to it.
  step(dt, left, right) {
    this.clock += dt;
    const centre = (left + right) / 2;
    // The view jumped (a wrap, or a teleport): start the sky afresh.
    if (this.centre !== null && Math.abs(centre - this.centre) > 3000) {
      this.crafts = [];
      this.fallen = [];
    }
    this.centre = centre;
    this.timer -= dt;
    let flying = 0;
    for (const craft of this.crafts) if (!craft.down) flying++;
    if (this.timer <= 0) {
      this.timer = GAP[0] + this.random() * (GAP[1] - GAP[0]);
      if (flying < MAX) this.spawn(left, right);
    }
    let drop = false;
    for (const craft of this.crafts) {
      craft.phase += dt;
      // Rotors turn while it flies and as it falls; a wreck's are stopped.
      if (craft.spec.hover && !craft.down?.landed) craft.rotor += dt * ROTOR_SPIN;
      // A propeller at full revs; going down, the dead engine only windmills it.
      // A jet's fan turns slower to the eye.
      else if (craft.kind !== 'geese' && !craft.down?.landed) {
        craft.rotor += dt * (craft.down ? PROP_WINDMILL : craft.kind === 'prop' ? PROP_SPIN : FAN_SPIN);
      }
      if (craft.held) {
        // In the hero's hands: it goes where the body EnemyThrow moves goes.
        craft.x = craft.held.x;
        craft.y = craft.held.y;
        craft.angle = craft.held.spin ?? 0;
      } else if (craft.down) this.stepDown(craft, dt);
      else this.stepFlying(craft, dt);
      if (craft.damage > 0 || craft.down) this.stepTrail(craft, dt);
      if (craft.gone || craft.x < left - DESPAWN || craft.x > right + DESPAWN) drop = true;
    }
    if (drop) this.crafts = this.crafts.filter(craft => !craft.gone && craft.x >= left - DESPAWN && craft.x <= right + DESPAWN);
    for (const bird of this.fallen) {
      if (bird.rest) continue;
      bird.vy += GRAVITY * dt;
      bird.x += bird.vx * dt;
      bird.y += bird.vy * dt;
      bird.angle += bird.spin * dt;
      const floor = this.groundAt(bird.x) - 1;
      if (bird.y >= floor) Object.assign(bird, { y: floor, rest: true, angle: Math.PI });
    }
    if (this.fallen.length > 40) this.fallen.splice(0, this.fallen.length - 40);
    for (const sm of this.tireSmokes) {
      sm.age += dt;
      sm.radius += dt * 6;
    }
    this.tireSmokes = this.tireSmokes.filter(sm => sm.age < sm.life);
  }

  stepFlying(craft, dt) {
    if (craft.flightMode === 'takeoff') {
      const clearance = this.clearance(craft);
      if (craft.flightPhase === 'roll') {
        craft.vx = Math.min(craft.speed, craft.vx + 70 * dt);
        craft.x += craft.dir * craft.vx * dt;
        craft.y = this.groundAt(craft.x) - clearance;
        craft.angle = 0;
        if (craft.x >= AIRPORT_RUNWAY.rotate) {
          craft.flightPhase = 'climb';
        }
      } else if (craft.flightPhase === 'climb') {
        craft.vx += (craft.speed - craft.vx) * (1 - Math.exp(-2 * dt));
        craft.x += craft.dir * craft.vx * dt;
        craft.vy = -65;
        craft.y += craft.vy * dt;
        craft.angle = -0.16;
        if (this.groundAt(craft.x) - craft.y >= (craft.targetAltitude ?? 520)) {
          craft.flightMode = 'cruise';
          craft.angle = 0;
        }
      }
      return;
    }

    if (craft.flightMode === 'landing') {
      const clearance = this.clearance(craft);
      if (craft.flightPhase === 'approach') {
        craft.x += craft.dir * craft.vx * dt;
        const targetY = this.groundAt(craft.x) - clearance;
        craft.y += (targetY - craft.y) * Math.min(1, dt * 1.8);
        craft.angle = 0.05;
        if (craft.x >= AIRPORT_RUNWAY.threshold && craft.y >= targetY - 4) {
          craft.flightPhase = 'rollout';
          craft.y = targetY;
          craft.angle = 0;
          this.spawnTireSmoke(craft.x, this.groundAt(craft.x));
        }
      } else if (craft.flightPhase === 'rollout') {
        craft.vx = Math.max(35, craft.vx - 80 * dt);
        craft.x += craft.dir * craft.vx * dt;
        craft.y = this.groundAt(craft.x) - clearance;
        craft.angle = 0;
        if (craft.x >= AIRPORT_RUNWAY.to - 80 || craft.vx <= 40) {
          craft.flightPhase = 'taxi';
        }
      } else if (craft.flightPhase === 'taxi') {
        craft.vx = 25;
        craft.x += craft.dir * craft.vx * dt;
        craft.y = this.groundAt(craft.x) - clearance;
        craft.angle = 0;
      }
      return;
    }

    if (craft.flightMode === 'heli-takeoff') {
      const clearance = this.clearance(craft);
      const groundY = this.groundAt(craft.x) - clearance;
      if (craft.flightPhase === 'ground') {
        craft.vx = 0;
        craft.vy = 0;
        craft.angle = 0;
        craft.y = groundY;
        craft.groundTimer = (craft.groundTimer ?? 3) - dt;
        if (craft.groundTimer <= 0) {
          craft.flightPhase = 'liftoff';
        }
      } else if (craft.flightPhase === 'liftoff') {
        craft.vy = -35;
        craft.y += craft.vy * dt;
        craft.vx = (craft.vx ?? 0) * (1 - Math.exp(-2 * dt));
        craft.angle = 0;
        if (groundY - craft.y >= 55) {
          craft.flightPhase = 'climbout';
        }
      } else if (craft.flightPhase === 'climbout') {
        craft.vx += (craft.dir * craft.speed - craft.vx) * (1 - Math.exp(-2 * dt));
        craft.x += craft.vx * dt;
        craft.vy = -25;
        craft.y += craft.vy * dt;
        craft.angle = craft.dir * 0.12;
        if (groundY - craft.y >= (craft.targetAltitude ?? 200)) {
          craft.flightMode = 'cruise';
          craft.angle = 0;
        }
      }
      return;
    }

    if (craft.flightMode === 'heli-landing') {
      const clearance = this.clearance(craft);
      const targetX = craft.targetHelipad ?? (AIRPORT_HELIPADS[1] ?? 38460);
      const groundY = this.groundAt(targetX) - clearance;
      const dist = Math.abs(targetX - craft.x);

      if (craft.flightPhase === 'approach') {
        craft.dir = targetX > craft.x ? 1 : -1;
        const targetSpeed = Math.min(craft.speed, Math.max(25, dist * 0.8));
        craft.vx += (craft.dir * targetSpeed - craft.vx) * (1 - Math.exp(-2.5 * dt));
        craft.x += craft.vx * dt;

        // Controlled descent toward 45px above helipad
        const targetHoverY = groundY - 45;
        craft.y += (targetHoverY - craft.y) * Math.min(1, dt * 1.5);
        craft.angle = -craft.dir * 0.08;

        if (dist < 12 && Math.abs(craft.y - targetHoverY) < 15) {
          craft.flightPhase = 'descent';
          craft.x = targetX;
          craft.vx = 0;
        }
      } else if (craft.flightPhase === 'descent') {
        craft.x = targetX;
        craft.vx = 0;
        craft.angle = 0;
        craft.vy = 20;
        craft.y += craft.vy * dt;
        if (craft.y >= groundY - 2) {
          craft.y = groundY;
          craft.vy = 0;
          craft.flightPhase = 'touchdown';
          craft.groundTimer = 5.0;
        }
      } else if (craft.flightPhase === 'touchdown') {
        craft.x = targetX;
        craft.y = groundY;
        craft.vx = 0;
        craft.vy = 0;
        craft.angle = 0;
        craft.groundTimer = (craft.groundTimer ?? 5) - dt;
        if (craft.groundTimer <= 0) {
          craft.flightMode = 'heli-takeoff';
          craft.flightPhase = 'liftoff';
          craft.dir = craft.dir ? -craft.dir : 1;
        }
      }
      return;
    }

    // A jet the enemy lab flies: it sets vx and vy; the nose follows the path.
    if (craft.steered) {
      craft.x += craft.vx * dt;
      craft.y += craft.vy * dt;
      // The VTOL stays level.
      const pitch = craft.kind === 'vtol' ? 0 : Math.atan2(craft.vy, Math.max(60, Math.abs(craft.vx))) * craft.dir;
      craft.angle += (pitch - craft.angle) * (1 - Math.exp(-5 * dt));
      return;
    }
    const before = craft.vx;
    if (craft.spec.hover && craft.hover > 0) {
      const gap = (craft.spot - craft.x) * craft.dir;
      // Ease in to the spot, hold there bobbing, then fly on.
      if (gap < 4) {
        craft.hover -= dt;
        craft.vx *= Math.exp(-3 * dt);
      } else craft.vx = craft.dir * Math.min(craft.speed, 20 + gap * 0.8);
    } else craft.vx += (craft.dir * craft.speed - craft.vx) * (1 - Math.exp(-1.5 * dt));
    craft.x += craft.vx * dt;
    this.keepOutOfBaseSky(craft, dt);
    // Helicopters bob and nose down as they fly: further while speeding up, flaring nose-up as they
    // brake into a hover.
    if (craft.spec.hover && dt > 0) {
      const ahead = (craft.vx - before) / dt * craft.dir;
      const lean = Math.max(-0.21, Math.min(0.24, 0.1 * Math.min(1, Math.abs(craft.vx) / craft.speed) + ahead * 0.006));
      craft.angle += (craft.dir * lean - craft.angle) * (1 - Math.exp(-4 * dt));
    } else if (craft.kind !== 'geese' && dt > 0) {
      // Fixed wings ride the air: a slow climb and sink of a few metres with small turbulence bumps
      // on top, the nose pitching to follow the path. The light aircraft is bounced about more.
      const sway = craft.kind === 'prop' ? 6 : 2.5;
      const p = craft.phase;
      const s = craft.seed * 40;
      craft.vy = sway * (Math.sin(p * 0.6 + s) + 0.35 * Math.sin(p * 2.3 + s * 1.7) * Math.sin(p * 0.9 + s));
      craft.y += craft.vy * dt;
      const pitch = Math.atan2(craft.vy, Math.max(60, Math.abs(craft.vx))) * craft.dir;
      craft.angle += (pitch - craft.angle) * (1 - Math.exp(-3 * dt));
    }
  }

  // A civilian craft nearing Ember Base climbs, reaching BASE_SKY.floor by the fence.
  keepOutOfBaseSky(craft, dt) {
    if (!CIVIL.has(craft.kind)) return;
    const depth = baseSkyDepth(craft.x);
    if (depth <= 0) return;
    const top = this.groundAt(craft.x) - BASE_SKY.floor * Math.min(1, depth / BASE_SKY.edge);
    if (craft.y > top) craft.y = Math.max(top, craft.y - Math.max(80, (craft.y - top) * 3) * dt);
    if (depth >= BASE_SKY.edge) craft.y = Math.min(craft.y, top);
  }

  // Vertical clearance (px) from the aircraft's centre (y=0 in drawing units) to its belly hull.
  clearance(craft) {
    const scale = craft.spec.hover || craft.spec.war ? HELI * (craft.scale ?? 1)
      : craft.scale ?? (craft.kind === 'jet' ? AIRLINER_SCALE : 1);
    const liner = LINERS[craft.kind];
    if (liner) return m(liner.radius) * scale;
    if (craft.kind === 'prop') return m(0.85);
    if (craft.spec.hover) return m(2.1) * scale;
    return craft.spec.height * 0.45;
  }

  // Falling: nose down along its path, through any building in the way, to the ground or the water.
  stepDown(craft, dt) {
    const down = craft.down;
    down.age += dt;
    if (down.parts) this.stepParts(down.parts, dt);
    const liner = LINERS[craft.kind];
    const clearance = this.clearance(craft);

    if (down.landed) {
      // A plane belly-skids on a little way, stopping short of any water.
      if (down.skid) {
        const x = craft.x + down.skid * dt;
        if (isWater(x)) down.skid = 0;
        else {
          craft.x = x;
          const slope = (this.groundAt(x + 20) - this.groundAt(x - 20)) / 40;
          craft.angle = Math.atan2(slope, 1);
          craft.y = this.groundAt(x) - clearance;
          if (liner) {
            const nosePt = this.heliPoint(craft, liner.length / 2, liner.radius);
            const gNose = this.groundAt(nosePt.x);
            if (nosePt.y > gNose) craft.y -= (nosePt.y - gNose);
          }
          down.skid *= Math.exp(-1.6 * dt);
          if (Math.abs(down.skid) < 3) down.skid = 0;
        }
      }
      if (down.sink >= 0) {
        down.sink += dt;
        if (down.sink > SINK) craft.gone = true;
      } else if (down.age > WRECK_STAY) craft.gone = true;
      return;
    }
    // The airliner's wings still bear some of it: it comes down in a long slant, not a plunge.
    const glide = !!liner;
    craft.vy += GRAVITY * (glide ? 0.6 : 1) * dt;
    if (craft.spec.hover) craft.vy *= Math.exp(-HELI_DRAG * dt);
    craft.vx *= Math.exp(-(craft.spec.hover ? 0.8 : glide ? 0.12 : 0.35) * dt);
    craft.x += craft.vx * dt;
    craft.y += craft.vy * dt;
    if (craft.spec.hover) {
      // The tail boom snaps off a moment after the hit and tumbles away on its own.
      if (!down.tailless && down.age > TAIL_SNAP) this.snapTail(craft);
      // The yaw spin winds up over the first second; the fuselage rocks and the nose dips.
      down.yaw += down.spin * Math.min(1, 0.25 + down.age * 0.75) * dt;
      craft.angle = 0.1 + 0.12 * Math.sin(down.age * 6);
    } else {
      // A light aircraft enters an aerodynamic spiral dive, shuddering under stall buffeting.
      const buffet = craft.kind === 'prop' ? 0.06 * Math.sin(down.age * 24) * craft.dir : 0;
      const dive = Math.min(glide ? 0.7 : 1.35, Math.atan2(craft.vy, Math.abs(craft.vx))) * craft.dir + buffet;
      craft.angle += (dive - craft.angle) * (1 - Math.exp(-(craft.kind === 'prop' ? 4.5 : 2) * dt));
      // An airliner's burning engines tear off its wing one after another.
      if (liner && down.torn < liner.engines.length && down.age > ENGINE_TEAR * (down.torn + 1)) this.tearEngine(craft);
    }

    // Key points along the lower hull to detect impact the instant the nose or belly touches down.
    let hitGround = false;
    let impactX = craft.x;
    let impactY = craft.y;
    let nosePt = null;

    if (craft.spec.hover) {
      const floor = this.groundAt(craft.x) - clearance;
      if (craft.y >= floor) {
        hitGround = true;
        impactX = craft.x;
        impactY = this.groundAt(craft.x);
      }
    } else {
      const noseM = liner ? liner.length / 2 : 4.42;
      const noseR = liner ? liner.radius * 0.6 : 0.6;
      nosePt = this.heliPoint(craft, noseM, noseR);
      const gNose = this.groundAt(nosePt.x);

      const bellyPt = this.heliPoint(craft, 0, liner ? liner.radius : 0.85);
      const gBelly = this.groundAt(bellyPt.x);

      const tailM = liner ? -liner.length / 2 : -4.25;
      const tailPt = this.heliPoint(craft, tailM, noseR);
      const gTail = this.groundAt(tailPt.x);

      if (nosePt.y >= gNose) {
        hitGround = true;
        impactX = nosePt.x;
        impactY = gNose;
      } else if (bellyPt.y >= gBelly) {
        hitGround = true;
        impactX = bellyPt.x;
        impactY = gBelly;
      } else if (tailPt.y >= gTail) {
        hitGround = true;
        impactX = tailPt.x;
        impactY = gTail;
      }
    }

    // A building in the way: it ploughs in, blowing a hole, and carries on down.
    down.cool -= dt;
    const leadX = craft.x + craft.dir * craft.spec.length * 0.3;
    const checkX = nosePt ? nosePt.x : leadX;
    const checkY = nosePt ? nosePt.y : craft.y;
    if (down.cool <= 0 && (this.solidAt?.(checkX, checkY) || this.solidAt?.(leadX, craft.y))) {
      down.cool = 0.25;
      craft.vx *= 0.7;
      craft.vy *= 0.8;
      this.onCrash?.(checkX, checkY, craft.spec.length, 0.6, false);
    }

    if (!hitGround) return;

    down.landed = true;
    down.age = 0;
    if (isWater(impactX) || isWater(craft.x)) {
      down.sink = 0;
      craft.angle = 0;
      craft.y = this.groundAt(craft.x) - clearance;
      sound.splash(1);
      this.onCrash?.(impactX, impactY, craft.spec.length, 0.7, false);
      return;
    }

    // A helicopter comes to rest rolled onto a skid, throwing a rotor blade and chunks of itself.
    if (craft.spec.hover) {
      craft.angle = 0.25 * Math.sign(down.spin);
      craft.y = this.groundAt(craft.x) - clearance;
      down.yaw = Math.round(down.yaw / Math.PI) * Math.PI;
      this.scatter(craft);
    } else {
      const slope = (this.groundAt(craft.x + 20) - this.groundAt(craft.x - 20)) / 40;
      craft.angle = Math.atan2(slope, 1);
      craft.y = this.groundAt(craft.x) - clearance;
      const noseCheck = liner ? this.heliPoint(craft, liner.length / 2, liner.radius) : this.heliPoint(craft, 4.42, 0.85);
      const gNose = this.groundAt(noseCheck.x);
      if (noseCheck.y > gNose) craft.y -= (noseCheck.y - gNose);
      const tailCheck = liner ? this.heliPoint(craft, -liner.length / 2, liner.radius) : this.heliPoint(craft, -4.25, 0.85);
      const gTail = this.groundAt(tailCheck.x);
      if (tailCheck.y > gTail) craft.y -= (tailCheck.y - gTail);

      down.roll = 0;
      down.skid = craft.vx * (liner ? 0.45 : 0.3);
      if (liner) {
        while (down.torn < liner.engines.length) this.tearEngine(craft, true);
      }
      this.breakUp(craft);
    }
    sound.blast(1);
    this.onCrash?.(impactX, impactY, craft.spec.length, Math.min(1, 0.5 + craft.spec.length / m(60)), true);
  }

  // Smoke from a damaged aircraft, thicker once it is going down.
  stepTrail(craft, dt) {
    for (const puff of craft.trail) puff.age += dt;
    if (craft.down?.landed && (craft.down.sink >= 0 || craft.down.age > BURN)) return;
    craft.puffTimer -= dt;
    if (craft.puffTimer > 0) return;
    craft.puffTimer = craft.down ? 0.07 : 0.16;
    const puff = craft.trail[craft.puff = (craft.puff + 1) % craft.trail.length];
    puff.x = craft.x - (craft.down?.landed ? 0 : craft.dir * craft.spec.length * 0.2) + (this.random() - 0.5) * 6;
    puff.y = craft.y;
    puff.age = 0;
  }

  // The nearest aircraft the hero (world { x, y }) can lift, as the body EnemyThrow carries and
  // throws, or null. reach: px from the hero to its hit box. size: the largest LIFT_SIZES index the
  // hero lifts.
  liftable(hero, reach, size) {
    let best = null;
    let nearest = reach;
    for (const craft of this.crafts) {
      const { spec } = craft;
      if (craft.held || craft.gone || craft.down?.landed || craft.kind === 'geese') continue;
      const need = spec.length > m(50) ? LIFT.giant : spec.length > m(20) ? LIFT.airliner : LIFT.lightAircraft;
      if (need > size) continue;
      const distance = Math.hypot(Math.max(0, Math.abs(hero.x - craft.x) - spec.length / 2),
        Math.max(0, Math.abs(hero.y - craft.y) - spec.height / 2));
      if (distance > nearest) continue;
      nearest = distance;
      best = craft;
      craft.body ??= {
        object: true, size: need, radius: (spec.length + spec.height) / 4, half: spec.height / 2,
        // The hands take it under the belly.
        hold: spec.height * 0.3, width: spec.length, height: spec.height,
        maxHealth: Math.round(spec.length * 1.3), spinRate: spec.hover ? 7 : spec.length > m(20) ? 2 : 4,
        scrap: [0xf2f4f6, 0xb9c4cc, 0x3a4048, 0x6f7a84],
        // A downed one keeps its damage (craft.lost: snapped tail, char, fallen parts) while held.
        grabbed: () => { Object.assign(craft, { held: craft.body, lost: craft.down ?? craft.lost, down: null, hover: 0, vx: 0, vy: 0 }); },
        dropped: () => this.fall(craft, 0, 0),
        burst: () => this.fall(craft, craft.body.vx * 0.3, Math.min(0, craft.body.vy * 0.3)),
        gone: () => { craft.gone = true; },
      };
      craft.body.x = craft.x;
      craft.body.y = craft.y;
    }
    if (best) best.body.distance = nearest;
    return best?.body ?? null;
  }

  // Out of the hero's hands (let go, or thrown into something): it goes down from where it is.
  fall(craft, vx, vy) {
    if (!craft.held) return;
    craft.held = null;
    Object.assign(craft, { vx, vy, dir: Math.sign(vx) || craft.dir });
    this.hit(craft, Infinity);
    // Clear of whatever it just hit before it ploughs into the next thing.
    craft.down.cool = 0.3;
  }

  // One blow lands. Enough of them and it goes down.
  hit(craft, amount, push = 0) {
    if (craft.down) return;
    craft.damage += amount;
    craft.vx += push;
    if (amount >= 0.5) craft.flash = this.clock;
    if (craft.damage < craft.spec.tough) return;
    // A helicopter loses its tail rotor and yaws round its mast at 0.75–1.25 turns a second; the rest
    // tumble.
    const spin = craft.spec.hover ? 2 * Math.PI * (0.75 + this.random() * 0.5) : 3 + this.random() * 3;
    // Downed again after being held: what it had already lost stays lost.
    const lost = craft.lost;
    craft.down = { age: lost?.age ?? 0, landed: false, sink: -1, cool: 0, spin: (this.random() < 0.5 ? -1 : 1) * spin, yaw: 0,
      parts: lost?.parts ?? [], tailless: lost?.tailless ?? false, roll: 0, skid: 0, torn: lost?.torn ?? 0 };
    craft.lost = null;
    this.onDown?.(craft);
    craft.flash = this.clock;
    craft.hover = 0;
    sound.blast(0.5);
  }

  // A world point from the aircraft's own drawing units (m, nose +x), as it is drawn now.
  heliPoint(craft, x, y) {
    const turn = craft.down ? Math.cos(craft.down.yaw) : 1;
    const scale = craft.spec.hover || craft.spec.war ? HELI * (craft.scale ?? 1)
      : craft.scale ?? (craft.kind === 'jet' ? AIRLINER_SCALE : 1);
    const lx = m(x) * scale * craft.dir * turn;
    const ly = m(y) * scale;
    const cos = Math.cos(craft.angle);
    const sin = Math.sin(craft.angle);
    return { x: craft.x + lx * cos - ly * sin, y: craft.y + lx * sin + ly * cos, flip: craft.dir * (turn < 0 ? -1 : 1) };
  }

  snapTail(craft) {
    const down = craft.down;
    down.tailless = true;
    const at = this.heliPoint(craft, TAIL_MID, -0.4);
    down.parts.push({ kind: 'tail', x: at.x, y: at.y, dir: at.flip, angle: craft.angle,
      vx: craft.vx * 0.4 - at.flip * (80 + this.random() * 40), vy: craft.vy - 70 - this.random() * 40,
      spin: (this.random() < 0.5 ? -1 : 1) * (4 + this.random() * 3), lift: m(0.6) * HELI });
    craft.flash = this.clock;
    sound.blast(0.3);
  }

  // On impact: one blade flies off end over end, and bits of the airframe scatter.
  scatter(craft) {
    const hub = this.heliPoint(craft, 0, -2);
    const side = this.random() < 0.5 ? -1 : 1;
    craft.down.parts.push({ kind: 'blade', x: hub.x, y: hub.y, dir: side, angle: 0, vx: side * (70 + this.random() * 60),
      vy: -200 - this.random() * 80, spin: side * (10 + this.random() * 6), lift: 1 });
    for (let i = 0; i < 6; i++) {
      craft.down.parts.push({ kind: 'chunk', x: craft.x + (this.random() - 0.5) * 20, y: craft.y - 4, dir: 1, angle: 0,
        vx: (this.random() - 0.5) * 220, vy: -90 - this.random() * 160, spin: (this.random() - 0.5) * 20, lift: 1,
        size: 2 + Math.floor(this.random() * 3), dark: i % 2 === 0 });
    }
  }

  // A downed airliner: its burning engine tears off the wing and falls away, still alight.
  tearEngine(craft, onGround = false) {
    const down = craft.down;
    const spec = LINERS[craft.kind];
    const scale = craft.scale ?? (craft.kind === 'jet' ? AIRLINER_SCALE : 1);
    const [x, y] = enginePlace(spec, down.torn++);
    const at = this.heliPoint(craft, x, y);
    down.parts.push({ kind: 'engine', x: at.x, y: at.y, dir: craft.dir, angle: craft.angle, r: spec.engineR,
      vx: craft.vx * 0.7 + (onGround ? (this.random() - 0.5) * 40 : 0),
      vy: onGround ? -70 - this.random() * 50 : craft.vy + 30,
      spin: (this.random() - 0.5) * 6, lift: m(spec.engineR * 0.48) * scale, fire: true });
    craft.flash = this.clock;
    sound.blast(0.4);
  }

  // A plane hitting the ground: propellers and airliner tails are specific to their airframes.
  // Military jets shed the shared wreckage without looking up civilian airliner geometry.
  breakUp(craft) {
    const down = craft.down;
    const side = -craft.dir;
    if (craft.kind === 'prop') {
      const hub = this.heliPoint(craft, 4.42, 0.08);
      down.parts.push({ kind: 'prop', x: hub.x, y: hub.y, dir: craft.dir, angle: 0, vx: craft.dir * (60 + this.random() * 50),
        vy: -170 - this.random() * 60, spin: 14, lift: m(0.12) });
      const wheel = this.heliPoint(craft, 0.95, 1.4);
      down.parts.push({ kind: 'wheel', x: wheel.x, y: wheel.y, dir: craft.dir, angle: 0, vx: craft.vx * 0.6 + (this.random() - 0.5) * 60,
        vy: -110 - this.random() * 50, spin: 9, lift: m(0.28) });
    } else if (LINERS[craft.kind]) {
      down.tailless = true;
      const spec = LINERS[craft.kind];
      const scale = craft.scale ?? (craft.kind === 'jet' ? AIRLINER_SCALE : 1);
      const [px, py] = tailPivot(spec);
      const at = this.heliPoint(craft, px, py);
      down.parts.push({ kind: 'jettail', x: at.x, y: at.y, dir: craft.dir, angle: craft.angle,
        vx: craft.vx * 0.15 + side * (50 + this.random() * 30), vy: -150 - this.random() * 50,
        spin: side * (2 + this.random() * 1.5), lift: m(spec.radius * 2.5) * scale });

      // Catastrophic structural breakup mechanics for widebody giants
      if (craft.kind === 'jumbo') {
        // Fractured swept outer wing section shears off with flap track fairings and winglet
        const wingPt = this.heliPoint(craft, 2, 2.5);
        down.parts.push({ kind: 'wing', x: wingPt.x, y: wingPt.y, dir: craft.dir, angle: craft.angle + side * 0.2,
          vx: craft.vx * 0.45 + side * (40 + this.random() * 30), vy: -130 - this.random() * 50,
          spin: side * (3 + this.random() * 2), lift: m(1.6) * scale, fire: true });
        // Lower cargo bay ruptures: standard airline LD3 aluminum cargo containers spill out
        for (let k = 0; k < 3; k++) {
          const cx = craft.x + craft.dir * (k - 1) * 26 + (this.random() - 0.5) * 12;
          down.parts.push({ kind: 'cargo', x: cx, y: craft.y - 2, dir: craft.dir, angle: (this.random() - 0.5) * 0.4,
            vx: craft.vx * 0.4 + (this.random() - 0.5) * 80, vy: -70 - this.random() * 50,
            spin: (this.random() - 0.5) * 6, lift: m(1.0) * scale });
        }
      } else if (craft.kind === 'beluga') {
        // Massive clamshell cargo dome shell fractures and tears free
        const doorPt = this.heliPoint(craft, 8, -2.5);
        down.parts.push({ kind: 'belugadoor', x: doorPt.x, y: doorPt.y, dir: craft.dir, angle: craft.angle,
          vx: craft.vx * 0.35 + side * (35 + this.random() * 25), vy: -140 - this.random() * 50,
          spin: side * (2.2 + this.random() * 1.5), lift: m(2.0) * scale, fire: true });
        // Oversized aircraft fuselage transport barrel / wing box payload spills onto crash site
        down.parts.push({ kind: 'belugacargo', x: craft.x + side * 22, y: craft.y - 3, dir: craft.dir, angle: 0,
          vx: craft.vx * 0.3 + (this.random() - 0.5) * 50, vy: -75 - this.random() * 40,
          spin: (this.random() - 0.5) * 3, lift: m(2.2) * scale });
      }
    }
    const big = !!LINERS[craft.kind];
    const count = big ? Math.round(craft.spec.length / m(3.7)) : 6;
    for (let i = 0; i < count; i++) {
      down.parts.push({ kind: 'chunk', x: craft.x + (this.random() - 0.5) * craft.spec.length * 0.5, y: craft.y - 4, dir: 1, angle: 0,
        vx: craft.vx * 0.3 + (this.random() - 0.5) * 240, vy: -90 - this.random() * 170, spin: (this.random() - 0.5) * 20, lift: 1,
        size: (big ? 3 : 2) + Math.floor(this.random() * (big ? 4 : 3)), dark: i % 2 === 0 });
    }
  }

  stepParts(parts, dt) {
    for (const part of parts) {
      if (part.rest || part.gone) continue;
      part.vy += GRAVITY * dt;
      part.vx *= Math.exp(-0.4 * dt);
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.angle += part.spin * dt;
      const floor = this.groundAt(part.x) - part.lift;
      if (part.y < floor) continue;
      if (isWater(part.x)) {
        part.gone = true;
        continue;
      }
      // Lands lying flat, either way up.
      Object.assign(part, { y: floor, rest: true, angle: Math.round(part.angle / Math.PI) * Math.PI });
    }
  }

  box(craft) {
    BOX.x = craft.x;
    BOX.y = craft.y;
    BOX.width = craft.spec.length;
    BOX.height = craft.spec.height;
    return BOX;
  }

  // Pre-allocated multi-part hit boxes in local coordinates for this aircraft.
  craftBoxes(craft) {
    const raw = AIRCRAFT_PARTS[craft.kind];
    if (!raw) {
      const b = (CRAFT_BOXES[0] ??= { x: 0, y: 0, width: 0, height: 0 });
      b.x = 0;
      b.y = 0;
      b.width = craft.spec.length;
      b.height = craft.spec.height;
      CRAFT_BOX_LIST.length = 1;
      CRAFT_BOX_LIST[0] = b;
      return CRAFT_BOX_LIST;
    }
    const scale = craft.spec.hover || craft.spec.war ? HELI * (craft.scale ?? 1)
      : craft.scale ?? (craft.kind === 'jet' ? AIRLINER_SCALE : 1);
    const unit = METRE * scale;
    const tailless = craft.down?.tailless;
    let count = 0;
    for (let i = 0; i < raw.length; i++) {
      const [x, y, w, h, requireTail] = raw[i];
      if (requireTail && tailless) continue;
      const b = (CRAFT_BOXES[count] ??= { x: 0, y: 0, width: 0, height: 0 });
      b.x = x * unit;
      b.y = y * unit;
      b.width = w * unit;
      b.height = h * unit;
      CRAFT_BOX_LIST[count++] = b;
    }
    CRAFT_BOX_LIST.length = count;
    return CRAFT_BOX_LIST;
  }

  // Intersects a world segment from→to against the aircraft's oriented multi-part hitbox.
  // Returns { t, ... } with the fraction along from→to, or null.
  hitCraft(from, to, craft, pad = 0) {
    if (craft.kind === 'geese') return null;
    toLocal(craft, from, P1);
    toLocal(craft, to, P2);
    const boxes = this.craftBoxes(craft);
    let best = null;
    for (let i = 0; i < boxes.length; i++) {
      const res = segmentBox(P1, P2, boxes[i], pad);
      if (res && (best === null || res.t < best.t)) {
        best = res;
      }
    }
    return best;
  }

  // Kills the geese of a skein the segment passes within pad px of. True if any.
  strikeGeese(craft, from, to, pad, vx) {
    let hit = false;
    for (let i = craft.birds.length - 1; i >= 0; i--) {
      const bird = craft.birds[i];
      BOX.x = craft.x + craft.dir * bird.dx;
      BOX.y = craft.y + bird.dy;
      BOX.width = 12;
      BOX.height = 5;
      if (!segmentBox(from, to, BOX, pad)) continue;
      craft.birds.splice(i, 1);
      this.fallen.push({ x: BOX.x, y: BOX.y, vx: craft.vx * 0.5 + vx, vy: -20, spin: 6 + this.random() * 6, angle: 0, rest: false,
        dir: craft.dir, color: bird.color });
      hit = true;
    }
    if (!craft.birds.length) craft.gone = true;
    return hit;
  }

  // Everything a world segment touches takes `amount`. True if anything did.
  strike(from, to, pad, amount, push, once, kind = 'blast') {
    let hit = false;
    for (const craft of this.crafts) {
      if (craft.down || Math.abs(craft.x - (from.x + to.x) / 2) > craft.spec.length + Math.abs(to.x - from.x) + 60) continue;
      if (craft.kind === 'geese') {
        if (this.strikeGeese(craft, from, to, pad, push)) hit = true;
        continue;
      }
      // once: a punch id or RAM pass that has already counted against this aircraft.
      if (once !== undefined && craft.once === once || !this.hitCraft(from, to, craft, pad)) continue;
      craft.once = once;
      this.hit(craft, amount, push);
      if (amount > 0) this.onHeroHit?.(craft, kind);
      hit = true;
    }
    return hit;
  }

  // Evil mode: the hero RAMs along from→to. One hit per pass through an aircraft.
  heroRam(from, to, velocity) {
    // A new pass starts once the RAM has been clear of everything for a moment.
    if (this.clock - (this.ramAt ?? -1) > 0.4) this.ramPass = (this.ramPass ?? 0) + 1;
    // Half-integers, so a pass never shares an id with a punch.
    if (this.strike(from, to, 10, 1, velocity.x * 0.15, this.ramPass + 0.5, 'ram')) this.ramAt = this.clock;
  }

  heroPunch(point, angle, id) {
    return this.strike(point, point, 6, 1, Math.cos(angle) * 30, id, 'punch');
  }

  // The fraction t (0..1) along from→to where the eye laser first meets an aircraft, or null. Geese
  // are too small to stop it.
  laserBlock(from, to) {
    let best = null;
    for (const craft of this.crafts) {
      if (craft.kind === 'geese' || craft.down?.landed || craft.down?.sink >= 0) continue;
      if (Math.abs(craft.x - (from.x + to.x) / 2) > craft.spec.length + Math.abs(to.x - from.x) / 2 + 60) continue;
      const t = this.hitCraft(from, to, craft, 0)?.t;
      if (t !== undefined && (best === null || t < best)) best = t;
    }
    return best;
  }

  heroLaser(beam, dt) {
    END.x = beam.endX;
    END.y = beam.endY;
    this.strike(beam, END, 0, dt / COOK, 0, undefined, 'laser');
  }

  draw(g, left, right) {
    for (const bird of this.fallen) {
      if (bird.x < left - 20 || bird.x > right + 20) continue;
      g.save();
      g.translateCanvas(bird.x, bird.y);
      g.rotateCanvas(bird.angle);
      g.scaleCanvas(bird.dir, 1);
      goose(g, bird.color, 0, 0, false);
      g.restore();
    }
    for (const craft of this.crafts) {
      const reach = craft.spec.length / 2 + 80;
      if (craft.x < left - reach || craft.x > right + reach) continue;
      this.drawTrail(g, craft);
      const down = craft.down;
      const sunk = down?.sink >= 0 ? Math.min(1, down.sink / SINK) : 0;
      const bob = !down && !craft.held && craft.spec.hover ? Math.sin(craft.phase * 1.3) * 3 : 0;
      g.save();
      g.translateCanvas(craft.x, craft.y + bob + sunk * craft.spec.height);
      g.rotateCanvas(craft.angle);
      // Keep the full profile. Airliners apply their art scale once in drawCraft.
      const scale = LINERS[craft.kind] ? 1 : craft.scale ?? 1;
      g.scaleCanvas(craft.dir * scale, scale * (craft.stretch ?? 1));
      // Charred as it burns, fading as it sinks.
      const char = down ? Math.min(0.75, 0.3 + down.age * (down.landed ? 1 : 0.2)) : craft.lost ? 0.6 : 0;
      const pen = char || sunk ? restyled(g, (color, a) => [lerpColor(color, CHAR, char), a * (1 - sunk)]) : g;
      this.drawCraft(pen, craft);
      if (!sunk) this.drawFlames(g, craft);
      g.restore();
      if ((down ?? craft.lost)?.parts) this.drawParts(g, craft, down ?? craft.lost);
      if (down?.landed) this.drawWreckFire(g, craft);
      if (down?.landed && down?.skid && Math.abs(down.skid) > 5) this.drawSkidSparks(g, craft);
      if (this.clock - craft.flash < SPARK) spark(g, craft.x, craft.y, (this.clock - craft.flash) / SPARK, craft.seed);
    }
    for (const sm of this.tireSmokes ?? []) {
      if (sm.x < left - 20 || sm.x > right + 20) continue;
      const t = sm.age / sm.life;
      g.fillStyle(0xffffff, 0.75 * (1 - t));
      g.fillCircle(sm.x, sm.y, sm.radius);
    }
  }

  // Intense shower of friction sparks spraying backward as a crashing plane belly-skids across the terrain.
  drawSkidSparks(g, craft) {
    const dir = -Math.sign(craft.down.skid);
    const tick = Math.floor(this.clock * 28);
    const count = craft.kind === 'jumbo' || craft.kind === 'beluga' ? 14 : 7;
    for (let i = 0; i < count; i++) {
      const sx = craft.x + ((i / count) - 0.5) * craft.spec.length * 0.6;
      const sy = this.groundAt(sx);
      const h = hash(i * 7 + tick + craft.seed);
      const dist = 10 + h * 34;
      const vy = (h - 0.3) * 12;
      g.fillStyle(i % 3 === 0 ? 0xffffff : 0xffd27a, 0.9);
      g.fillRect(sx + dir * dist, sy - Math.max(1, vy), 2, 1);
    }
  }

  // Fire on a plane in the air (drawn in its frame): a damaged airliner's engine, a downed light
  // aircraft's nose. Flames stream back from the source.
  drawFlames(g, craft) {
    const down = craft.down;
    if (down?.landed) return;
    let x, y, size;
    const liner = LINERS[craft.kind];
    if (liner && (craft.damage > 0 || down) && (down?.torn ?? 0) < liner.engines.length) {
      const [ex, ey] = enginePlace(liner, down?.torn ?? 0);
      [x, y, size] = [ex - liner.engineR * 0.8, ey, liner.engineR * 0.65];
    } else if (craft.kind === 'prop' && down) [x, y, size] = [2.6, 0.1, 0.8];
    else if (craft.spec.war && (down || craft.damage > 0)) [x, y, size] = [-5.5, -0.9, 1.3];
    else return;
    flames(g, m(x), m(y), m(size), this.clock, craft.seed);
  }

  drawParts(g, craft, down) {
    const pen = restyled(g, (color, a) => [lerpColor(color, CHAR, Math.min(0.75, 0.3 + down.age * 0.3)), a]);
    const c = livery(craft);
    for (const part of down.parts) {
      if (part.gone) continue;
      g.save();
      g.translateCanvas(part.x, part.y);
      g.rotateCanvas(part.angle);
      if (part.kind === 'chunk') {
        pen.fillStyle(part.dark ? DARK : c.body);
        g.fillRect(-part.size / 2, -part.size / 2, part.size, part.size * 0.7);
      } else if (part.kind === 'prop') {
        pen.fillStyle(DARK);
        bar(g, -m(1), 0, m(1), 0, m(0.16));
        g.fillCircle(0, 0, m(0.14));
      } else if (part.kind === 'wheel') {
        pen.fillStyle(DARK);
        g.fillCircle(0, 0, m(0.28));
        pen.fillStyle(c.trim);
        g.fillEllipse(m(0.05), -m(0.07), m(0.85), m(0.42));
      } else if (part.kind === 'engine') {
        const scale = craft.scale ?? (craft.kind === 'jet' ? AIRLINER_SCALE : 1);
        g.scaleCanvas(scale * part.dir, scale);
        nacelle(pen, craft, 0, 0, part.r, c, false);
        if (part.fire && !part.rest) flames(g, -m(1.6), 0, m(1.1), this.clock, craft.seed + 0.3);
        else if (part.rest && down.age < BURN) flames(g, 0, -m(0.6), m(0.9), this.clock, craft.seed + 0.3, true);
      } else if (part.kind === 'jettail') {
        const scale = craft.scale ?? (craft.kind === 'jet' ? AIRLINER_SCALE : 1);
        g.scaleCanvas(scale * part.dir, scale);
        const spec = LINERS[craft.kind];
        const [px, py] = tailPivot(spec);
        g.translateCanvas(-m(px), -m(py));
        linerTail(pen, spec, c);
        stump(pen, linerCut(spec), -spec.radius, spec.radius, 1);
      } else if (part.kind === 'wing') {
        // Fractured swept outer wing section with flap track canoes and winglet
        g.scaleCanvas(part.dir, 1);
        pen.fillStyle(c.body);
        quad(g, m(2), m(0.4), m(-6), m(0.4), m(-9), m(-1.8), m(-3.5), m(-1.8));
        pen.fillStyle(0xd5dde6);
        bar(g, m(2), m(0.4), m(-3.5), m(-1.8), m(0.25));
        pen.fillStyle(DARK);
        bar(g, m(-1), m(0.4), m(-3.2), m(1.2), m(0.4));
        pen.fillStyle(c.tail);
        bar(g, m(-9), m(-1.8), m(-9.6), m(-3.6), m(0.35));
        stump(pen, 2, -0.4, 0.8, -1);
        if (part.fire && !part.rest) flames(g, m(2), 0, m(1.2), this.clock, craft.seed + 0.4);
        else if (part.rest && down.age < BURN) flames(g, 0, -m(0.5), m(0.8), this.clock, craft.seed + 0.4, true);
      } else if (part.kind === 'cargo') {
        // Standard airline LD3 aluminum cargo container with contoured lower edge
        g.scaleCanvas(part.dir, 1);
        pen.fillStyle(0xb8c2ca);
        quad(g, m(-0.8), m(-0.9), m(0.8), m(-0.9), m(0.8), m(0.5), m(-0.8), m(0.5));
        g.fillTriangle(m(-0.8), m(0.5), m(-0.25), m(0.9), m(0.8), m(0.5));
        pen.fillStyle(DARK, 0.4);
        bar(g, m(-0.8), m(-0.9), m(0.8), m(-0.9), m(0.12));
        bar(g, m(0), m(-0.9), m(0), m(0.5), m(0.1));
        pen.fillStyle(c.stripe);
        g.fillRect(m(-0.5), m(-0.4), m(0.4), m(0.25));
      } else if (part.kind === 'belugadoor') {
        // Torn clamshell cargo dome shell
        g.scaleCanvas(part.dir, 1);
        pen.fillStyle(c.body);
        g.fillEllipse(0, 0, m(11), m(4.6));
        pen.fillStyle(c.hold);
        bar(g, -m(4.5), m(1.2), m(4.5), m(1.2), m(0.35));
        stump(pen, -5.5, -2.3, 2.3, 1);
        if (part.fire && !part.rest) flames(g, m(4), 0, m(1.3), this.clock, craft.seed + 0.5);
      } else if (part.kind === 'belugacargo') {
        // Oversized aircraft fuselage transport barrel payload on industrial transport jig
        g.scaleCanvas(part.dir, 1);
        pen.fillStyle(0x353a40);
        g.fillRect(m(-5.5), m(0.9), m(11), m(0.5));
        bar(g, m(-4.5), m(0.9), m(-3.5), m(-0.1), m(0.3));
        bar(g, m(4.5), m(0.9), m(3.5), m(-0.1), m(0.3));
        pen.fillStyle(0x9cb8a0);
        g.fillEllipse(0, -m(0.4), m(10), m(3.0));
        pen.fillStyle(DARK, 0.7);
        for (let x = -3.6; x <= 3.6; x += 1.2) g.fillRect(m(x), -m(0.7), m(0.35), m(0.38));
        pen.fillStyle(0xd8a640);
        for (const bx of [-3.2, 0, 3.2]) g.fillRect(m(bx), -m(1.9), m(0.3), m(3.0));
      } else {
        g.scaleCanvas(HELI * part.dir, HELI);
        if (part.kind === 'tail') {
          g.translateCanvas(-m(TAIL_MID), m(0.4));
          tailSection(pen, craft, livery(craft), false);
        } else {
          pen.fillStyle(DARK);
          bar(g, m(-2.6), 0, m(2.6), m(part.rest ? 0 : 0.3), m(0.2));
        }
      }
      g.restore();
    }
  }

  drawCraft(g, craft) {
    const live = !craft.down && !craft.lost;
    if (craft.kind === 'geese') {
      for (const bird of craft.birds) goose(g, bird.color, bird.dx, bird.dy, Math.sin(craft.phase * 9 + bird.phase) > 0);
    } else if (craft.spec.hover) {
      // Yawing: the side view narrows to edge-on and comes back facing the other way.
      const turn = craft.down ? Math.cos(craft.down.yaw) : 1;
      const squash = Math.sign(turn || 1) * Math.max(0.15, Math.abs(turn));
      g.scaleCanvas(HELI * squash, HELI);
      helicopter(g, craft, !craft.down?.landed && !craft.lost, Math.abs(squash));
    }
    else if (craft.kind === 'prop') lightPlane(g, craft, live);
    else if (craft.spec.war) {
      g.scaleCanvas(HELI, HELI);
      // A dark outline about one px wide: the silhouette in ink, nudged four ways, under the jet.
      const o = 1 / (HELI * (craft.scale ?? 1));
      const ink = restyled(g, (color, a) => [JET_INK, a]);
      for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) {
        g.translateCanvas(dx, dy);
        warJet(ink, craft, false);
        g.translateCanvas(-dx, -dy);
      }
      warJet(g, craft, live);
    } else {
      const scale = craft.scale ?? (craft.kind === 'jet' ? AIRLINER_SCALE : 1);
      if (scale !== 1) g.scaleCanvas(scale, scale);
      airliner(g, craft);
    }
  }

  drawTrail(g, craft) {
    const burning = craft.down && !(craft.down.sink >= 0);
    // Emergency fuel dump vapor streaming from Jumbo wingtips in emergency descent
    if (craft.down && !craft.down.landed && craft.kind === 'jumbo') {
      const [front, back, tip] = LINERS.jumbo.wing;
      const r = LINERS.jumbo.radius;
      const wingPt = this.heliPoint(craft, tip, r * 1.4);
      const tick = Math.floor(this.clock * 24);
      for (let i = 0; i < 4; i++) {
        const d = (i + 1) * 14;
        const t = (this.clock * 2.5 + i * 0.25) % 1;
        g.fillStyle(0xffffff, 0.45 * (1 - t));
        g.fillCircle(wingPt.x - craft.dir * d, wingPt.y + (hash(i + tick) - 0.5) * 5, 3 + i * 1.5);
      }
    }
    // High-altitude decompression / cargo door seam vapor for Beluga in distress
    if (craft.down && !craft.down.landed && craft.kind === 'beluga') {
      const doorPt = this.heliPoint(craft, 12, -LINERS.beluga.radius * 0.8);
      const tick = Math.floor(this.clock * 20);
      for (let i = 0; i < 3; i++) {
        const d = (i + 1) * 12;
        g.fillStyle(0xe2e8f0, 0.4 * (1 - i * 0.28));
        g.fillCircle(doorPt.x - craft.dir * d, doorPt.y - 2 + (hash(i + tick) - 0.5) * 4, 4 + i * 2);
      }
    }
    for (const puff of craft.trail) {
      // Each puff expands, drifts downwind and fades out (quadratic) within 1.2–1.6 s.
      const life = burning ? 1.6 : 1.2;
      if (puff.age >= life) continue;
      const t = puff.age / life;
      if (burning && t < 0.25) {
        g.fillStyle(t < 0.12 ? 0xffd27a : 0xff8a3c, 0.85 * (1 - t * 3));
        g.fillCircle(puff.x, puff.y, 3 + t * 14);
      }
      // A wreck on the ground sends up a taller column.
      const rise = craft.down?.landed ? 70 : 22;
      g.fillStyle(burning ? 0x34312e : 0x8a8580, 0.5 * (1 - t) ** 2);
      g.fillCircle(puff.x + puff.age * 12, puff.y - t * rise, 3 + t * (burning ? 16 : 9));
    }
  }

  // On the ground: a fireball as it blows, then flames along the hull while it burns.
  drawWreckFire(g, craft) {
    const { age, sink } = craft.down;
    if (sink >= 0) {
      const t = Math.min(1, sink / SINK);
      const water = this.groundAt(craft.x);
      // Patchy froth where it went under, spreading and dying away (never one straight line).
      for (let i = 0; i < 9; i++) {
        const churn = (this.clock * 1.7 + i * 0.37) % 1;
        g.fillStyle(0xeef6f8, 0.7 * (1 - t) * (1 - churn));
        g.fillRect(Math.round(craft.x + ((i * 37 % 9) / 8 - 0.5) * craft.spec.length * (0.6 + 0.4 * t)) - 2, water - 1,
          2 + (i % 3) * 2, 1 + (i % 2));
      }
      g.fillStyle(0xeef6f8, 0.8 * (1 - t));
      for (let i = 0; i < 9; i++) {
        const up = 60 * t - 70 * t * t + (i % 3) * 5;
        g.fillRect(Math.round(craft.x + (i - 4) * craft.spec.length * 0.12), Math.round(water - Math.max(0, up)), 2, 3);
      }
      return;
    }
    const length = craft.spec.length;
    if (age < FIREBALL) fireball(g, craft.x, craft.y, 14 + length * 0.22, age / FIREBALL, craft.seed);
    const fire = 1 - age / BURN;
    if (fire <= 0) return;
    const tick = Math.floor(this.clock * 12);
    const flames = Math.max(3, Math.round(length / 28));
    for (let i = 0; i < flames; i++) {
      const height = Math.round((4 + hash(i + tick + craft.seed) * 12) * fire);
      g.fillStyle(i % 2 ? 0xff9a3c : 0xffd27a, 0.9);
      g.fillRect(Math.round(craft.x + ((i + 0.5) / flames - 0.5) * length * 0.8) - 1, Math.round(craft.y - craft.spec.height * 0.15) - height, 3, height);
    }
  }
}

// ---- Art: each drawn about its own centre, nose toward +x --------------------------------------

function goose(g, color, x, y, up) {
  g.fillStyle(color);
  g.fillRect(x - 4, y - 1, 8, 2);
  g.fillRect(x + 4, y - 1, 4, 1);
  g.fillRect(x - 2, up ? y - 4 : y + 1, 5, 3);
  g.fillStyle(0x2f2e2a);
  g.fillRect(x + 7, y - 2, 2, 2);
}

// Helicopter liveries, one per craft from its seed. News: three TV-station schemes (the yellow one
// with a striped tail). Tour: bright bodies under a big glass bubble.
const NEWS = [
  { body: 0xeeece7, accent: 0xc63f37, trim: 0x8a2b27, logo: 0xc63f37, mark: 0xeeece7 },
  { body: 0x3b8c8a, accent: 0x22385a, trim: 0x1a2a44, logo: 0xeeece7, mark: 0x22385a },
  { body: 0xe8c344, accent: 0x34373c, trim: 0x34373c, logo: 0x34373c, mark: 0xe8c344, stripes: true },
];
const TOUR = [
  { body: 0xe48a3a, accent: 0xf3eee4, trim: 0xa95f28 },
  { body: 0x8fd0b4, accent: 0xf3eee4, trim: 0x568f7a },
  { body: 0xb6a4d8, accent: 0xf3eee4, trim: 0x7a6ba3 },
];
const BEACON = 0xff4a3a;

// Light aircraft: club and trainer schemes. stripe: the cheat line and spinner; tail: the fin.
const PROP = [
  { body: 0xeeece7, stripe: 0xb8433a, trim: 0x7a2c27, tail: 0xb8433a },
  { body: 0xe9e2cf, stripe: 0x2f5d8a, trim: 0x1f3d5c, tail: 0x2f5d8a },
  { body: 0xe8c344, stripe: 0x34373c, trim: 0x34373c, tail: 0x34373c },
];
// Airliners: invented carriers. tail: fin; stripe: cheat line; engine: nacelles; belly: lower hull
// (two-tone when it is not the plain shade); mark: the fin logo.
const JET = [
  { body: WHITE, tail: 0x23395b, stripe: 0xc0463c, engine: 0x23395b, belly: SHADE, mark: 0xe9ebe8, trim: 0x23395b, logo: 'crescent' },
  { body: WHITE, tail: 0xe0873a, stripe: 0xe0873a, engine: WHITE, belly: SHADE, mark: 0xf3d36a, trim: 0x9a5524, logo: 'sun' },
  { body: WHITE, tail: 0x2f7f86, stripe: 0x2f7f86, engine: 0x2f7f86, belly: 0x5f7f9a, mark: 0xe9ebe8, trim: 0x1f5a5f, logo: 'wave' },
  { body: 0xece4d2, tail: 0x7e3a46, stripe: 0xc89a3c, engine: 0x7e3a46, belly: SHADE, mark: 0xc89a3c, trim: 0x5a2832, logo: 'chevron' },
];
// Long-haul carriers, all invented: a deep red with gold, a navy with a sky-blue belly, a forest
// green. title: the block of lettering along the upper deck.
const JUMBO = [
  { body: WHITE, tail: 0x8c2f3a, stripe: 0xd8a640, engine: 0x8c2f3a, belly: SHADE, mark: 0xd8a640, trim: 0x5e1f27, logo: 'star', title: 0x8c2f3a },
  { body: WHITE, tail: 0x1f3f6a, stripe: 0x4f8fc0, engine: WHITE, belly: 0x4f8fc0, mark: WHITE, trim: 0x16304f, logo: 'ring', title: 0x1f3f6a },
  { body: 0xeceee9, tail: 0x2c6a4a, stripe: 0x2c6a4a, engine: 0x2c6a4a, belly: SHADE, mark: 0xe6d9a8, trim: 0x1f4c35, logo: 'bars', title: 0x2c6a4a },
];
// Outsize cargo freighters: hold: the colour of the hold's lower flank band.
const BELUGA = [
  { body: WHITE, tail: 0x00205b, stripe: 0x009fe3, engine: 0x00205b, belly: SHADE, mark: WHITE, trim: 0x001744, logo: 'whale', hold: 0x009fe3, title: 0x00205b, smile: true },
  { body: WHITE, tail: 0x2b4f8a, stripe: 0x2b4f8a, engine: WHITE, belly: SHADE, mark: WHITE, trim: 0x1d3763, logo: 'arrow', hold: 0x2b4f8a, title: 0x2b4f8a },
  { body: 0xdfe2de, tail: 0xd9762c, stripe: 0xd9762c, engine: 0xd9762c, belly: 0x8b939a, mark: 0x2f353b, trim: 0x8a4a1a, logo: 'box', hold: 0x8b939a, title: 0x2f353b },
];
// Police: white with a navy band; the SWAT gunship gunmetal with black. One scheme each.
// Police: white over a navy belly with a chequered band. SWAT: slate grey over dark navy, a pale
// waist stripe, tinted glass.
const POLICE_HELI = [{ body: 0xeeece7, accent: 0x1f2c50, trim: 0x16203d, mark: 0x8fc4e8, glass: GLASS }];
const GUNSHIP = [{ body: 0x66717e, accent: 0x2b3342, trim: 0x232a36, mark: 0xc9d2da, glass: 0x8aa2b6 }];
// Army: olive drab, a darker belly, yellow stencil marks.
const ATTACK = [{ body: 0x5d6943, accent: 0x414a31, trim: 0x2c3322, mark: 0xc9b458, glass: 0x86a0b0 }];
// Jets (level-5-jets.jpg): the strike jet in olive camouflage, the fighter light grey.
const STRIKE_JET = [{ body: 0x5f6b48, accent: 0x46503a, trim: 0x2c3322, mark: 0x7d8a5e, glass: 0x9cc0d0 }];
const VTOL_JET = [{ body: 0x3d4656, accent: 0x2c3340, trim: 0x1e232c, mark: 0x8ea3a3, glass: 0x9fb8bf }];
// The jets' outline, so they stand out against a pale sky.
const JET_INK = 0x1c2018;
const FIGHTER = [{ body: 0xb4bbc1, accent: 0x8e979f, trim: 0x5d666e, mark: 0xd6dbdf, glass: 0x4a5a6a }];
const LIVERIES = { strikejet: STRIKE_JET, fighter: FIGHTER, vtol: VTOL_JET, newsheli: NEWS, tourheli: TOUR, policeheli: POLICE_HELI, gunheli: GUNSHIP, attackheli: ATTACK, prop: PROP, jet: JET, jumbo: JUMBO, beluga: BELUGA };

function livery(craft) {
  const set = LIVERIES[craft.kind];
  if (!set) return { body: WHITE, tail: DARK, stripe: DARK, engine: WHITE, belly: SHADE, mark: null, trim: DARK };
  return set[Math.floor(craft.seed * set.length) % set.length];
}

// A military jet in metres, nose +x, about its centre (level-5-jets.jpg). live: engines lit.
// craft.missiles: missiles still on the rails; craft.nozzle: the VTOL's nozzles, 0 back to 1
// down; craft.gun etc.: the belly machine gun (swivelGun); craft.lock: the missile seeker is locking (it blinks); craft.muzzle: when its cannon
// last fired (craft.phase).
function warJet(g, craft, live) {
  const c = livery(craft);
  const M = m(1);
  const r = (x, y, w, h) => g.fillRect(x * M, y * M, w * M, h * M);
  const tri = (ax, ay, bx, by, cx, cy) => g.fillTriangle(ax * M, ay * M, bx * M, by * M, cx * M, cy * M);
  const flame = (x, y, h, len) => {
    if (!live) return;
    const flicker = 0.8 + 0.2 * Math.sin(craft.phase * 40 + craft.seed * 9);
    g.fillStyle(0xff8a3c, 0.9);
    tri(x, y - h / 2, x, y + h / 2, x - len * flicker, y);
    g.fillStyle(0xffe08a, 0.95);
    tri(x, y - h / 4, x, y + h / 4, x - len * 0.5 * flicker, y);
  };
  if (craft.kind === 'strikejet') {
    // Straight-winged ground attacker (level-5-jets.jpg): a tall square fin at the tail, the
    // engine pod high on the rear body, the bubble canopy forward, a blunt drooping nose, missiles
    // on the rails under the wing. Olive with darker blotches.
    flame(-7.3, -1.7, 0.9, 2.8);
    g.fillStyle(c.body);
    // Fin.
    r(-7.4, -3.4, 1.6, 2.8);
    tri(-5.8, -3.4, -5.8, -0.6, -5, -0.6);
    // Body: slim at the tail, deepening to the cockpit, the nose rounding down.
    quad(g, -7.4 * M, -0.7 * M, 2.5 * M, -1.05 * M, 2.5 * M, 0.75 * M, -7.4 * M, 0.25 * M);
    r(2.5, -1.05, 3.5, 1.8);
    quad(g, 6 * M, -1.05 * M, 7.2 * M, -0.45 * M, 7.6 * M, 0.45 * M, 6 * M, 0.75 * M);
    // Engine pod, its intake and nozzle, on a pylon.
    r(-4.9, -2.45, 3.2, 1.25);
    tri(-1.7, -2.45, -1.7, -1.2, -1.2, -1.85);
    g.fillStyle(c.accent);
    r(-3.9, -1.2, 0.8, 0.4);
    r(-4.9, -1.55, 3.2, 0.35);
    g.fillStyle(c.trim);
    r(-5.1, -2.3, 0.3, 0.95);
    r(-1.5, -2.25, 0.25, 0.8);
    // Camouflage blotches and the belly shade.
    g.fillStyle(c.accent);
    r(-6.9, -2.6, 0.9, 1);
    r(-4.6, -0.6, 1.5, 0.6);
    r(-1, -0.95, 1.6, 0.7);
    r(2.4, -0.4, 1.4, 0.8);
    r(5.1, -0.9, 0.8, 0.6);
    g.fillStyle(c.mark);
    r(-7.2, -1.6, 0.8, 0.6);
    r(-2.6, -0.3, 1.3, 0.5);
    r(0.8, 0, 1.2, 0.5);
    r(3.8, -0.95, 1.1, 0.45);
    g.fillStyle(c.trim);
    quad(g, -7.4 * M, 0.05 * M, 2.5 * M, 0.45 * M, 2.5 * M, 0.75 * M, -7.4 * M, 0.25 * M);
    r(2.5, 0.45, 3.5, 0.3);
    // Canopy: a bubble on a frame.
    g.fillStyle(c.glass);
    quad(g, 3.4 * M, -1.05 * M, 3.9 * M, -1.85 * M, 5.2 * M, -1.85 * M, 5.9 * M, -1.05 * M);
    g.fillStyle(0xe6f2f6, 0.7);
    r(4, -1.75, 0.5, 0.25);
    g.fillStyle(c.trim);
    r(4.6, -1.85, 0.12, 0.8);
    // Wing, edge-on, and the missiles on its rails.
    g.fillStyle(c.accent);
    r(-1.8, 0.35, 4.4, 0.4);
    for (let i = 0; i < (craft.missiles ?? 0) && i < 2; i++) {
      const y = 0.95 + i * 0.5;
      g.fillStyle(0xd9dcd6);
      r(-1.4 + i * 0.5, y, 2.6, 0.32);
      tri(1.2 + i * 0.5, y, 1.2 + i * 0.5, y + 0.32, 1.7 + i * 0.5, y + 0.16);
      g.fillStyle(DARK);
      r(-1.6 + i * 0.5, y - 0.1, 0.3, 0.52);
    }
    // Gun muzzle under the nose; the seeker blinks red while it locks on.
    g.fillStyle(DARK);
    r(7.2, 0.25, 0.8, 0.18);
    if (craft.lock && Math.floor(craft.phase * 14) % 2) {
      g.fillStyle(0xff4a3a);
      r(1, 0.95, 0.35, 0.32);
    }
    return;
  }
  if (craft.kind === 'vtol') {
    // Jump jet (level-5-vtol.jpg): swept fin and shoulder wing, bubble canopy, a big side intake,
    // a black nose cone, a pale belly, two swivelling nozzles and a belly machine gun.
    const turn = Math.PI - (craft.nozzle ?? 0) * Math.PI / 2;
    const nozzle = x => {
      const ex = x + Math.cos(turn) * 1.1;
      const ey = 0.6 + Math.sin(turn) * 1.1;
      if (live) {
        // Longer jets blasting down in the hover.
        const flicker = (0.8 + 0.2 * Math.sin(craft.phase * 40 + x * 3)) * (1 + 0.7 * (craft.nozzle ?? 0));
        g.fillStyle(0xff8a3c, 0.9);
        bar(g, ex * M, ey * M, (ex + Math.cos(turn) * 1.8 * flicker) * M, (ey + Math.sin(turn) * 1.8 * flicker) * M, 0.55 * M);
        g.fillStyle(0xffe08a, 0.95);
        bar(g, ex * M, ey * M, (ex + Math.cos(turn) * 0.9 * flicker) * M, (ey + Math.sin(turn) * 0.9 * flicker) * M, 0.3 * M);
      }
      g.fillStyle(c.trim);
      bar(g, x * M, 0.6 * M, ex * M, ey * M, 0.6 * M);
    };
    nozzle(-1.9);
    g.fillStyle(c.body);
    // Fin and tailplane.
    quad(g, -6.3 * M, -0.7 * M, -4.4 * M, -0.8 * M, -5.6 * M, -3.1 * M, -6.4 * M, -3.1 * M);
    // Body, the nose cone.
    r(-6.6, -0.9, 11.4, 1.7);
    quad(g, 4.8 * M, -0.9 * M, 5.9 * M, -0.5 * M, 5.9 * M, 0.5 * M, 4.8 * M, 0.8 * M);
    g.fillStyle(c.trim);
    tri(5.9, -0.5, 5.9, 0.5, 7, 0.05);
    g.fillStyle(c.mark);
    r(-5.6, 0.3, 10.2, 0.5);
    quad(g, 4.6 * M, 0.3 * M, 5.9 * M, 0.3 * M, 5.9 * M, 0.5 * M, 4.6 * M, 0.8 * M);
    g.fillStyle(c.accent);
    // Tailplane.
    tri(-7.2, -0.3, -4.8, -0.3, -7.6, 0.25);
    // Canopy, with the spine behind it.
    g.fillStyle(c.accent);
    r(-1, -1.25, 3.4, 0.4);
    g.fillStyle(c.glass);
    quad(g, 2.2 * M, -0.9 * M, 2.8 * M, -1.65 * M, 3.9 * M, -1.65 * M, 4.6 * M, -0.9 * M);
    g.fillStyle(0xe6f2f6, 0.7);
    r(2.9, -1.55, 0.5, 0.22);
    // Side intake.
    g.fillStyle(c.trim);
    r(0.9, -0.75, 1.2, 1.25);
    g.fillStyle(0x12161c);
    r(1.15, -0.5, 0.7, 0.8);
    // Shoulder wing, swept back and down.
    g.fillStyle(c.accent);
    quad(g, -0.6 * M, -0.75 * M, 1.4 * M, -0.75 * M, -1.6 * M, 1.05 * M, -3.6 * M, 1.05 * M);
    swivelGun(g, craft, c, live);
    nozzle(0.6);
    return;
  }
  if (craft.kind === 'fighter') {
    // Sleek delta: pointed nose, bubble canopy, one tall fin, an afterburner, a belly gun.
    g.fillStyle(c.accent);
    tri(-6.8, -0.6, -4.6, -0.6, -6.6, -3.4);
    r(-6.6, -3.4, 0.6, 0.3);
    g.fillStyle(c.body);
    r(-7, -0.7, 10, 1.4);
    tri(3, -0.7, 3, 0.7, 7.6, 0.25);
    g.fillStyle(c.accent);
    r(-7, 0.35, 10, 0.35);
    tri(-6, 0.3, 1.5, 0.3, -5.6, 1);
    g.fillStyle(c.glass);
    tri(1.6, -0.7, 3.8, -0.7, 2.3, -1.5);
    r(1.2, -1.45, 1.1, 0.75);
    g.fillStyle(c.trim);
    r(-7.4, -0.5, 0.5, 1);
    r(3.6, 0.05, 0.5, 0.2);
    flame(-7.4, 0, 0.9, 2.6);
    for (let i = 0; i < (craft.missiles ?? 0) && i < 2; i++) {
      g.fillStyle(0xe9ebe8);
      r(-3.4 + i * 2.2, 0.95, 2, 0.3);
      g.fillStyle(DARK);
      r(-3.6 + i * 2.2, 0.85, 0.3, 0.5);
    }
    swivelGun(g, craft, c, live);
    if (craft.lock && Math.floor(craft.phase * 14) % 2) {
      g.fillStyle(0xff4a3a);
      r(-1.2, 1, 0.4, 0.4);
    }
    return;
  }
}

// The VTOL's and fighter's belly machine gun on a swivel (metres, in the jet's frame): a mount,
// and the barrel along craft.gun (a world angle, mirrored when the jet faces left). It glows as a
// burst winds up (craft.gunCharge) and flashes for each round (craft.muzzle).
function swivelGun(g, craft, c, live) {
  const M = m(1);
  g.fillStyle(c.trim);
  g.fillRect(0.4 * M, 0.75 * M, 1.2 * M, 0.45 * M);
  g.fillCircle(M, 1.1 * M, 0.38 * M);
  const aim = craft.gun ?? Math.PI / 2;
  const ax = Math.cos(aim) * (craft.dir || 1);
  const ay = Math.sin(aim);
  bar(g, M, 1.1 * M, (1 + ax * 1.4) * M, (1.1 + ay * 1.4) * M, 0.22 * M);
  if (live && craft.gunCharge > 0) {
    g.fillStyle(0xff6a3a, 0.3 + 0.6 * craft.gunCharge);
    g.fillCircle((1 + ax * 1.4) * M, (1.1 + ay * 1.4) * M, 0.25 * M);
  }
  if (live && craft.phase - (craft.muzzle ?? -9) < 0.04) {
    g.fillStyle(0xffe08a);
    bar(g, (1 + ax * 1.4) * M, (1.1 + ay * 1.4) * M, (1 + ax * 2.6) * M, (1.1 + ay * 2.6) * M, 0.6 * M);
  }
}

function quad(g, ax, ay, bx, by, cx, cy, dx, dy) {
  g.fillTriangle(ax, ay, bx, by, cx, cy);
  g.fillTriangle(ax, ay, cx, cy, dx, dy);
}

// A straight bar of width w from (x1, y1) to (x2, y2).
function bar(g, x1, y1, x2, y2, w) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len * w / 2;
  const ny = (x2 - x1) / len * w / 2;
  quad(g, x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny);
}

// The tail: boom, fins, stabiliser and tail rotor, from the cabin back (x -1 to -6.9). Drawn on its
// own when it snaps off in a crash. spinning: the tail rotor is turning.
function tailSection(g, craft, c, spinning) {
  // News and the service (police, SWAT) ships share the boxy cabin's heavier boom and fin.
  const news = craft.kind !== 'tourheli' && craft.kind !== 'attackheli';
  // Boom top and bottom edges at x (it tapers toward the tail).
  const top = x => news ? -0.7 + (-1 - x) * 0.07 : -0.45 + (-1 - x) * 0.05;
  const bottom = x => news ? 0.6 - (-1 - x) * 0.1 : 0.25 - (-1 - x) * 0.034;
  g.fillStyle(c.body);
  quad(g, m(-1), m(top(-1)), m(-6.1), m(top(-6.1)), m(-6.1), m(bottom(-6.1)), m(-1), m(bottom(-1)));
  if (c.stripes) {
    g.fillStyle(c.accent);
    for (let x = -3; x > -6; x -= 1) quad(g, m(x), m(top(x)), m(x - 0.45), m(top(x - 0.45)), m(x - 0.45), m(bottom(x - 0.45)), m(x), m(bottom(x)));
  }
  // Swept fin above, a small one below, and the stabiliser.
  g.fillStyle(news ? c.accent : c.trim);
  if (news) quad(g, m(-6.2), m(-0.3), m(-7), m(-2.5), m(-6.4), m(-2.5), m(-5.3), m(-0.3));
  else quad(g, m(-6.15), m(-0.15), m(-6.7), m(-1.8), m(-6.25), m(-1.8), m(-5.5), m(-0.15));
  g.fillTriangle(m(-6.1), m(0), m(-6.5), m(news ? 0.9 : 0.7), m(-5.6), m(0));
  g.fillStyle(c.trim);
  g.fillRect(m(-5.4), m(-0.12), m(news ? 1.3 : 0.9), m(0.2));
  // Tail rotor: a faint disc with a turning blade, or one still blade.
  const tx = m(-6.4);
  const ty = m(news ? -1.0 : -0.9);
  const r = m(news ? 0.85 : 0.7);
  if (spinning) {
    g.fillStyle(DARK, 0.18);
    g.fillCircle(tx, ty, r);
  }
  const a = spinning ? craft.rotor * 1.7 : 1.1;
  g.fillStyle(DARK, spinning ? 0.8 : 1);
  bar(g, tx - Math.cos(a) * r, ty - Math.sin(a) * r, tx + Math.cos(a) * r, ty + Math.sin(a) * r, m(0.14));
  g.fillCircle(tx, ty, m(0.15));
  // A red anti-collision beacon on the fin tip, blinking.
  if (spinning && news && craft.phase * 1.4 % 1 < 0.14) {
    g.fillStyle(BEACON, 0.35);
    g.fillCircle(m(-6.7), m(-2.55), m(0.45));
    g.fillStyle(BEACON);
    g.fillCircle(m(-6.7), m(-2.55), m(0.18));
  }
}

// The main rotor at the hub: a faint blur disc seen edge-on with its blades sweeping round
// (each blade's length foreshortened by the cosine of its angle). A wreck's blades are bent down
// and one is gone. squash: how far the fuselage is turned; the rotor disc keeps its full width.
function mainRotor(g, craft, hx, hy, blades, live, squash) {
  const radius = m(5.5) / squash;
  if (!live) {
    g.fillStyle(DARK);
    bar(g, hx, hy, hx + radius * 0.45, hy + m(0.5), m(0.18));
    bar(g, hx + radius * 0.45, hy + m(0.5), hx + radius * 0.75, hy + m(1.6), m(0.18));
    bar(g, hx, hy, hx - radius * 0.4, hy + m(0.2), m(0.18));
    bar(g, hx - radius * 0.4, hy + m(0.2), hx - radius * 0.62, hy - m(0.5), m(0.18));
  } else {
    g.fillStyle(DARK, 0.16);
    g.fillEllipse(hx, hy, radius * 2, m(0.5));
    g.fillStyle(DARK, 0.85);
    for (let k = 0; k < blades; k++) {
      const a = craft.rotor + k * 2 * Math.PI / blades;
      bar(g, hx, hy, hx + Math.cos(a) * radius, hy + Math.sin(a) * m(0.2), m(0.15));
    }
  }
  g.fillStyle(DARK);
  g.fillRect(hx - m(0.3), hy - m(0.14), m(0.6), m(0.28));
}

function skids(g, from, to, struts) {
  g.fillStyle(DARK);
  for (const x of struts) g.fillRect(m(x), m(1.35), m(0.18), m(0.8));
  g.fillRect(m(from), m(2.1), m(to - from), m(0.16));
  // Upturned tip at the front.
  bar(g, m(to), m(2.18), m(to + 0.6), m(1.75), m(0.16));
}

// A side-on helicopter, nose +x, drawn in m() units about its centre (cabin x ≈ -2.2..5, tail to
// -7, skids at y 2.1, rotor hub at y -2.05). live: rotors turning. squash as mainRotor.
function helicopter(g, craft, live, squash = 1) {
  const c = livery(craft);
  const tail = !(craft.down ?? craft.lost)?.tailless;
  if (tail) tailSection(g, craft, c, live);
  const boxy = craft.kind !== 'tourheli';
  if (craft.kind === 'attackheli') attackCabin(g, craft, c, tail);
  else if (craft.kind === 'policeheli' || craft.kind === 'gunheli') serviceCabin(g, craft, c, tail);
  else if (boxy) newsCabin(g, craft, c, tail);
  else tourCabin(g, craft, c, tail);
  mainRotor(g, craft, boxy ? m(0.25) : m(-0.15), m(-2.05), boxy && craft.kind !== 'attackheli' ? 4 : 2, live, squash);
}

// Police and SWAT (heat levels 2 and 3): the news ship's boxy cabin in service colours, its side
// door slid back so the gunner sits in the open doorway (craft.crew, set by the enemy lab). Police
// carry a chequered band, a searchlight pod under the nose and red and blue strobes; SWAT is slate grey,
// with tinted glass and a sensor ball.
function serviceCabin(g, craft, c, tail) {
  const police = craft.kind === 'policeheli';
  const live = craft.down === null && !craft.lost;
  if (!tail) stump(g, -1.2, -0.7, 0.6);
  g.fillStyle(c.body);
  g.fillEllipse(m(0.6), m(0.35), m(5.6), m(2.6));
  g.fillRect(m(-1.4), m(-0.9), m(4.2), m(2.4));
  quad(g, m(2.6), m(-0.9), m(3.9), m(-0.25), m(5), m(1), m(2.6), m(1.5));
  g.fillEllipse(m(-0.2), m(-1.1), m(3.6), m(1.1));
  g.fillStyle(c.trim);
  g.fillRect(m(-2), m(-1.25), m(0.55), m(0.35));
  // The lower hull in the service colour, sweeping up into the nose.
  g.fillStyle(c.accent);
  g.fillEllipse(m(0.6), m(1.2), m(5.4), m(0.9));
  g.fillRect(m(-1.4), m(0.6), m(4.2), m(0.9));
  quad(g, m(2.8), m(0.6), m(4.55), m(0.55), m(4.95), m(0.95), m(2.8), m(1.5));
  if (police) {
    // Chequered band along the waist.
    for (let i = 0, x = -1.4; x < 2.6; i++, x += 0.32) {
      g.fillStyle(i % 2 ? c.accent : c.mark);
      g.fillRect(m(x), m(0.36), m(0.32), m(0.24));
    }
  } else {
    g.fillStyle(c.mark);
    g.fillRect(m(-1.4), m(0.44), m(4.3), m(0.12));
  }
  // Windscreen, with a glint.
  g.fillStyle(c.glass);
  quad(g, m(2.3), m(-0.8), m(3.8), m(-0.15), m(4.7), m(0.65), m(2.3), m(0.65));
  g.fillStyle(0xe6eef2, 0.6);
  bar(g, m(2.8), m(-0.3), m(3.3), m(0.4), m(0.18));
  // The sliding door, run back over the rear cabin, its window catching the light.
  g.fillStyle(lerpColor(c.body, 0x000000, 0.12));
  g.fillRect(m(-1.3), m(-0.78), m(1.55), m(1.95));
  g.fillStyle(c.glass);
  g.fillRect(m(-1.1), m(-0.6), m(1.1), m(0.75));
  g.fillStyle(c.trim);
  g.fillRect(m(-1.3), m(-0.86), m(3.5), m(0.08));
  // The open doorway: the cabin inside (a little lighter on the gunship, so its dark-suited gunner
  // reads), the gunner on the bench at the sill.
  g.fillStyle(police ? 0x15181d : 0x3c4450);
  g.fillRect(m(0.3), m(-0.78), m(1.85), m(1.95));
  g.fillStyle(0x2a2f37);
  g.fillRect(m(0.3), m(0.65), m(1.85), m(0.18));
  if (craft.crew) crewman(g, craft, c);
  if (police) {
    // Searchlight pod under the nose, its lens lit.
    g.fillStyle(DARK);
    g.fillRect(m(3.5), m(1.35), m(0.22), m(0.4));
    g.fillRect(m(3.25), m(1.65), m(0.95), m(0.5));
    g.fillStyle(live ? 0xfff1b8 : 0x8a8a80);
    g.fillRect(m(4.2), m(1.68), m(0.18), m(0.44));
    if (live) {
      g.fillStyle(0xfff1b8, 0.35);
      g.fillCircle(m(4.35), m(1.9), m(0.45));
    }
  } else {
    // Sensor ball under the chin.
    g.fillStyle(DARK);
    g.fillRect(m(3.45), m(1.4), m(0.25), m(0.3));
    g.fillCircle(m(3.58), m(1.8), m(0.38));
    g.fillStyle(0x7a5a3a);
    g.fillCircle(m(3.78), m(1.76), m(0.15));
  }
  g.fillStyle(DARK);
  g.fillRect(m(0.1), m(-2), m(0.3), m(0.5));
  skids(g, -1.4, 3.2, [-0.6, 2.2]);
  if (!live) return;
  // Strobes: police alternate red and blue on the belly; SWAT shows a dim red one.
  const flip = Math.floor(craft.phase * 6) % 2;
  if (police) {
    const at = [[-1.2, 1.55, 0xff3b3b], [2.4, 1.55, 0x3b8bff]][flip];
    g.fillStyle(at[2], 0.35);
    g.fillCircle(m(at[0]), m(at[1]), m(0.5));
    g.fillStyle(at[2]);
    g.fillCircle(m(at[0]), m(at[1]), m(0.2));
  } else if (craft.phase * 1.1 % 1 < 0.1) {
    g.fillStyle(0xd23a3a);
    g.fillCircle(m(-1.2), m(1.55), m(0.16));
  }
}

// The army's attack chopper (heat level 4, from enemy-refs/level-4-army-vehicles.jpg): a slim
// fuselage tapering to a pointed nose, an engine hump with its exhaust behind the mast, a long
// stepped tandem canopy (gunner low in front, pilot behind and above), a stub wing carrying a rocket
// pod that glows as a salvo charges (craft.charge 0..1) and a missile rail, a chin gun turned along
// the aim (craft.crew), and long low skids.
function attackCabin(g, craft, c, tail) {
  const live = craft.down === null && !craft.lost;
  if (!tail) stump(g, -1.2, -0.5, 0.4);
  // Fuselage, nose and belly.
  g.fillStyle(c.body);
  g.fillEllipse(m(0.9), m(0.4), m(6.4), m(1.9));
  quad(g, m(-1.7), m(-0.45), m(3.4), m(-0.5), m(3.4), m(1.3), m(-1.7), m(1.05));
  g.fillTriangle(m(3.3), m(-0.5), m(5.2), m(0.65), m(3.3), m(1.3));
  g.fillStyle(c.accent);
  quad(g, m(-1.6), m(0.85), m(3.6), m(1.05), m(4.7), m(0.85), m(-1.6), m(1.2));
  // Engine hump behind the canopy, its intake and exhaust.
  g.fillStyle(c.body);
  g.fillEllipse(m(-0.5), m(-0.55), m(3), m(1.1));
  g.fillRect(m(-1.9), m(-0.95), m(2.2), m(0.7));
  g.fillStyle(c.trim);
  g.fillRect(m(-0.1), m(-0.95), m(0.45), m(0.35));
  g.fillCircle(m(-1.95), m(-0.6), m(0.3));
  g.fillStyle(0x15181d);
  g.fillCircle(m(-2.05), m(-0.6), m(0.17));
  // Tandem canopy: the pilot's pane higher at the back, the gunner's lower, sloping to the nose.
  g.fillStyle(c.glass);
  quad(g, m(0.45), m(-0.2), m(0.75), m(-1.05), m(1.95), m(-1.05), m(2.1), m(-0.2));
  quad(g, m(2), m(-0.2), m(2.25), m(-0.65), m(3.2), m(-0.6), m(4.1), m(0.2));
  g.fillRect(m(2), m(-0.2), m(2.1), m(0.4));
  g.fillStyle(c.trim);
  bar(g, m(0.75), m(-1.08), m(1.95), m(-1.08), m(0.12));
  bar(g, m(2), m(-1.05), m(2.05), m(0.2), m(0.13));
  bar(g, m(2.25), m(-0.66), m(3.2), m(-0.62), m(0.11));
  g.fillStyle(0x2a2f37, 0.8);
  g.fillCircle(m(1.3), m(-0.5), m(0.25));
  g.fillCircle(m(2.75), m(-0.15), m(0.23));
  g.fillStyle(0xe6eef2, 0.55);
  bar(g, m(1.05), m(-0.9), m(1.5), m(-0.9), m(0.12));
  bar(g, m(3.1), m(-0.4), m(3.6), m(0), m(0.12));
  // Stencil mark on the tail end of the fuselage.
  g.fillStyle(c.mark);
  g.fillRect(m(-1.3), m(0.1), m(0.45), m(0.14));
  // Stub wing, the rocket pod under it (tube mouths at the front) and a missile rail.
  g.fillStyle(c.accent);
  quad(g, m(-0.4), m(0.3), m(1.3), m(0.3), m(1.15), m(0.5), m(-0.3), m(0.5));
  g.fillStyle(0x30352a);
  g.fillRect(m(-0.55), m(0.55), m(1.75), m(0.55));
  g.fillCircle(m(1.2), m(0.825), m(0.275));
  g.fillStyle(0x1d2018);
  for (let i = 0; i < 2; i++) g.fillCircle(m(1.3), m(0.7 + i * 0.25), m(0.07));
  g.fillStyle(0x4a5038);
  g.fillRect(m(-0.55), m(0.6), m(1.75), m(0.1));
  g.fillStyle(DARK);
  g.fillRect(m(-0.2), m(1.15), m(1.2), m(0.1));
  g.fillStyle(0x3d4433);
  g.fillRect(m(-0.1), m(1.25), m(1.3), m(0.16));
  g.fillStyle(0x9a8a5a);
  g.fillRect(m(1.2), m(1.25), m(0.18), m(0.16));
  const charge = live ? craft.charge ?? 0 : 0;
  if (charge > 0) {
    const pulse = 0.6 + 0.4 * Math.sin(craft.phase * 30);
    g.fillStyle(0xff7a3a, 0.35 * charge * pulse);
    g.fillCircle(m(1.35), m(0.83), m(0.35 + 0.35 * charge));
    g.fillStyle(0xffd27a, charge * pulse);
    g.fillCircle(m(1.35), m(0.83), m(0.14));
  }
  // Chin gun: a turret ball under the nose, its barrel along the aim.
  const crew = craft.crew;
  const ax = crew?.aiming ? crew.aim.x * craft.dir : 1;
  const ay = crew?.aiming ? crew.aim.y : 0.35;
  const len = Math.hypot(ax, ay) || 1;
  g.fillStyle(DARK);
  g.fillCircle(m(3.55), m(1.2), m(0.3));
  bar(g, m(3.55), m(1.2), m(3.55 + ax / len * 1.25), m(1.2 + ay / len * 1.25), m(0.13));
  if (crew?.firing) {
    g.fillStyle(0xffe27a);
    g.fillCircle(m(3.55 + ax / len * 1.45), m(1.2 + ay / len * 1.45), m(0.28));
  }
  g.fillStyle(DARK);
  g.fillRect(m(0.1), m(-2), m(0.3), m(1));
  skids(g, -1.2, 3, [-0.5, 2.1]);
  if (live && craft.phase * 1.1 % 1 < 0.1) {
    g.fillStyle(0xd23a3a);
    g.fillCircle(m(-1.4), m(1), m(0.15));
  }
}

// The door gunner, seated on the sill and drawn at the helicopter's own scale like the tour
// passengers: head, body, thigh out over the sill, and the gun arm out along the aim (world aim,
// turned into the craft's facing). craft.crew: { aim, aiming, firing, flash, swat, skin }.
function crewman(g, craft, c) {
  const crew = craft.crew;
  const white = crew.flash ? 0xfff6d6 : null;
  const fill = color => g.fillStyle(white ?? color);
  const suit = crew.swat ? 0x252d44 : 0x1f2c50;
  // Legs out over the sill.
  fill(crew.swat ? 0x1d2437 : 0x19233f);
  g.fillRect(m(1.1), m(0.5), m(0.95), m(0.3));
  g.fillRect(m(1.85), m(0.6), m(0.28), m(0.75));
  fill(0x0f1218);
  g.fillRect(m(1.85), m(1.25), m(0.4), m(0.14));
  // Body, upright on the bench; a vest for SWAT.
  fill(suit);
  g.fillRect(m(0.9), m(-0.35), m(0.65), m(0.95));
  if (crew.swat) {
    fill(0x11151e);
    g.fillRect(m(0.95), m(-0.2), m(0.55), m(0.6));
  }
  // Head: helmet and visor for SWAT, a cap for police.
  fill(crew.swat ? 0x151a28 : crew.skin);
  g.fillCircle(m(1.25), m(-0.62), m(0.3));
  fill(crew.swat ? 0x151a28 : 0x141c33);
  g.fillRect(m(0.92), m(-0.98), m(0.66), m(0.24));
  if (crew.swat) {
    fill(0x8fa6b8);
    g.fillRect(m(1.3), m(-0.7), m(0.3), m(0.1));
  } else g.fillRect(m(1.5), m(-0.8), m(0.25), m(0.08));
  // The gun arm: out along the aim while aiming, else down across the lap.
  const ax = crew.aiming ? crew.aim.x * craft.dir : 0.8;
  const ay = crew.aiming ? crew.aim.y : 0.6;
  const len = Math.hypot(ax, ay) || 1;
  const ux = ax / len;
  const uy = ay / len;
  const sx = 1.4;
  const sy = -0.2;
  fill(suit);
  bar(g, m(sx), m(sy), m(sx + ux * 0.75), m(sy + uy * 0.75), m(0.22));
  fill(0x15171c);
  const gun = crew.sniper ? 1.7 : crew.swat ? 1.3 : 0.55;
  bar(g, m(sx + ux * (crew.swat ? 0.2 : 0.65)), m(sy + uy * (crew.swat ? 0.2 : 0.65)), m(sx + ux * (0.75 + gun)), m(sy + uy * (0.75 + gun)), m(0.16));
  if (crew.sniper) bar(g, m(sx + ux * 0.8), m(sy + uy * 0.8 - 0.17), m(sx + ux * 1.2), m(sy + uy * 1.2 - 0.17), m(0.12));
  if (crew.firing) {
    g.fillStyle(0xffe27a);
    g.fillCircle(m(sx + ux * (0.95 + gun)), m(sy + uy * (0.95 + gun)), m(0.3));
    g.fillStyle(0xfff6d3);
    g.fillCircle(m(sx + ux * (0.95 + gun)), m(sy + uy * (0.95 + gun)), m(0.12));
  }
}

// A jagged, charred stump where the boom tore off.
// side: which way the jagged edge points (-1 back, +1 forward).
function stump(g, x, y0, y1, side = -1) {
  g.fillStyle(CHAR);
  g.fillTriangle(m(x), m(y0), m(x + side * 0.6), m(y0 + 0.3), m(x), m(y1));
  g.fillTriangle(m(x), m((y0 + y1) / 2), m(x + side * 0.45), m(y1), m(x), m(y1));
}

// Flickering flames streaming back (-x) from (x, y), size px tall. up: a fire on the ground,
// licking upward instead.
function flames(g, x, y, size, clock, seed, up = false) {
  const tick = Math.floor(clock * 14);
  for (let i = 0; i < 4; i++) {
    const n = hash(i * 7 + tick + seed * 13);
    const len = size * (1.6 + 1.6 * n) * (1 - i * 0.15);
    const w = size * (0.45 - i * 0.07);
    g.fillStyle(i % 2 ? 0xffd27a : 0xff7a2a, 0.9);
    if (up) g.fillTriangle(x - w + i * size * 0.3, y, x + w + i * size * 0.3, y, x + i * size * 0.3 + (n - 0.5) * size, y - len);
    else g.fillTriangle(x, y - w + i * size * 0.15, x, y + w + i * size * 0.15, x - len, y + (n - 0.5) * size * 0.8);
  }
  g.fillStyle(0xfff1c2);
  g.fillCircle(x, y, size * 0.3);
}

// News: boxy cabin with a pointed nose, engine cowl, logo panel and a camera ball under the nose.
function newsCabin(g, craft, c, tail) {
  if (!tail) stump(g, -1.2, -0.7, 0.6);
  g.fillStyle(c.body);
  g.fillEllipse(m(0.6), m(0.35), m(5.6), m(2.6));
  g.fillRect(m(-1.4), m(-0.9), m(4.2), m(2.4));
  quad(g, m(2.6), m(-0.9), m(3.9), m(-0.25), m(5), m(1), m(2.6), m(1.5));
  // Engine cowl and exhaust.
  g.fillEllipse(m(-0.2), m(-1.1), m(3.6), m(1.1));
  g.fillStyle(c.trim);
  g.fillRect(m(-2), m(-1.25), m(0.55), m(0.35));
  // Belly band in the station colour, running into the nose.
  g.fillStyle(c.accent);
  g.fillRect(m(-1.4), m(0.95), m(4.2), m(0.35));
  g.fillTriangle(m(2.8), m(0.95), m(4.75), m(0.7), m(2.8), m(1.3));
  // Windscreen and door window, with a glint.
  g.fillStyle(GLASS);
  quad(g, m(2.3), m(-0.8), m(3.8), m(-0.15), m(4.7), m(0.65), m(2.3), m(0.65));
  g.fillRect(m(0.6), m(-0.6), m(1.4), m(1));
  g.fillStyle(0xe6eef2, 0.7);
  bar(g, m(2.8), m(-0.3), m(3.3), m(0.4), m(0.18));
  // Station logo panel on the rear cabin.
  g.fillStyle(c.logo);
  g.fillRect(m(-1.25), m(-0.6), m(1.55), m(1.05));
  g.fillStyle(c.mark);
  g.fillRect(m(-1.05), m(-0.4), m(1.15), m(0.22));
  g.fillRect(m(-0.58), m(-0.4), m(0.22), m(0.7));
  // Camera ball on its mount.
  g.fillStyle(DARK);
  g.fillRect(m(3.45), m(1.4), m(0.25), m(0.3));
  g.fillCircle(m(3.58), m(1.8), m(0.38));
  g.fillStyle(GLASS);
  g.fillCircle(m(3.78), m(1.76), m(0.15));
  g.fillStyle(DARK);
  g.fillRect(m(0.1), m(-2), m(0.3), m(0.5));
  skids(g, -1.4, 3.2, [-0.6, 2.2]);
}

// Tour: a low tub under a big glass bubble with the pilot and a passenger inside, and a thin boom.
function tourCabin(g, craft, c, tail) {
  if (!tail) stump(g, -1.2, -0.45, 0.25);
  g.fillStyle(c.body);
  g.fillEllipse(m(-0.6), m(-0.95), m(3.2), m(1.2));
  g.fillRect(m(-2), m(-0.6), m(1.9), m(1.8));
  g.fillEllipse(m(0.6), m(0.8), m(5.8), m(1.7));
  // The bubble, and who is in it.
  g.fillStyle(GLASS, 0.92);
  g.fillEllipse(m(1.9), m(0.15), m(4.2), m(2.9));
  g.fillStyle(DARK, 0.75);
  g.fillCircle(m(2.6), m(-0.35), m(0.32));
  g.fillRect(m(2.25), m(-0.05), m(0.7), m(0.9));
  g.fillCircle(m(1.1), m(-0.3), m(0.3));
  g.fillRect(m(0.8), m(0), m(0.6), m(0.85));
  g.fillStyle(0xffffff, 0.4);
  g.fillEllipse(m(2.9), m(-0.75), m(1.4), m(0.45));
  g.fillStyle(c.trim);
  bar(g, m(0.25), m(-1.15), m(0.45), m(1.2), m(0.14));
  // The tub's lip over the bubble's foot, with a stripe.
  g.fillStyle(c.body);
  g.fillEllipse(m(1.1), m(1.25), m(5.4), m(0.9));
  g.fillStyle(c.accent);
  g.fillRect(m(-1.8), m(1), m(4.6), m(0.18));
  g.fillStyle(DARK);
  g.fillRect(m(-0.3), m(-2), m(0.3), m(0.55));
  // A red beacon under the belly, blinking.
  if (craft.down === null && craft.phase * 1.4 % 1 < 0.14) {
    g.fillStyle(BEACON, 0.35);
    g.fillCircle(m(0.3), m(1.75), m(0.4));
    g.fillStyle(BEACON);
    g.fillCircle(m(0.3), m(1.75), m(0.16));
  }
  skids(g, -1.6, 3, [-0.7, 1.9]);
}

// A hit: a white-hot flash with sparks flying out. t 0..1 over its life.
function spark(g, x, y, t, seed) {
  g.fillStyle(0xffffff, 1 - t);
  g.fillCircle(x, y, 6 * (1 - t) + 1);
  g.fillStyle(0xffe08a, 1 - t);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + seed * 6;
    const r0 = 4 + t * 8;
    const r1 = 9 + t * 18;
    bar(g, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, 2 * (1 - t) + 0.5);
  }
}

// A crash fireball of several blobs swelling and rising under dark smoke. size: its scale (px).
function fireball(g, x, y, size, t, seed) {
  const blobs = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + seed * 6;
    const d = size * (0.3 + 0.5 * hash(i + seed * 9)) * (0.5 + t);
    const r = size * (0.45 + 0.35 * hash(i * 3 + 1 + seed)) * (0.5 + t * 0.8);
    blobs.push([x + Math.cos(a) * d, y - size * 0.35 - Math.abs(Math.sin(a)) * d * 0.8 - t * size * 0.5, r]);
  }
  g.fillStyle(0x3a332e, 0.6 * t * (1 - t));
  for (const [bx, by, r] of blobs) g.fillCircle(bx, by - r * 0.5, r * 1.2);
  g.fillStyle(0xff7a2a, 0.85 * (1 - t));
  for (const [bx, by, r] of blobs) g.fillCircle(bx, by, r);
  g.fillStyle(0xffd27a, (1 - t) ** 1.5);
  for (const [bx, by, r] of blobs) g.fillCircle(bx, by, r * 0.6);
  if (t < 0.15) {
    g.fillStyle(0xffffff, 1 - t / 0.15);
    g.fillCircle(x, y - size * 0.3, size * 0.7);
  }
}

// A high-wing light aircraft on fixed, spatted wheels, nose +x, drawn in m() units about its centre
// (tail cone to -4.25, spinner tip at 4.35, wing at y -1.05, wheels at y 1.4). live: still flying.
function lightPlane(g, craft, live) {
  const c = livery(craft);
  const down = craft.down;
  const landed = down?.landed;
  // Fin and rudder, with a body-coloured band; the tailplane seen edge-on.
  g.fillStyle(c.tail);
  quad(g, m(-3.0), m(-0.42), m(-3.85), m(-1.9), m(-4.3), m(-1.9), m(-4.25), m(-0.3));
  g.fillStyle(c.body);
  quad(g, m(-3.45), m(-1.15), m(-3.65), m(-1.5), m(-4.28), m(-1.5), m(-4.27), m(-1.15));
  g.fillStyle(SHADE);
  bar(g, m(-4.3), m(-0.12), m(-3.0), m(-0.1), m(0.16));
  // Tail cone tapering back from the cabin; cabin; cowl.
  g.fillStyle(c.body);
  quad(g, m(0.6), m(-0.95), m(-4.25), m(-0.38), m(-4.25), m(0.08), m(0.4), m(0.75));
  g.fillRect(m(-0.6), m(-0.95), m(2.6), m(1.7));
  quad(g, m(2), m(-0.95), m(2.9), m(-0.45), m(2.9), m(0.75), m(2), m(0.75));
  g.fillEllipse(m(3.2), m(0.1), m(1.9), m(1.15));
  // Belly shade and the cheat line running into the spinner.
  g.fillStyle(SHADE);
  quad(g, m(-4.25), m(0.0), m(0.4), m(0.55), m(3.6), m(0.55), m(3.6), m(0.7));
  g.fillStyle(c.stripe);
  bar(g, m(-4.2), m(-0.16), m(3.9), m(0.18), m(0.24));
  g.fillTriangle(m(3.95), m(-0.32), m(4.4), m(0.08), m(3.95), m(0.46));
  // Windscreen, side and rear windows, the pilot's head, a glint.
  g.fillStyle(GLASS);
  quad(g, m(2.0), m(-0.88), m(2.75), m(-0.45), m(2.75), m(-0.05), m(2.0), m(-0.05));
  g.fillRect(m(0.05), m(-0.8), m(1.75), m(0.62));
  g.fillTriangle(m(-0.5), m(-0.8), m(-0.1), m(-0.8), m(-0.1), m(-0.25));
  g.fillStyle(DARK, 0.7);
  g.fillCircle(m(1.45), m(-0.42), m(0.24));
  g.fillStyle(0xe6eef2, 0.7);
  bar(g, m(2.2), m(-0.75), m(2.45), m(-0.2), m(0.1));
  // The wing seen end-on as its aerofoil, the strut, and the exhaust stub.
  g.fillStyle(c.body);
  g.fillEllipse(m(0.75), m(-1.08), m(2.4), m(0.34));
  g.fillStyle(c.trim);
  g.fillRect(m(-0.35), m(-1.04), m(0.5), m(0.12));
  g.fillStyle(DARK);
  bar(g, m(1.05), m(-0.95), m(0.35), m(0.6), m(0.1));
  g.fillRect(m(2.75), m(0.62), m(0.35), m(0.12));
  // Main and nose gear in spats. A wreck has lost its nose wheel.
  bar(g, m(0.55), m(0.7), m(0.95), m(1.3), m(0.12));
  g.fillCircle(m(0.95), m(1.4), m(0.28));
  g.fillStyle(c.trim);
  g.fillEllipse(m(1.0), m(1.33), m(0.85), m(0.42));
  if (!landed) {
    g.fillStyle(DARK);
    g.fillRect(m(3.05), m(0.6), m(0.1), m(0.6));
    g.fillCircle(m(3.1), m(1.22), m(0.22));
  }
  // Fin-top beacon, blinking red; a white strobe at the wing tip.
  if (live && craft.phase * 1.2 % 1 < 0.12) {
    g.fillStyle(BEACON, 0.35);
    g.fillCircle(m(-3.95), m(-1.95), m(0.35));
    g.fillStyle(BEACON);
    g.fillCircle(m(-3.95), m(-1.95), m(0.13));
  }
  if (live && (craft.phase * 1.2 + 0.5) % 1 < 0.06) {
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(m(-0.4), m(-1.08), m(0.4));
  }
  propeller(g, craft, m(4.42), m(0.08), landed);
}

// A two-blade propeller seen edge-on: the disc is a thin upright blur, each blade foreshortened by
// the cosine of its angle. bent: crumpled back after a nose-in.
function propeller(g, craft, hx, hy, bent) {
  const r = m(1.0);
  g.fillStyle(DARK);
  if (bent) {
    bar(g, hx, hy, hx - m(0.35), hy - r * 0.8, m(0.14));
    bar(g, hx, hy, hx - m(0.45), hy + r * 0.55, m(0.14));
  } else {
    const fast = !craft.down;
    if (fast) {
      g.fillStyle(DARK, 0.16);
      g.fillEllipse(hx, hy, m(0.22), r * 2);
    }
    const reach = Math.cos(craft.rotor) * r;
    g.fillStyle(DARK, fast ? 0.8 : 1);
    bar(g, hx, hy - reach, hx, hy + reach, m(0.14));
  }
  g.fillStyle(DARK);
  g.fillRect(hx - m(0.06), hy - m(0.08), m(0.12), m(0.16));
}

// Airliners share one build: a tube with a rounded nose, a swept fin, a wing root, underslung
// engines and a row of windows. The jumbo adds its upper-deck hump and a second engine on the near
// wing (the far pair peeking out behind); the Beluga is a cargo freighter, a whale-backed hold over a
// low cockpit. engines: [x, y in radii] near wing, inboard first (the order they tear off);
// engineR: the nacelle's size; wing: [root front x, root back x, tip x].
export const LINERS = {
  jet: { length: 37, radius: 2, fin: 6, engines: [[1.5, 1.45]], engineR: 2, wing: [4, -7, -10], windows: true },
  jumbo: { length: 70, radius: 3.2, fin: 11, engines: [[8, 1.5], [-1.5, 1.3]], engineR: 2.9, wing: [12, -6, -16],
    windows: true, hump: true },
  beluga: { length: 56, radius: 2.7, fin: 9, engines: [[2.5, 1.45]], engineR: 2.6, wing: [7, -6, -12], bulge: true },
};

// Where the tail breaks off behind the cabin, and where the broken tail turns about.
function linerCut(spec) {
  return -spec.length / 2 + spec.radius * 3.2;
}
function tailPivot(spec) {
  return [linerCut(spec) - spec.radius * 1.4, -spec.radius * 1.5];
}
function enginePlace(spec, i) {
  const [x, y] = spec.engines[i];
  return [x, y * spec.radius];
}

// The Beluga's hold: an ellipse over the forward fuselage (centre x, y and half sizes) that tapers
// back to HOLD_TAIL above the tube at the cut.
function hold(spec) {
  const r = spec.radius;
  return { x: 6, y: -r * 0.9, w: 20.5, h: r * 1.45 };
}
const HOLD_TAIL = 1.4;

// A carrier's name along the fuselage: a row of letters from x0 to x1 (m), cap height h. Each
// letter is a stem and a bar or two, so the row reads as lettering, not windows.
function titles(g, x0, x1, y, h, seed) {
  const t = Math.max(0.16, h * 0.24);
  for (let x = x0, i = 0; x < x1; i++) {
    const w = Math.min(h * (0.55 + hash(seed * 31 + i) * 0.35), x1 - x);
    const shape = Math.floor(hash(seed * 17 + i) * 4);
    g.fillRect(m(x), m(y), m(t), m(h));
    if (shape !== 3) g.fillRect(m(x), m(y), m(w), m(t));
    if (shape === 0 || shape === 2) g.fillRect(m(x), m(y + h - t), m(w), m(t));
    if (shape === 1) g.fillRect(m(x), m(y + h / 2 - t / 2), m(w * 0.8), m(t));
    if (shape >= 2) g.fillRect(m(x + w - t), m(y), m(t), m(h));
    x += w + h * 0.3;
  }
}

// The fin, tailplane and tail cone, behind linerCut(). Drawn on its own when it breaks off.
function linerTail(g, spec, c) {
  const half = spec.length / 2;
  const r = spec.radius;
  const cut = -half + r * 3.2;
  // Swept fin with the carrier's mark.
  g.fillStyle(c.tail);
  quad(g, m(-half + 1.2), m(-r * 0.6), m(-half + 0.2), m(-r - spec.fin), m(-half + 2.4), m(-r - spec.fin), m(cut + 1.5), m(-r * 0.6));
  if (c.mark !== null) {
    const lx = m(-half + 2.6);
    const ly = m(-r - spec.fin * 0.5);
    const u = m(spec.fin * 0.17);
    g.fillStyle(c.mark);
    if (c.logo === 'sun') {
      g.fillCircle(lx, ly, u * 0.7);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        bar(g, lx + Math.cos(a) * u * 0.9, ly + Math.sin(a) * u * 0.9, lx + Math.cos(a) * u * 1.3, ly + Math.sin(a) * u * 1.3, u * 0.22);
      }
    } else if (c.logo === 'wave') {
      for (let i = 0; i < 2; i++) {
        const y = ly - u * 0.4 + i * u * 0.8;
        bar(g, lx - u, y, lx - u * 0.3, y - u * 0.35, u * 0.3);
        bar(g, lx - u * 0.3, y - u * 0.35, lx + u * 0.4, y, u * 0.3);
        bar(g, lx + u * 0.4, y, lx + u * 1.1, y - u * 0.35, u * 0.3);
      }
    } else if (c.logo === 'chevron') {
      for (let i = 0; i < 2; i++) {
        const x = lx - u * 0.6 + i * u * 0.75;
        quad(g, x, ly - u, x + u * 0.45, ly - u, x + u * 1.05, ly, x + u * 0.6, ly);
        quad(g, x + u * 0.6, ly, x + u * 1.05, ly, x + u * 0.45, ly + u, x, ly + u);
      }
    } else if (c.logo === 'star') {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        const b = a + Math.PI / 5;
        g.fillTriangle(lx + Math.cos(a) * u * 1.1, ly + Math.sin(a) * u * 1.1,
          lx + Math.cos(a - Math.PI / 5) * u * 0.42, ly + Math.sin(a - Math.PI / 5) * u * 0.42,
          lx + Math.cos(b) * u * 0.42, ly + Math.sin(b) * u * 0.42);
      }
      g.fillCircle(lx, ly, u * 0.45);
    } else if (c.logo === 'ring') {
      g.fillCircle(lx, ly, u * 1.05);
      g.fillStyle(c.tail);
      g.fillCircle(lx, ly, u * 0.72);
      g.fillStyle(c.mark);
      g.fillCircle(lx, ly, u * 0.32);
    } else if (c.logo === 'bars') {
      for (let i = -1; i <= 1; i++) bar(g, lx - u * 0.7 + i * u * 0.55, ly + u * 0.9, lx + u * 0.3 + i * u * 0.55, ly - u * 0.9, u * 0.28);
    } else if (c.logo === 'arrow') {
      bar(g, lx - u * 1.1, ly, lx + u * 0.4, ly, u * 0.4);
      g.fillTriangle(lx + u * 0.2, ly - u * 0.75, lx + u * 1.2, ly, lx + u * 0.2, ly + u * 0.75);
    } else if (c.logo === 'box') {
      quad(g, lx - u * 0.9, ly - u * 0.45, lx + u * 0.1, ly - u * 0.9, lx + u, ly - u * 0.45, lx, ly);
      g.fillStyle(lerpColor(c.mark, c.tail, 0.35));
      quad(g, lx - u * 0.9, ly - u * 0.45, lx, ly, lx, ly + u, lx - u * 0.9, ly + u * 0.5);
      g.fillStyle(lerpColor(c.mark, c.tail, 0.6));
      quad(g, lx, ly, lx + u, ly - u * 0.45, lx + u, ly + u * 0.5, lx, ly + u);
    } else if (c.logo === 'whale') {
      g.fillEllipse(lx, ly, u * 1.1, u * 0.65);
      g.fillTriangle(lx + u * 0.5, ly, lx + u * 1.3, ly - u * 0.45, lx + u * 1.3, ly + u * 0.45);
      g.fillStyle(c.tail);
      g.fillCircle(lx - u * 0.4, ly - u * 0.1, u * 0.15);
    } else {
      g.fillCircle(lx, ly, u);
      g.fillStyle(c.tail);
      g.fillCircle(lx + m(0.4), ly - m(spec.fin * 0.06), m(spec.fin * 0.12));
    }
  }
  // The Beluga's hold tapers down to the tail.
  if (spec.bulge) {
    g.fillStyle(c.body);
    quad(g, m(cut), m(-r - HOLD_TAIL), m(-half + 2.5), m(-r * 0.72), m(-half + 2.5), m(0), m(cut), m(0));
  }
  // 747 aerodynamic dorsal fin root fairing and dual split-rudder
  if (spec.hump) {
    g.fillStyle(c.tail);
    g.fillTriangle(m(cut + 1.5), m(-r * 0.6), m(cut + 7.5), m(-r * 0.85), m(cut + 1.5), m(-r * 0.95));
    g.fillStyle(DARK, 0.4);
    bar(g, m(-half + 1.8), m(-r * 0.6), m(-half + 1.8), m(-r - spec.fin), m(0.12));
    bar(g, m(-half + 0.8), m(-r - spec.fin * 0.52), m(-half + 2.2), m(-r - spec.fin * 0.52), m(0.12));
  }
  // The tail cone, its belly, and the APU exhaust at the tip.
  g.fillStyle(c.body);
  g.fillTriangle(m(-half), m(-r * 0.6), m(cut), m(-r), m(cut), m(r));
  g.fillStyle(c.belly);
  g.fillTriangle(m(-half + 0.3), m(-r * 0.35), m(cut), m(r * 0.55), m(cut), m(r));
  g.fillStyle(DARK);
  g.fillRect(m(-half - 0.3), m(-r * 0.65), m(0.5), m(0.35));
  // Tailplane, edge-on.
  g.fillStyle(SHADE);
  g.fillTriangle(m(-half + 0.5), m(-r * 0.3), m(-half - 1.5), m(-r * 0.7), m(-half + 4), m(-r * 0.3));

  if (spec.bulge) {
    // Airbus Beluga signature auxiliary endplate vertical fins on horizontal stabilizer tips
    g.fillStyle(c.tail);
    quad(g, m(-half + 0.8), m(-r * 0.3 - 2.8), m(-half + 2.2), m(-r * 0.3 - 2.8), m(-half + 2.8), m(-r * 0.3 + 1.2), m(-half + 0.2), m(-r * 0.3 + 1.2));
    g.fillStyle(c.stripe);
    bar(g, m(-half + 0.8), m(-r * 0.3 - 2.7), m(-half + 0.2), m(-r * 0.3 + 1.1), m(0.2));
    // Far endplate fin (visible in perspective)
    g.fillStyle(lerpColor(c.tail, DARK, 0.4));
    quad(g, m(-half - 1.6), m(-r * 0.7 - 2.4), m(-half - 0.4), m(-r * 0.7 - 2.4), m(-half), m(-r * 0.7 + 0.9), m(-half - 1.8), m(-r * 0.7 + 0.9));
  }
}

// An engine slung under the wing, centred on (x, y): nacelle, intake lip and the fan seen through it
// (one blade sweeping round), exhaust cone. turning: the fan is spinning.
function nacelle(g, craft, x, y, r, c, turning) {
  const w = r * 2.1;
  const h = r * 0.95;
  g.fillStyle(c.engine);
  g.fillEllipse(x, y, m(w), m(h));
  g.fillRect(x - m(w * 0.3), y - m(h / 2), m(w * 0.6), m(h));
  // Hot core exhaust cone at the rear
  g.fillStyle(0x353a40);
  g.fillTriangle(x - m(w * 0.45), y - m(h * 0.32), x - m(w * 0.45), y + m(h * 0.32), x - m(w * 0.68), y);
  g.fillStyle(0x1a1d20);
  g.fillTriangle(x - m(w * 0.48), y - m(h * 0.18), x - m(w * 0.48), y + m(h * 0.18), x - m(w * 0.65), y);
  // Reverse thrust cowl split line
  g.fillStyle(DARK, 0.55);
  bar(g, x - m(w * 0.05), y - m(h * 0.46), x - m(w * 0.05), y + m(h * 0.46), m(0.12));
  // The intake: polished silver intake lip ring around the dark fan face
  g.fillStyle(0xdbe3ea);
  g.fillEllipse(x + m(w * 0.44), y, m(0.65), m(h * 0.96));
  g.fillStyle(DARK);
  g.fillEllipse(x + m(w * 0.46), y, m(0.38), m(h * 0.74));
  // Titanium spinner cone with white vortex spiral
  g.fillStyle(0x1e2124);
  g.fillCircle(x + m(w * 0.47), y, m(h * 0.22));
  g.fillStyle(WHITE);
  g.fillCircle(x + m(w * 0.48), y, m(h * 0.07));
  if (turning) {
    const reach = Math.cos(craft.rotor) * m(h * 0.34);
    g.fillStyle(0x9aa2aa);
    g.fillRect(x + m(w * 0.46) - m(0.06), y - Math.abs(reach), m(0.12), Math.max(1, Math.abs(reach) * 2));
    const reach2 = Math.sin(craft.rotor) * m(h * 0.34);
    g.fillRect(x + m(w * 0.46) - m(0.06), y - Math.abs(reach2), m(0.12), Math.max(1, Math.abs(reach2) * 2));
  }
}

function airliner(g, craft) {
  const spec = LINERS[craft.kind];
  const half = spec.length / 2;
  const r = spec.radius;
  const c = livery(craft);
  const down = craft.down;
  const live = !down;
  const cut = linerCut(spec);
  const jet = craft.kind === 'jet';
  const torn = down?.torn ?? 0;
  const h = spec.bulge ? hold(spec) : null;
  if (!(down ?? craft.lost)?.tailless) linerTail(g, spec, c);
  // The jumbo's far-side engines peek out behind the near pair, in shadow.
  if (spec.hump) {
    const far = { ...c, engine: lerpColor(c.engine, DARK, 0.45) };
    for (const [x, y] of spec.engines) nacelle(g, craft, m(x + 1.3), m((y - 0.3) * r), spec.engineR * 0.92, far, !down?.landed);
  }
  // The tube and rounded nose, two-tone below the cheat line.
  g.fillStyle(c.body);
  g.fillRect(m(cut), m(-r), m(spec.length - r * 5.2), m(r * 2));
  g.fillEllipse(m(half - r * 2), 0, m(r * 4), m(r * 2));
  if (spec.hump) {
    // The upper deck: rising out of the nose and fairing back into the roof.
    g.fillEllipse(m(half - 14.5), m(-r * 0.75), m(27), m(r * 2.1));
    g.fillTriangle(m(half - 14.5), m(-r * 1.8), m(half - 38), m(-r * 0.97), m(half - 14.5), m(-r * 0.5));
  }
  if (spec.bulge) {
    // The hold: a whale-back from over the flight deck, tapering to the tail.
    g.fillEllipse(m(h.x), m(h.y), m(h.w * 2), m(h.h * 2));
    quad(g, m(h.x), m(h.y - h.h), m(cut), m(-r - HOLD_TAIL), m(cut), m(0), m(h.x), m(0));
    // The crease under the hold's forehead, over the flight deck.
    g.fillStyle(SHADE);
    for (let x = h.x + 9; x < h.x + h.w - 0.6; x += 0.5) {
      const y = h.y + h.h * Math.sqrt(1 - ((x - h.x) / h.w) ** 2);
      g.fillRect(m(x), m(y - 0.1), m(0.55), m(0.35));
    }
    // The upper cargo door's hinge seam, a band along the hold's flank and the carrier's name.
    g.fillStyle(DARK, 0.35);
    bar(g, m(h.x + 12.2), m(h.y - h.h * 0.76), m(h.x + 12.8), m(-r * 0.25), m(0.16));
    g.fillStyle(c.hold);
    g.fillRect(m(cut + 0.5), m(-r * 0.42), m(h.x + 13 - cut), m(0.55));
    g.fillStyle(c.title);
    titles(g, -10, 9, -r - 2.5, 2.1, craft.seed);
  }
  g.fillStyle(c.belly);
  g.fillRect(m(cut), m(r * 0.55), m(spec.length - r * 5.6), m(r * 0.45));
  if (c.belly !== SHADE) {
    g.fillRect(m(cut), m(r * 0.3), m(spec.length - r * 5.4), m(r * 0.3));
    g.fillEllipse(m(half - r * 2.2), m(r * 0.55), m(r * 3.2), m(r * 0.9));
  }
  // The cheat line, sweeping up past the flight deck.
  g.fillStyle(c.stripe);
  g.fillRect(m(cut), m(r * 0.2), m(spec.length - r * 5.4), m(0.3));
  if (jet) quad(g, m(half - r * 2.2), m(r * 0.2), m(half - r * 0.9), m(-r * 0.05), m(half - r * 0.75), m(r * 0.12), m(half - r * 2.2), m(r * 0.2 + 0.3));
  if (spec.hump) {
    g.fillStyle(c.title);
    titles(g, half - 29, half - 17, -r * 1.55, 0.8, craft.seed);
  }
  // Windows, the doors, and the flight deck.
  g.fillStyle(DARK);
  if (spec.windows) {
    for (let x = -half + r * 3.6; x < half - r * 2.6; x += 1.15) g.fillRect(m(x), m(-r * 0.25), m(0.45), m(0.4));
  }
  if (spec.hump) {
    // Upper deck passenger windows
    for (let x = half - 15; x < half - 6.5; x += 1.05) g.fillRect(m(x), m(-r * 1.38), m(0.48), m(0.42));
    // Upper deck emergency exit door
    g.fillStyle(DARK, 0.6);
    g.fillRect(m(half - 11), m(-r * 1.5), m(0.12), m(0.68));
    g.fillRect(m(half - 10.3), m(-r * 1.5), m(0.12), m(0.68));
  }
  const doors = jet ? [half - r * 2.3, cut + 1.2] : spec.hump ? [half - r * 2.6, half - 22, 2, -14, cut + 1.4] : [half - r * 2.5];
  const doorTop = spec.bulge ? -r * 0.15 : -r * 0.6;
  g.fillStyle(DARK, 0.55);
  for (const x of doors) {
    g.fillRect(m(x), m(doorTop), m(0.12), m(r * 1.05));
    g.fillRect(m(x + 0.85), m(doorTop), m(0.12), m(r * 1.05));
  }
  g.fillStyle(GLASS);
  if (spec.hump) {
    // Boeing 747 multi-pane flight deck cockpit windshield
    g.fillStyle(0x283038);
    quad(g, m(half - 5.8), m(-r * 1.55), m(half - 3.9), m(-r * 1.55), m(half - 2.7), m(-r * 1.12), m(half - 5.8), m(-r * 1.12));
    g.fillStyle(GLASS);
    quad(g, m(half - 4.8), m(-r * 1.5), m(half - 4.1), m(-r * 1.5), m(half - 2.9), m(-r * 1.15), m(half - 4.1), m(-r * 1.15));
    quad(g, m(half - 5.6), m(-r * 1.5), m(half - 4.9), m(-r * 1.5), m(half - 4.2), m(-r * 1.15), m(half - 5.6), m(-r * 1.15));
    g.fillStyle(WHITE, 0.6);
    bar(g, m(half - 5.2), m(-r * 1.45), m(half - 3.8), m(-r * 1.2), m(0.1));
    // Nose radome cone seam
    g.fillStyle(DARK, 0.35);
    bar(g, m(half - r * 1.4), m(-r * 0.4), m(half - r * 1.3), m(r * 0.5), m(0.12));
    // Underbelly lower cargo hold loading doors
    g.fillStyle(DARK, 0.45);
    g.fillRect(m(half - 18), m(r * 0.58), m(2.2), m(0.1));
    g.fillRect(m(half - 18), m(r * 0.58), m(0.1), m(0.8));
    g.fillRect(m(half - 15.8), m(r * 0.58), m(0.1), m(0.8));
    g.fillRect(m(-12), m(r * 0.58), m(2.0), m(0.1));
    g.fillRect(m(-12), m(r * 0.58), m(0.1), m(0.8));
    g.fillRect(m(-10), m(r * 0.58), m(0.1), m(0.8));
  } else if (spec.bulge) {
    // Airbus curved cockpit windscreen panes low on the nose below the cargo floor
    g.fillStyle(0x283038);
    quad(g, m(half - r * 1.8), m(-r * 0.05), m(half - r * 0.9), m(-r * 0.05), m(half - r * 0.55), m(r * 0.35), m(half - r * 1.8), m(r * 0.35));
    g.fillStyle(GLASS);
    quad(g, m(half - r * 1.7), m(-r * 0.02), m(half - r * 0.95), m(-r * 0.02), m(half - r * 0.6), m(r * 0.32), m(half - r * 1.7), m(r * 0.32));
    g.fillStyle(WHITE, 0.5);
    bar(g, m(half - r * 1.5), m(0), m(half - r * 0.8), m(r * 0.25), m(0.08));

    // Beluga whale face detailing (BelugaXL smile & whale eye)
    const eyeX = m(half - r * 2.8);
    const eyeY = m(-r * 0.75);
    g.fillStyle(c.trim);
    g.fillCircle(eyeX, eyeY, m(0.42));
    g.fillStyle(WHITE);
    g.fillCircle(eyeX - m(0.1), eyeY - m(0.1), m(0.18));
    // Cheerful smiling mouth line sweeping along cheek
    g.fillStyle(c.stripe);
    quad(g, m(half - r * 1.3), m(r * 0.48), m(half - r * 2.5), m(r * 0.38), m(half - r * 4.5), m(r * 0.3), m(half - r * 4.5), m(r * 0.42));
    quad(g, m(half - r * 4.5), m(r * 0.3), m(half - r * 6.5), m(r * 0.22), m(half - r * 6.5), m(r * 0.34), m(half - r * 4.5), m(r * 0.42));

    // Giant front upward cargo door latch line & lock pins
    g.fillStyle(DARK, 0.4);
    bar(g, m(half - r * 2.0), m(-r * 0.1), m(h.x + 12.5), m(-r * 0.25), m(0.14));
    for (let lx = half - r * 3.5; lx > h.x + 2; lx -= 2.2) g.fillRect(m(lx), m(-r * 0.18), m(0.25), m(0.25));
  } else quad(g, m(half - r * 1.55), m(-r * 0.6), m(half - r * 0.75), m(-r * 0.6), m(half - r * 0.4), m(-r * 0.15), m(half - r * 1.55), m(-r * 0.15));
  if ((down ?? craft.lost)?.tailless) stump(g, cut, spec.bulge ? -r - HOLD_TAIL : -r, r, -1);
  // The wing root, swept back, with the engines slung beneath it.
  const [front, back, tip] = spec.wing;
  g.fillStyle(SHADE);
  g.fillTriangle(m(front), m(r * 0.5), m(back), m(r * 0.5), m(tip), m(r * 1.5));
  if (spec.hump) {
    // 747 aerodynamic flap track fairing canoes under wing trailing edge
    g.fillStyle(DARK);
    for (const cx of [6, 0, -6]) bar(g, m(cx), m(r * 0.55), m(cx - 3.2), m(r * 1.35), m(0.45));
    // Canted vertical winglet at wingtip
    g.fillStyle(c.tail);
    quad(g, m(tip), m(r * 1.5), m(tip - 0.7), m(r * 1.5 - 2.4), m(tip + 0.3), m(r * 1.5 - 2.4), m(tip + 0.5), m(r * 1.5));
  }
  spec.engines.forEach(([x], i) => {
    const y = enginePlace(spec, i)[1];
    const top = y - spec.engineR * 0.45;
    g.fillStyle(SHADE);
    g.fillRect(m(x - 0.3), m(r * 0.6), m(0.6), m(top - r * 0.6 + 0.2));
    if (i < torn) {
      stump(g, x, r * 0.6, top + 0.2, 1);
      return;
    }
    nacelle(g, craft, m(x), m(y), spec.engineR, c, !down?.landed);
  });
  // Lights: red beacons top and belly, a white strobe at the wing tip.
  if (live && craft.phase * 1.1 % 1 < 0.1) {
    for (const y of [spec.hump ? -r * 1.05 : spec.bulge ? -r * 2.1 : -r, r]) {
      g.fillStyle(BEACON, 0.35);
      g.fillCircle(m(-2), m(y), m(0.7));
      g.fillStyle(BEACON);
      g.fillCircle(m(-2), m(y), m(0.25));
    }
  }
  if (live && (craft.phase * 1.1 + 0.5) % 1 < 0.05) {
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(m(tip), m(r * 1.5), m(1));
    g.fillStyle(0xffffff);
    g.fillCircle(m(tip), m(r * 1.5), m(0.3));
  }
}
