import { LIFT as SIZE } from './enemy-throw.js';
import { CIRCUMFERENCE, elevation, groundColors, isWater, lerpColor, shoreAhead, wrapX } from './planet.js';
import { CITY, CITY_BUILDINGS, LANDMARKS } from './city-art.js';
import { BRIDGE_DECK, streetRise } from './rivertown-art.js';
import { COMBAT, segmentBox } from './hero-combat.js';
import { sound } from './sound.js';
import { DRIFT, FADE, areaEnds } from './road-ends.js';
import { BUS_LIVERIES } from './bus-liveries.js';
import { RESPONSE_VEHICLES as DISPATCHED } from './response-vehicles.js';
import { drawPoliceBike } from './police-elite-art.js';

// Green City's life: walkers on the pavement, two lanes of traffic, and crowds that gather at the
// landmarks. Everything is sized from the hero, never from the buildings, so a car always reads as
// a car beside the hero. Walkers and cars only live around the view: they spawn just off screen and
// drop once they fall well behind it. Crowds are few and always kept.
// Muted colours keep the hero the most eye-catching thing (city-design-rules.md).
//
// The street reacts to the hero: a low, slow pass draws looks, waves and cheers; a RAM blasting
// past makes people duck and rocks cars. Ordinary movement and level 1 flight passes quietly, and
// nobody is knocked over in hero mode. Cars stop for a hero hovering in the road.
//
// Around that: pigeons on low rooftops and in the plaza and park that burst into the air as the hero
// comes close; buses that pull in at stops where a few people wait to board; and now and then a
// plane or helicopter crossing far behind the city. Walkers go in and out of building doors, and
// now and then it rains: umbrellas open, people hurry, and more of them duck inside.
// See game-design-rules/city-life-rules.md.
export const HERO_HEIGHT = 20; // game px, about 1.85 m standing
const METRE = HERO_HEIGHT / 1.85;
const PERSON = 1.75 * METRE;
const WALK_SPEED = 1.4 * METRE;
const VEHICLES = [
  { kind: 'sedan', length: 4.5 * METRE, height: 1.45 * METRE, weight: 4 },
  { kind: 'hatch', length: 3.9 * METRE, height: 1.5 * METRE, weight: 3 },
  { kind: 'taxi', length: 4.5 * METRE, height: 1.45 * METRE, weight: 1 },
  { kind: 'bus', length: 11 * METRE, height: 3 * METRE, weight: 1 },
];
// Buses pull in at a stop every STOP_SPACING px, wait DWELL seconds, and up to WAITING people
// queue at each stop. A stop only refills off screen, so nobody pops in.
const STOP_SPACING = 700;
const DWELL = 3;
const WAITING = 3;
const CRUISE = [7 * METRE, 10 * METRE];
const SAFE_GAP = 2 * METRE;
// Far lane drives left, near lane right. y is the drop below the ground line, for depth.
const LANES = [{ dir: -1, y: 1 }, { dir: 1, y: 2 }];
// Sparse between landmarks: one walker per this many px, one car per lane per this many px.
const WALKER_SPACING = 110;
const CAR_SPACING = 300;
// Spawn between SPAWN_NEAR and SPAWN_FAR past the view edge; drop past DESPAWN.
const SPAWN_NEAR = 60;
const SPAWN_FAR = 220;
// A fresh street's fill: FILL_STEPS steps (1/15 s at 120 Hz) of FILL_TRIES spawn tries.
const FILL_STEPS = 8;
const FILL_TRIES = 25;
const DESPAWN = 340;
// Busy hotspots: crowds that mill around a landmark.
const HOTSPOTS = { 'hero-plaza': [12, 90], 'city-hall': [7, 75], 'green-park': [14, 130], stadium: [16, 120] };
const CITY_MID = (CITY.from + CITY.to) / 2;

// Reactions. Reach is horizontal distance from the hero; altitude is the hero's height above ground.
// The hero hovers 11 px up at the lowest.
const NOTICE = { reach: 90, altitude: 175 };
// Only a slow hero draws looks; anything faster is gone before people notice.
const FAST = 150;
// RAM at ram speed makes the wake: people duck, cars rock.
const WAKE = { speed: COMBAT.ramMinSpeed, reach: 60, altitude: 69 };
const ROCK = { reach: 24, altitude: 60 };
// A car treats a hero hovering this low as something in the road.
const IN_ROAD = 30;
// Every road ends short of open water: ROAD_END px before the shore (road-ends.js). Cars ease down
// to PORTAL_ROLL px/s at the end and fade out; the same car fades back in at the road end across
// the water after the crossing time, and now and then another fades in (EXIT_GAP seconds apart), so
// no car ever makes a U-turn. SHORE_REACH: how far ahead a car looks.
// (car.tunnel and the exits' "mouth" keep their names from when these were tunnel portals.)
export const ROAD_END = 34;
const EXIT_GAP = [4, 10];
const PORTAL_ROLL = 16;
// Underpasses (this.underpasses: { x, dir }, x the tunnel mouth, dir pointing into the tunnel):
// instead of fading at a road end, cars keep their speed down a RAMP px ramp behind a retaining
// wall, DEPTH px below the road by the mouth, and are gone just past it under COVER px of ground;
// cars coming the other way climb out of it. (Ember Base's civilian underpass.)
const UNDERPASS = { ramp: 220, depth: 42, cover: 150 };
// Cars queued to fade in across the water: at most this many per road end; their crossing time is
// clamped to [1, 8] s.
const PORTAL_QUEUE = 3;
const OPEN_BRIDGES = [[BRIDGE_DECK.from, BRIDGE_DECK.to]];
// Driving: everyday braking (px/s²; harder only when a gap demands it), the kick an axle gets over a
// bridge joint, and how far the body pitches per px/s² of braking or acceleration (radians, the
// nose dives at most DRIVE.dive and the tail squats at most DRIVE.squat).
const DRIVE = { brake: 4 * METRE, joint: 16, pitch: 0.0008, dive: 0.08, squat: 0.03 };
// The Old Bridge is old and humped: traffic crosses at BRIDGE.speed, easing down at BRIDGE.ease
// px/s² from up to BRIDGE.look px out.
const BRIDGE = { speed: 5 * METRE, ease: 1.5 * METRE, look: 400 };
const SHORE_REACH = 2400;
// A car left over open water when a bridge deck falls (feedback issue #08) drops off the broken
// span with gravity, tumbling, splashes down and sinks over `sink` seconds. Cars within PANIC.reach
// heading for the collapse brake hard for PANIC.brake seconds, laying skid marks.
const FALL = { gravity: 320, sink: 1.8, splash: 0.9 };
// In evil mode PANIC.swerve of them instead swing round into the other lane, when it is clear, and
// race away at PANIC.rush times their cruising speed.
const PANIC = { reach: 480, brake: 1.8, swerve: 0.35, rush: 1.8 };
// Evil mode only; hero mode harms nobody. Something breaking within ALARM.reach px sends people
// running from it at ALARM.run times their pace for ALARM.flee seconds (ALARM.cower of them crouch
// where they stand instead), and cars heading for it brake hard. A falling piece landing
// on the street wrecks the cars under it and kills the people under it; people within
// ALARM.toss px of its footprint are thrown clear. WRECK.blow of crushed cars blow up after a
// WRECK.fuse delay, wrecking cars within WRECK.chain px and throwing people within WRECK.blast px.
// A fireball lasts WRECK.boom seconds, the fire WRECK.burn, and the smoke a while after.
const ALARM = { reach: 300, run: 3, flee: [2.5, 4.5], cower: 0.25, toss: 24 };
// Cars a little further off, within WRECK.shock px, are only hurt: the driver bails out and runs,
// the engine smokes, and the alarm flashes for WRECK.alarm seconds. A hurt car is
// stranded; the next hit finishes it. Half-cooking a car with the laser hurts it too.
const WRECK = { blow: 0.5, fuse: [0.15, 0.6], chain: 10, blast: 30, boom: 0.6, burn: 14, shock: 70, alarm: 8 };
const TOSS = { gravity: 420, down: [1.5, 3] };
// The hero's own attacks hit the street too (evil mode only). Cars and people are never aim
// targets: they are only hit when an attack passes through them. RAM within HERO.ramPad px bowls
// cars away and throws people; a fist within HERO.punchPad px launches a car along the punch at
// HERO.launch px/s (it wrecks where it lands, crushing what is there); a ground pound throws
// everything in its radius; the laser kills people and heats a car for HERO.cook seconds until it
// blows, the heat fading at HERO.cool per second off the beam.
// Boats take a fraction of each attack's padding: their hit boxes already follow the hull, so a
// fist or a RAM has to actually touch the ship.
const BOAT_PAD = 0.4;
const HERO = { ramPad: 10, punchPad: 6, launch: 240, ramToss: 120, punchToss: 130, cook: 0.8, cool: 0.5 };
const HOT = 0xff8a3c;
// The same attacks, and falling pieces, kill herd animals (thrown ones tumble and lie where they
// land, legs up) and hole boats: a holed boat lists and goes under over SINK seconds. The laser
// needs HERO.cook seconds on a boat, like a car.
const SINK = 3.5;
// How each kind of craft goes down once holed, and how long it takes (s). Anything not listed
// settles with a list over SINK seconds.
// - swamp: an inflatable or open canoe folds and swamps flat, wallowing, then slips under.
// - capsize: a sailing boat is knocked down; her rig lays over towards the water (seen side on, the
//   mast shortens as she rolls), then the hull settles under.
// - stern: a motor boat floods aft through her engine room: the stern drops, the bow rears up and
//   she slides under stern first.
// - bow: a cargo ship holed forward goes down by the head, stern and screw lifting clear.
// - founder: a laden tanker settles almost level, heavy and slow, burning on her own oil.
const SINKING = {
  dinghy: { time: 2.4, style: 'swamp' }, canoe: { time: 2.6, style: 'swamp' }, rowboat: { time: 3, style: 'stern' },
  yacht: { time: 9.0, style: 'capsize' }, sailboat: { time: 8.5, style: 'capsize' },
  trawler: { time: 10.5, style: 'stern' }, tug: { time: 11.0, style: 'stern' }, cutter: { time: 12.5, style: 'stern' },
  freighter: { time: 14.0, style: 'bow' }, tanker: { time: 16.0, style: 'founder' },
};
export const sinkTime = boat => SINKING[boat.kind]?.time ?? SINK;
// In evil mode the big ships break up pixel by pixel like the cruise liner: the first hit hands the
// ship to the scene (promoteShip), which bakes her into a destructible body that holes and sinks.
export const PIXEL_SHIPS = new Set(['freighter', 'tanker']);
const clamp01 = v => Math.max(0, Math.min(1, v));
const smoothstep = v => {
  const u = clamp01(v);
  return u * u * (3 - 2 * u);
};
// Grab and throw (enemy-throw.js): the hero lifts a person or a vehicle whose body is within the
// grab reach and hurls it. Sizes index LIFT_SIZES there (SIZE): a person, a car, a bus. A vehicle's
// blast grows with its length (LIFT.mass per px, read as the thrown body's max health), it tumbles
// at LIFT.spin rad/s, and it comes down a burnt-out wreck. A car bursting within LIFT.low px of the
// street sets off the cars and throws the people there. A person does not explode: thrown, they hit
// for LIFT.body damage, die where they land, and bowl over anyone within LIFT.bowl px of there.
// Let go, they drop, lie stunned, then get up and run.
// A boat is lifted off the water like a car and blows up the same way, leaving nothing. Let go
// over water it founders; over land it breaks up.
// Vehicles and boats share weight classes, set by length (weigh): up to LIFT.lengths[0] m is the
// car class, then the bus class, the building-piece class, and beyond LIFT.lengths[2] m (the tall
// ship) the airliner class.
const LIFT = { mass: 1.3, spin: 9, low: 24, body: 40, bowl: 14, tumble: 14, lengths: [7, 14, 24] };
const weigh = length => {
  const metres = length / METRE;
  return metres <= LIFT.lengths[0] ? SIZE.car : metres <= LIFT.lengths[1] ? SIZE.bus
    : metres <= LIFT.lengths[2] ? SIZE.rubble : SIZE.airliner;
};
// Scratch hit box, beam end and ground span, reused for every test.
const BOX = { x: 0, y: 0, width: 0, height: 0 };
const END = { x: 0, y: 0 };
const SPAN = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
// People who are not on their feet, and people a reaction never interrupts.
const HURT = new Set(['thrown', 'down', 'dead', 'held']);
const BUSY = new Set(['board', 'enter', 'exit', 'flee', ...HURT]);
const CHAR = 0x26221f;

// Pigeons, about 30 cm. A flock takes off when the hero comes within startle px (plus its spread)
// and height px of the perch, or rushes past within rush px; it flies off and only settles back
// once its perch is off screen, regroup seconds later.
const BIRD = { flock: [4, 8], startle: 70, rush: 140, height: 60, regroup: 12, roofs: 0.35 };
const BIRD_COLORS = [0x6b7078, 0x7d838b, 0x5d636b, 0xa9aeb4];
const GROUND_FLOCKS = ['hero-plaza', 'green-park'];
// Sky traffic flies far behind the city: background, so flat, pale and small rather than
// hero-scaled. One crossing at a time, SKY_GAP seconds apart.
const AIRCRAFT = {
  plane: { length: 34, altitude: [380, 470], speed: 70 },
  helicopter: { length: 16, altitude: [190, 280], speed: 38 },
};
const SKY_GAP = [12, 28];
// Doors: a back-pavement walker passing one goes in with this chance (more in the rain); each door
// on screen lets someone out every EXIT_GAP seconds while the street has room. Fading in or out
// takes FADE seconds.
const DOOR = { enter: 0.15, enterRain: 0.4, exitGap: [14, 40], fade: 0.4 };
// Weather: dry spells and showers of these lengths (seconds); rain eases in and out over ~4 s.
// ponytail: weather lives here while it is only rain over the city; give it its own module when
// snow, storms or regional weather arrive.
const WEATHER = { dry: [60, 150], rain: [30, 60], umbrellas: 0.7, hurry: 1.25 };
const UMBRELLAS = [0x3e4652, 0x5f6b78, 0x4f6a86, 0x7a4f4a, 0x2f3540, 0x6f7d5c];

const SKIN = [0xf0c8a4, 0xd9a47a, 0xb07a52, 0x7a5136];
const HAIR = [0x2b2420, 0x5a3e2b, 0x8a6a3a, 0xbdb5a8];
const SHIRT = [0x6f8796, 0x8a7f73, 0x5d6f63, 0x9a8a8a, 0x7a6f8f, 0xa89c84, 0x6c7a8a, 0x8f6f66];
const PANTS = [0x3e4652, 0x4b4a46, 0x5a5e66, 0x2f3540, 0x6b6253];
const PAINT = [0xc3c8cd, 0x5f6b78, 0x8c4f4a, 0x4f6a86, 0xe2e2dc, 0x3a3f46, 0x6f7d5c];
const TAXI = 0xd6b04c;
const POLICE_DOOR = 0x1f2c50;
// The vehicles heat sends (dispatch), in metres. tough: punches or RAM passes to knock it over (the
// last one launches it, as any car). heavy: lifted only with building pieces. pace: its share of
// the police car's rush.
// swat: heat level 2's van, a tall black box with slit windows (enemy-refs/level-2-swat.jpg).
// armoured: heat level 3's truck, gunmetal. apc: heat level 4's eight-wheeler, olive, with a roof
// cannon. tank: heat level 4's, low on its tracks, slow, turret mounted by the enemy lab.
// Debris impacts leave the vehicle body at full size, tilted on its suspension, with rubble
// on its roof and glass and metal on the road.
const CRUSH = { sag: 0.12, rubble: 3, bits: 8 };
// Drawn by drawArmoured.
const ARMOURED = new Set(['policevan', 'swat', 'armoured', 'apc']);
const GLASS = 0x9fb8c6;
const TYRE = 0x25282d;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const pick = (list, r) => list[Math.floor(r * list.length)];

// A pen that draws everything at a fraction of its alpha, for people fading through a doorway.
function faded(g, alpha) {
  return { fillStyle: (color, a = 1) => g.fillStyle(color, a * alpha), fillRect: (...args) => g.fillRect(...args) };
}

// A pen that passes every fill through style(color, alpha) => [color, alpha], to fade or char a
// whole vehicle drawn with it.
export function restyled(g, style) {
  return new Proxy(g, {
    get: (target, key) => key === 'fillStyle' ? (color, a = 1) => target.fillStyle(...style(color, a))
      : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
  });
}

// Tilts a vehicle about its base centre to match the road, so both wheels sit on hills.
// The caller restores the canvas after drawing.
// Brake lights burn while a car is actually slowing or stands still, not merely while it is slow.
export function braking(car) {
  return car.braking ?? car.speed < car.cruise * 0.6;
}

// A tyre and hub, with a spoke glint that turns as the car rolls (roll: px travelled, signed).
export function wheelAt(g, wx, wy, radius, roll = 0) {
  g.fillStyle(TYRE);
  g.fillCircle(wx, wy, radius);
  g.fillStyle(0x9aa3ab);
  g.fillCircle(wx, wy, Math.max(1, radius / 2.5));
  const a = roll / radius;
  const r = Math.max(1, radius - 1);
  g.fillStyle(0x4a5058);
  g.fillRect(Math.round(wx + Math.cos(a) * r) - 0.5, Math.round(wy + Math.sin(a) * r) - 0.5, 1, 1);
}

// pitch adds the body's own lean on its springs (car.pitch: braking and pulling away).
export function tiltWithRoad(g, groundAt, x, base, length, pitch = 0) {
  g.save();
  g.translateCanvas(x, base);
  g.rotateCanvas(Math.atan2(groundAt(x + length / 2) - groundAt(x - length / 2), length) + pitch);
  g.translateCanvas(-x, -base);
}

export class CityLife {
  constructor(random = Math.random) {
    this.random = random;
    this.walkers = [];
    this.cars = [];
    this.crowds = [];
    this.clock = 0;
    this.aircraft = null;
    this.skyTimer = SKY_GAP[0];
    this.intact = true;
    this.rain = 0;
    this.raining = false;
    this.weatherTimer = WEATHER.dry[0];
    // Planet copy the view is on; a change means the view jumped and the street refills.
    this.shift = null;
    // Bridge decks ([from, to] world x) that carry traffic over water: Rivertown's Old Bridge while
    // it stands (see setBridges).
    this.bridges = OPEN_BRIDGES;
    this.bridgeDecks = [BRIDGE_DECK];
    this.brokenBridgeDecks = [];
    // The city's own road ends ([west, east] x), where its traffic fades out and new traffic fades
    // in (road-ends.js).
    this.ends = areaEnds(CITY.from, CITY.to);
    // The city's west end runs under Ember Base, across the planet's seam: an underpass.
    this.underpasses = this.ends[0] === null ? [] : [{ x: this.ends[0], dir: -1 }];
    // Side roads at the road's dead ends ({ x, dir }, dir pointing at the dead end), found lazily
    // from the terrain and the area's own ends (refreshExits).
    this.exits = null;
    // Whether a deck people stand on (a pier) still holds them, by building id. The map lab wires
    // this to evil mode's destruction; free roam never breaks anything.
    this.deckUp = () => true;
    this.view = null;
    // Herd animals and boats belong to the areas that have them; evil mode's casualties live here.
    this.herds = [];
    this.boats = [];
    this.sunk = [];
    // Craft that never leave their mooring but can sink (the forest's seaplane).
    this.moored = [];
    // Other creatures an area lists so evil mode can kill them:
    // { list(): the live array, draw(g, item, groundAt), width, height (hit box on the ground or
    // water at its x), x(item)?, lift(item)? (px above that, for things in the air), alive(item)?,
    // corpse(item)? (a draw(g, groundAt) frozen at death), onKill(item)?, onRestore(item)?,
    // hit(item, vx, vy)? (handles every blow itself, dying or not, instead of becoming a body),
    // transient? (short-lived, such as a leaping fish: never put back) }.
    this.cast = [];
    this.bodies = [];
    this.boatDebris = [];
    this.boatSparks = [];
    this.boatSplashes = [];
    this.boatSmokes = [];
    // Called with (world x, power 0..1) when a car blows up, so the scene can damage what is near.
    this.onBlast = null;
    let seed = 1;
    for (const landmark of LANDMARKS) {
      const [count, reach] = HOTSPOTS[landmark.id] ?? [0, 0];
      for (let i = 0; i < count; i++, seed++) {
        const person = this.person(landmark.x + (hash(seed) - 0.5) * 2 * reach, hash(seed + 0.3));
        person.home = [landmark.x - reach, landmark.x + reach];
        person.state = 'idle';
        person.timer = hash(seed + 0.6) * 4;
        this.crowds.push(person);
      }
    }
    this.flocks = [];
    for (const building of CITY_BUILDINGS) {
      if (!building.roof || hash(building.seed * 7) >= BIRD.roofs) continue;
      this.flocks.push({ x: building.x, height: building.roof - 2, spread: building.width * 0.3, seed: building.seed });
    }
    for (const id of GROUND_FLOCKS) {
      const landmark = LANDMARKS.find(l => l.id === id);
      this.flocks.push({ x: landmark.x + landmark.clear * 0.6, height: 0, spread: 24, seed: landmark.x });
    }
    for (const flock of this.flocks) this.settle(flock);
    this.doors = CITY_BUILDINGS.filter(building => building.door).map(building => ({ x: building.x, timer: hash(building.x) * 10 }));
    this.stops = [];
    for (let slot = CITY.from + 300; slot < CITY.to - 300; slot += STOP_SPACING) {
      // Slide a stop that lands in a landmark's clear space along to the next free street.
      let x = slot;
      while (x < slot + STOP_SPACING / 2 && LANDMARKS.some(l => Math.abs(l.x - x) < l.clear + 40)) x += 20;
      if (x >= slot + STOP_SPACING / 2 || x >= CITY.to - 300) continue;
      const stop = { x, timer: 0 };
      this.stops.push(stop);
      for (let i = 0; i < 2; i++, seed++) this.crowds.push(this.waiter(stop, hash(seed + 0.9)));
    }
  }

  // The world x this area's street runs between; areas with their own span override it.
  get streetSpan() {
    return [CITY.from, CITY.to];
  }

  // Dev panel: puts a car, a person or a crowd of 8 on the street at world x. False when x is not
  // on this area's street (or the area has not been in view yet).
  spawnAt(worldX, what) {
    if (this.shift === null) return false;
    const x = worldX - this.shift;
    if (x < this.streetSpan[0] || x > this.streetSpan[1]) return false;
    if (what === 'car') this.cars.push(this.car(x, this.random() < 0.5 ? 0 : 1));
    else for (let i = what === 'crowd' ? 8 : 1; i > 0; i--) this.walkers.push(this.person(x + (this.random() - 0.5) * (what === 'crowd' ? 60 : 0)));
    return true;
  }

  // Someone queuing at a bus stop.
  waiter(stop, r = this.random()) {
    const person = this.person(stop.x + (r - 0.5) * 20, r);
    Object.assign(person, { stop, home: [stop.x - 10, stop.x + 10], state: 'idle', timer: 1 + r * 4 });
    return person;
  }

  // A flock back on its perch, pecking about.
  settle(flock) {
    const count = BIRD.flock[0] + Math.floor(this.random() * (BIRD.flock[1] - BIRD.flock[0] + 1));
    flock.state = 'perched';
    flock.birds = Array.from({ length: count }, () => ({
      dx: (this.random() - 0.5) * 2 * flock.spread, dir: this.random() < 0.5 ? -1 : 1,
      phase: this.random() * 6, color: pick(BIRD_COLORS, this.random()),
    }));
  }

  // Each bird takes off away from the hero, climbing.
  scatter(flock, fromX) {
    flock.state = 'flying';
    flock.timer = 6;
    for (const bird of flock.birds) {
      const x = flock.x + bird.dx;
      bird.x = x;
      bird.h = flock.height;
      bird.dir = Math.sign(x - fromX) || (this.random() < 0.5 ? -1 : 1);
      bird.vx = bird.dir * (30 + this.random() * 40);
      bird.vy = 40 + this.random() * 40;
    }
  }

  // Evil mode breaks buildings, so rooftop flocks take flight and doors close until it ends.
  // Entering, leaving or rebuilding it clears wrecks and casualties.
  setBuildingsIntact(on) {
    this.cars = this.cars.filter(car => !car.wreck && car.hurt === undefined);
    this.walkers = this.walkers.filter(person => !HURT.has(person.state));
    for (const person of this.crowds) {
      if (HURT.has(person.state) || person.state === 'flee') Object.assign(person, { state: 'idle', timer: 1, angle: 0 });
      // Back onto the rebuilt deck.
      if (person.deck && person.offDeck) {
        Object.assign(person, { offDeck: false, lift: person.deckLift, air: null, x: (person.home[0] + person.home[1]) / 2 });
      }
    }
    for (const body of this.bodies) body.restore?.();
    this.bodies = [];
    this.boatDebris = [];
    this.boatSparks = [];
    this.boatSplashes = [];
    this.boatSmokes = [];
    this.boats.push(...this.sunk);
    this.sunk = [];
    for (const boat of [...this.boats, ...this.moored]) {
      if (boat.sink !== undefined || boat.promoted || boat.holes) Object.assign(boat, { sink: undefined, promoted: false, burn: 0, turn: 0, pause: 0, holes: undefined });
    }
    this.intact = on;
    if (on) return;
    for (const flock of this.flocks) if (flock.height > 0 && flock.state === 'perched') this.scatter(flock, flock.x - 1);
  }

  person(x, r = this.random()) {
    // Adults only: the street takes harm in evil mode, and people can be thrown.
    return {
      x, dir: r < 0.5 ? -1 : 1, lane: hash(r * 91) < 0.5 ? 0 : 1, state: 'walk', timer: 2 + hash(r * 37) * 6,
      height: Math.round(PERSON * (0.92 + hash(r * 13) * 0.14)),
      speed: WALK_SPEED * (0.8 + hash(r * 17) * 0.4), phase: hash(r * 23) * 6,
      // Unflappable people never duck; a RAM blasting past just stops them to watch.
      calm: hash(r * 29) < 0.4,
      // Busy people walk on past a hovering hero without looking up.
      busy: hash(r * 31) < 0.1,
      umbrella: hash(r * 41) < WEATHER.umbrellas ? pick(UMBRELLAS, hash(r * 43)) : null,
      skin: pick(SKIN, hash(r * 3)), hair: pick(HAIR, hash(r * 5)), shirt: pick(SHIRT, hash(r * 7)), pants: pick(PANTS, hash(r * 11)),
    };
  }

  // Heat: a police car races in from world x and pulls up at world x `to`, lights flashing. Once it
  // stands still it calls onDeploy(worldX, car) and stays parked in its lane. False off this street.
  // kind: any of DISPATCHED (a SWAT van, an armoured truck, an APC, a tank).
  dispatch(worldX, to, kind = 'police') {
    if (this.shift === null || this.noRoads) return false;
    const x = worldX - this.shift;
    const stop = to - this.shift;
    const [from, end] = this.streetSpan;
    const spec = DISPATCHED[kind];
    if (!spec || stop < from || stop > end || isWater(to, this.bridges)) return false;
    // The offscreen entry may be in a lake or across a river. Enter on the stop's bank, with
    // room for the whole vehicle, instead of spawning in water and sinking before deployment.
    const half = spec.length * METRE / 2;
    const start = Math.max(from + half, this.roadEnd(stop, -1) + half + 1);
    const finish = Math.min(end - half, this.roadEnd(stop, 1) - half - 1);
    if (stop < start || stop > finish) return false;
    const lane = LANES.findIndex(({ dir }) => dir === (Math.sign(stop - x) || 1));
    const cruise = CRUISE[1] * PANIC.rush * (spec.pace ?? 1);
    this.cars.push({ x: Math.max(start, Math.min(finish, x)), lane, kind, length: spec.length * METRE, height: spec.height * METRE,
      paint: spec.paint, tough: spec.tough ?? 1, heavy: spec.heavy, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0,
      dwell: 0, dispatch: stop, deployed: false,
      // Stable passenger identities count once whether killed aboard or after deployment.
      occupants: Array.from({ length: spec.crew }, () => ({})) });
    return true;
  }

  car(x, lane) {
    const total = VEHICLES.reduce((sum, v) => sum + v.weight, 0);
    let roll = this.random() * total;
    const type = VEHICLES.find(v => (roll -= v.weight) < 0) ?? VEHICLES[0];
    const cruise = CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0]);
    // Towns that share this traffic set busLivery to run their buses in their own colours.
    const livery = type.kind === 'bus' ? this.busLivery ?? BUS_LIVERIES.greenCity : undefined;
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0,
      dwell: 0, livery, paint: type.kind === 'taxi' ? TAXI : livery ? livery.body : pick(PAINT, this.random()) };
  }

  // left/right: the view's world span this frame. hero: { x, vx, vy, altitude, ram } in world space.
  step(dt, left, right, hero = null) {
    this.clock += dt;
    this.stepWeather(dt);
    const shift = Math.round(((left + right) / 2 - CITY_MID) / CIRCUMFERENCE) * CIRCUMFERENCE;
    const from = left - shift;
    const to = right - shift;
    if (shift !== this.shift) {
      this.walkers = [];
      this.cars = [];
    }
    const firstFill = shift !== this.shift || !this.walkers.length && !this.cars.length;
    this.shift = shift;
    const local = hero && { ...hero, x: hero.x - shift, speed: Math.hypot(hero.vx, hero.vy) };
    for (const person of this.crowds) this.stepPerson(person, dt, local);
    this.crowds = this.crowds.filter(person => !person.boarded);
    if (to < CITY.from - DESPAWN || from > CITY.to + DESPAWN) {
      this.walkers = [];
      this.cars = [];
      this.aircraft = null;
      return;
    }
    this.stepBirds(dt, from, to, local);
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
    const span = [Math.max(CITY.from, from - SPAWN_FAR), Math.min(CITY.to, to + SPAWN_FAR)];
    const wanted = (spacing) => Math.max(0, span[1] - span[0]) / spacing;
    const inSpan = item => item.x >= span[0] && item.x <= span[1];
    // Counted, not filtered: these run every step, and up to 200 times on a fresh street.
    let walkersInSpan = 0;
    for (const person of this.walkers) if (inSpan(person)) walkersInSpan++;
    // ponytail: one walker and one car per lane per step tops up fast enough even at mega-speed.
    for (let tries = fill || 1; tries > 0; tries--) {
      if (walkersInSpan >= wanted(WALKER_SPACING)) break;
      const x = this.spawnX(zones, 20);
      if (x === null) continue;
      const person = this.person(x);
      this.walkers.push(person);
      if (inSpan(person)) walkersInSpan++;
    }
    for (const lane of LANES.keys()) {
      let carsInSpan = 0;
      for (const car of this.cars) if (car.lane === lane && inSpan(car)) carsInSpan++;
      for (let tries = fill || 1; tries > 0; tries--) {
        if (carsInSpan >= wanted(CAR_SPACING)) break;
        const x = this.spawnX(zones, 0);
        if (x === null) continue;
        const car = this.car(x, lane);
        if (!this.roomToSpawn(car)) continue;
        if (this.cars.every(other => other.lane !== lane || Math.abs(other.x - x) > (other.length + car.length) / 2 + SAFE_GAP)) {
          this.cars.push(car);
          if (inSpan(car)) carsInSpan++;
        }
      }
    }
  }

  // Spawn tries this step. A fresh street fills its whole view over FILL_STEPS steps of FILL_TRIES
  // tries each (0 once done): one 200-try burst built hundreds of throwaway cars in a single step,
  // a 10+ ms hitch whenever the view entered a town.
  fillTries(fresh) {
    if (fresh) this.fillSteps = FILL_STEPS;
    if (!(this.fillSteps > 0)) return 0;
    this.fillSteps--;
    return FILL_TRIES;
  }

  // A random x inside the spawn zones and the city, or null if they miss the city.
  spawnX(zones, inset) {
    const parts = zones.map(([a, b]) => [Math.max(a, CITY.from + inset), Math.min(b, CITY.to - inset)]).filter(([a, b]) => b > a);
    const total = parts.reduce((sum, [a, b]) => sum + b - a, 0);
    if (!total) return null;
    let roll = this.random() * total;
    for (const [a, b] of parts) {
      if (roll < b - a) return a + roll;
      roll -= b - a;
    }
    return null;
  }

  stepBirds(dt, from, to, hero) {
    for (const flock of this.flocks) {
      const near = flock.x > from - DESPAWN && flock.x < to + DESPAWN;
      const onScreen = flock.x + flock.spread > from - 30 && flock.x - flock.spread < to + 30;
      if (flock.state === 'perched') {
        if (!near) continue;
        for (const bird of flock.birds) bird.phase += dt * (2 + bird.phase % 1);
        if (!hero) continue;
        const dx = Math.abs(hero.x - flock.x);
        const dy = Math.abs(hero.altitude - flock.height);
        if (dx < BIRD.startle + flock.spread && dy < BIRD.height
          || hero.speed >= FAST && dx < BIRD.rush && dy < BIRD.height * 2) this.scatter(flock, hero.x);
      } else if (flock.state === 'flying') {
        for (const bird of flock.birds) {
          bird.x += bird.vx * dt;
          bird.h += bird.vy * dt;
          // Climb hard at first, then level off into a steady glide.
          bird.vy += (12 - bird.vy) * (1 - Math.exp(-0.8 * dt));
          bird.phase += dt * 14;
        }
        flock.timer -= dt;
        if (flock.timer <= 0 || !near) Object.assign(flock, { state: 'gone', timer: BIRD.regroup });
      } else {
        flock.timer -= dt;
        if (flock.timer <= 0 && !onScreen && (this.intact || flock.height === 0)) this.settle(flock);
      }
    }
  }

  // Showers come and go; rain eases in and out rather than switching.
  stepWeather(dt) {
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.raining = !this.raining;
      const [low, high] = this.raining ? WEATHER.rain : WEATHER.dry;
      this.weatherTimer = low + this.random() * (high - low);
    }
    this.rain += ((this.raining ? 1 : 0) - this.rain) * (1 - Math.exp(-dt / 4));
  }

  // Doors on screen let someone out now and then, if the street has room for one more.
  stepDoors(dt, from, to) {
    if (!this.intact) return;
    const wanted = (to - from + 2 * SPAWN_FAR) / WALKER_SPACING * 1.25;
    for (const door of this.doors) {
      if (door.x < from || door.x > to) continue;
      door.timer -= dt;
      if (door.timer > 0) continue;
      door.timer = DOOR.exitGap[0] + this.random() * (DOOR.exitGap[1] - DOOR.exitGap[0]);
      if (this.walkers.length >= wanted) continue;
      const person = this.person(door.x);
      Object.assign(person, { lane: 0, state: 'exit', timer: DOOR.fade, fade: 0, door });
      this.walkers.push(person);
    }
  }

  // The door a walker stepped past this frame, if any.
  doorBetween(a, b) {
    const [low, high] = a < b ? [a, b] : [b, a];
    return this.doors.find(door => door.x > low && door.x <= high);
  }

  // Stops refill their queue while off screen.
  stepStops(dt, from, to) {
    for (const stop of this.stops) {
      stop.timer -= dt;
      if (stop.timer > 0 || stop.x > from - 40 && stop.x < to + 40) continue;
      stop.timer = 8 + this.random() * 8;
      if (this.crowds.filter(person => person.stop === stop && person.state !== 'board').length < WAITING) {
        this.crowds.push(this.waiter(stop));
      }
    }
  }

  stepSky(dt, from, to) {
    const plane = this.aircraft;
    if (plane) {
      plane.x += plane.dir * plane.speed * dt;
      plane.rotor = (plane.rotor ?? 0) + dt;
      if (plane.x < from - DESPAWN * 2 || plane.x > to + DESPAWN * 2) this.aircraft = null;
      return;
    }
    this.skyTimer -= dt;
    if (this.skyTimer > 0) return;
    this.skyTimer = SKY_GAP[0] + this.random() * (SKY_GAP[1] - SKY_GAP[0]);
    const kind = this.random() < 0.6 ? 'plane' : 'helicopter';
    const { length, altitude, speed } = AIRCRAFT[kind];
    const dir = this.random() < 0.5 ? -1 : 1;
    this.aircraft = { kind, length, dir, speed, x: dir > 0 ? from - length - 60 : to + length + 60,
      altitude: altitude[0] + this.random() * (altitude[1] - altitude[0]) };
  }

  // The queue at the stop walks to the bus door and boards; a couple of riders step off.
  arrive(bus, stop) {
    for (const person of this.crowds) {
      if (person.stop !== stop) continue;
      person.state = 'board';
      person.target = bus.x;
      person.dir = Math.sign(bus.x - person.x) || 1;
    }
    for (let i = Math.floor(this.random() * 3); i > 0; i--) {
      const rider = this.person(bus.x + (this.random() - 0.5) * 8);
      rider.lane = 0;
      this.walkers.push(rider);
    }
  }

  // Where a walker without a home turns back; the forest overrides this per stretch of trail.
  walkBounds() {
    return [CITY.from + 20, CITY.to - 20];
  }

  // Strongest reaction wins: duck from a RAM's wake, otherwise a curious look.
  react(person, hero) {
    if (!hero || BUSY.has(person.state)) return;
    const dx = Math.abs(hero.x - person.x);
    if (this.wake(hero) && hero.altitude < WAKE.altitude && dx < WAKE.reach) {
      if (person.calm) {
        person.state = 'look';
        person.gesture = 'stare';
        person.dir = Math.sign(hero.x - person.x) || person.dir;
        person.timer = 1.5 + this.random();
        return;
      }
      person.timer = person.state === 'flinch' ? Math.max(person.timer, 0.9) : 0.9;
      person.state = 'flinch';
      return;
    }
    if (person.state === 'flinch') return;
    if (!person.busy && hero.speed < FAST && hero.altitude < NOTICE.altitude && dx < NOTICE.reach) {
      if (person.state !== 'look') {
        const roll = this.random();
        person.gesture = roll < 0.35 ? 'wave' : roll < 0.55 ? 'cheer' : roll < 0.8 ? 'point' : 'stare';
      }
      person.state = 'look';
      person.dir = Math.sign(hero.x - person.x) || person.dir;
      person.timer = 1.2 + this.random() * 0.8;
    }
  }

  wake(hero) {
    return hero.ram && hero.speed >= WAKE.speed;
  }

  stepPerson(person, dt, hero) {
    if (person.state === 'held') {
      // In the hero's hands: the street copy follows the body, legs kicking.
      person.x = person.body.x - this.shift;
      person.phase += dt * 16;
      return;
    }
    this.react(person, hero);
    if (person.state === 'dead') return;
    if (person.state === 'thrown') {
      this.stepThrown(person, dt);
      return;
    }
    if (person.state === 'board') {
      person.x += person.dir * person.speed * 1.3 * dt;
      person.phase += person.speed * dt * 0.8;
      if ((person.target - person.x) * person.dir <= 0) person.boarded = true;
      return;
    }
    person.timer -= dt;
    // Stepping out of a door fades in; going in fades out and leaves the street.
    if (person.state === 'exit' || person.state === 'enter') {
      person.fade = Math.max(0, Math.min(1, person.state === 'exit' ? 1 - person.timer / DOOR.fade : person.timer / DOOR.fade));
      if (person.timer > 0) return;
      if (person.state === 'enter') person.gone = true;
      else Object.assign(person, { state: 'walk', fade: 1, timer: 3 + this.random() * 6 });
      return;
    }
    // Back on their feet, they run.
    if (person.state === 'down') {
      if (person.timer > 0) return;
      Object.assign(person, { state: 'flee', angle: 0, timer: ALARM.flee[0] + this.random() * (ALARM.flee[1] - ALARM.flee[0]) });
      return;
    }
    if (person.state === 'look' || person.state === 'flinch') {
      if (person.timer > 0) return;
      person.state = person.home ? 'idle' : 'walk';
      person.timer = person.home ? 1 + this.random() * 3 : 3 + this.random() * 6;
      return;
    }
    if (person.state === 'idle') {
      if (person.timer > 0) return;
      person.state = 'walk';
      if (person.home) {
        person.target = person.home[0] + this.random() * (person.home[1] - person.home[0]);
        person.dir = Math.sign(person.target - person.x) || 1;
      } else {
        if (this.random() < 0.3) person.dir *= -1;
        person.timer = 3 + this.random() * 6;
      }
      return;
    }
    const from = person.x;
    const fleeing = person.state === 'flee';
    const pace = person.speed * (1 + (WEATHER.hurry - 1) * this.rain) * (fleeing ? ALARM.run : 1);
    const onDeck = person.pier && !person.offDeck;
    if (!onDeck && isWater(person.x, this.bridges)) {
      this.kill(person, person.x);
      return;
    }
    const nextX = person.x + person.dir * pace * dt;
    // Pedestrians never walk over open water (lakes, sea): turn back at the waterline
    if (!onDeck && isWater(nextX, this.bridges)) {
      person.dir = -person.dir;
      if (person.target) person.target = person.x;
    } else {
      person.x = nextX;
    }
    person.phase += pace * dt * 0.6;
    // Running from danger leaves a crowd's patch; once it ends they wander back.
    if (fleeing) {
      const [low, high] = this.walkBounds(person);
      if (person.x < low || person.x > high) person.dir = person.x < low ? 1 : -1;
      if (!onDeck && isWater(person.x + person.dir * 14, this.bridges)) person.dir = -person.dir;
      if (person.timer <= 0) {
        person.state = person.home ? 'idle' : 'walk';
        person.timer = person.home ? 1 + this.random() * 3 : 3 + this.random() * 6;
      }
      return;
    }
    if (!person.home && person.lane === 0 && this.intact) {
      const door = this.doorBetween(from, person.x);
      if (door && door !== person.door && this.random() < DOOR.enter + (DOOR.enterRain - DOOR.enter) * this.rain) {
        Object.assign(person, { state: 'enter', x: door.x, timer: DOOR.fade, fade: 1 });
        return;
      }
    }
    const [low, high] = person.home ?? this.walkBounds(person);
    if (person.x < low || person.x > high) person.dir = person.x < low ? 1 : -1;
    const arrived = person.home && (person.target - person.x) * person.dir <= 0;
    // Walkers stop now and then, as if at a shop window; crowds rest wherever they wander to.
    if (arrived) {
      person.state = 'idle';
      person.timer = 2 + this.random() * 6;
    } else if (!person.home && person.timer <= 0) {
      const pause = this.random() < 0.4;
      person.state = pause ? 'idle' : 'walk';
      person.timer = pause ? 1 + this.random() * 2 : 3 + this.random() * 6;
    }
  }

  // Where the road ends ahead of a car at x heading dir: the nearer of ROAD_END short of the next
  // open water (bridges excepted) and the area's own road end that way (this.ends), or far away.
  roadEnd(x, dir) {
    const found = shoreAhead(x, dir, SHORE_REACH, this.bridges);
    const shore = found === null ? x + dir * 1e6 : found - dir * ROAD_END;
    const end = this.ends?.[dir > 0 ? 1 : 0] ?? null;
    if (end === null || (end - x) * dir < 0) return shore;
    return dir > 0 ? Math.min(shore, end) : Math.max(shore, end);
  }

  // The road end ahead of a car, cached per direction (the land ahead does not move). When no shore
  // was in reach, look again once the car has covered half that reach.
  carEnd(car, dir) {
    const open = Math.abs(car.end - car.x) > SHORE_REACH;
    if (car.endDir !== dir || open && Math.abs(car.x - car.endFrom) > SHORE_REACH / 2) {
      car.end = this.roadEnd(car.x, dir);
      car.endDir = dir;
      car.endFrom = car.x;
    }
    return car.end;
  }

  // Keep only standing decks in the road network. Cars over a broken span fall (stepFalling),
  // while approaching traffic brakes and roads over water end at the banks.
  setBridgeStanding(standing) {
    // Regional decks have their own destruction state; the Old Bridge's flag cannot restore them.
    let mask = 0;
    for (let i = 0; i < this.bridgeDecks.length; i++) {
      const deck = this.bridgeDecks[i];
      if (deck.id === BRIDGE_DECK.id ? standing : this.deckUp(deck.id)) mask |= 1 << i;
    }
    if (mask === this.bridgeMask) return;
    const bridges = [];
    const broken = [];
    for (let i = 0; i < this.bridgeDecks.length; i++) {
      const deck = this.bridgeDecks[i];
      if (mask & 1 << i) bridges.push([deck.from, deck.to]);
      else {
        broken.push(deck);
        if (this.bridges.some(([from]) => from === deck.from)) this.panicBrake(deck.x, PANIC.reach);
      }
    }
    this.bridgeMask = mask;
    this.brokenBridgeDecks = broken;
    this.bridges = bridges;
    this.exits = null;
    for (const car of this.cars) car.endDir = 0;
  }

  // Cars on land within reach of x and driving toward it brake hard, laying skid marks. True if any did.
  panicBrake(x, reach, swerve = false) {
    let any = false;
    for (const car of this.cars) {
      if (car.fall || car.wreck || isWater(car.x)) continue;
      const toward = x - car.x;
      if (Math.abs(toward) > reach || Math.sign(toward) !== LANES[car.lane].dir) continue;
      any = true;
      if (swerve && car.kind !== 'bus' && car.hurt === undefined && this.random() < PANIC.swerve
        && !this.cars.some(c => c !== car && c.lane !== car.lane && !c.fall && Math.abs(c.x - car.x) < (c.length + car.length) / 2 + SAFE_GAP * 2)) {
        Object.assign(car, { lane: 1 - car.lane, endDir: 0, rush: PANIC.brake * 2, panic: PANIC.brake, startle: 0, park: 0 });
        car.bounceSpeed += 40;
        continue;
      }
      car.startle = PANIC.brake;
      car.panic = PANIC.brake;
    }
    return any;
  }

  // Evil mode: something broke at world x. People within reach run from it or cower; cars heading
  // for it brake hard and skid. Cars carry no horn.
  alarm(worldX, reach = ALARM.reach) {
    if (this.shift === null) return;
    const x = worldX - this.shift;
    let fled = 0;
    for (const list of [this.crowds, this.walkers]) {
      for (const person of list) if (Math.abs(person.x - x) <= reach && this.panic(person, x)) fled++;
    }
    // Cars brake and skid for anything breaking in reach.
    this.panicBrake(x, reach, true);
  }

  // True when this starts them running (not when they cower, or were running already).
  panic(person, x) {
    if (HURT.has(person.state) || ['board', 'enter', 'exit'].includes(person.state)) return false;
    if (person.state === 'flinch' || person.state !== 'flee' && this.random() < ALARM.cower) {
      person.state = 'flinch';
      person.timer = Math.max(person.timer, 2 + this.random() * 2);
      return false;
    }
    const started = person.state !== 'flee';
    person.state = 'flee';
    person.dir = Math.sign(person.x - x) || person.dir;
    person.timer = ALARM.flee[0] + this.random() * (ALARM.flee[1] - ALARM.flee[0]);
    return started;
  }

  // Evil mode: a falling piece landed across world [from, to]. Cars under it are wrecked (some
  // blow up), people under it are killed, people just beside it are thrown clear, and the street
  // around panics. size: the landing's weight, 1 to 3.5.
  crush(from, to, size = 1, groundAt = null) {
    if (this.shift === null) return;
    from -= this.shift;
    to -= this.shift;
    const mid = (from + to) / 2;
    let crushed = false;
    for (const car of this.cars) {
      if (car.fall || car.x + car.length / 2 < from || car.x - car.length / 2 > to) continue;
      if (car.wreck) car.wreck.crushed = true;
      else this.wreck(car, true, this.random() < WRECK.blow);
      crushed = true;
    }
    if (crushed) sound.crunch(Math.min(1, size / 3.5));
    for (const list of [this.crowds, this.walkers]) {
      for (const person of list) {
        if (person.state === 'dead' || ['board', 'enter', 'exit'].includes(person.state)) continue;
        if (person.x >= from && person.x <= to) this.kill(person, mid);
        else if (person.x > from - ALARM.toss && person.x < to + ALARM.toss) this.toss(person, mid, 50 + 30 * size);
      }
    }
    if (groundAt) {
      const [a, b] = this.span(from + this.shift, to + this.shift, groundAt);
      this.strikeLife(a, b, 6, groundAt, 0, 0);
      this.strikeBoats(a, b, 6, groundAt);
    }
    this.alarm(mid + this.shift);
  }

  // The stretch of ground between two world x, as a segment just above it, for the hit tests.
  span(from, to, groundAt) {
    const [a, b] = SPAN;
    a.x = from;
    a.y = groundAt(from) - 4;
    b.x = to;
    b.y = groundAt(to) - 4;
    return SPAN;
  }

  // Something that lived becomes a body. at: the thing itself, whose x it keeps; draw(g, groundAt,
  // left, right) draws it standing on groundAt; restore() puts it back when the city is rebuilt.
  // Thrown (vy) or killed aloft (h), it tumbles down first; then it lies on its back. pivot: the
  // height above the ground it turns about.
  fell(at, draw, restore, vx = 0, vy = 0, h = 0, pivot = 6) {
    const air = vy !== 0 || h > 0;
    const body = { at, draw, restore, vx, vy, h, pivot, air, base: null, angle: air ? 0 : Math.PI,
      spin: (Math.sign(vx) || (this.random() < 0.5 ? -1 : 1)) * (5 + this.random() * 5) };
    // The ground it is drawn on, raised while it is in the air.
    body.ground = x => body.base(x) - body.h;
    this.bodies.push(body);
  }

  // Kills every animal, bird and other creature a world segment passes within pad px of. Herd
  // animals are thrown at (vx, vy); the rest hop up by vy. True if any died.
  strikeLife(from, to, pad, groundAt, vx, vy) {
    const low = Math.min(from.x, to.x) - 40 - this.shift;
    const high = Math.max(from.x, to.x) + 40 - this.shift;
    let hit = false;
    for (const herd of this.herds) {
      // Bolting animals stray well past their home.
      if (herd.state === 'gone' || herd.home[1] < low - 400 || herd.home[0] > high + 400) continue;
      for (let i = herd.members.length - 1; i >= 0; i--) {
        const animal = herd.members[i];
        if (animal.x < low || animal.x > high || !segmentBox(from, to, this.box(animal, groundAt, 16, 12), pad)) continue;
        herd.members.splice(i, 1);
        Object.assign(animal, { h: 0, hv: 0, target: null });
        const one = { ...herd, state: 'rest', members: [animal] };
        this.fell(animal, (g, ground, left, right) => this.drawHerd(g, one, ground, left, right), () => {
          if (!herd.count || herd.members.length < herd.count) herd.members.push(animal);
        }, vx, vy);
        hit = true;
      }
    }
    for (const flock of this.flocks) {
      if (flock.state === 'gone' || !flock.birds) continue;
      const flying = flock.state === 'flying';
      if (!flying && (flock.x < low - flock.spread || flock.x > high + flock.spread)) continue;
      for (let i = flock.birds.length - 1; i >= 0; i--) {
        const bird = flock.birds[i];
        const x = flying ? bird.x : flock.x + bird.dx;
        if (x < low || x > high) continue;
        const h = flying ? bird.h : flock.height;
        BOX.x = x + this.shift;
        BOX.width = 6;
        BOX.height = 5;
        BOX.y = groundAt(BOX.x) - h - 2.5;
        if (!segmentBox(from, to, BOX, pad)) continue;
        flock.birds.splice(i, 1);
        Object.assign(bird, { x, h: 0 });
        const one = { ...flock, state: 'flying', birds: [bird] };
        // Flocks regroup by themselves, so a dead bird is never put back.
        this.fell(bird, (g, ground) => this.drawFlying(g, one, ground), null, vx * 0.3, vy * 0.5, h, 1);
        hit = true;
      }
    }
    for (const kind of this.cast) {
      const list = kind.list();
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        const x = kind.x ? kind.x(item) : item.x;
        if (x < low || x > high || kind.alive && !kind.alive(item)) continue;
        const lift = kind.lift ? kind.lift(item) : 0;
        BOX.x = x + this.shift;
        BOX.width = kind.width;
        BOX.height = kind.height;
        BOX.y = groundAt(BOX.x) - lift - kind.height / 2;
        if (!segmentBox(from, to, BOX, pad)) continue;
        hit = true;
        // A creature with its own hit response takes the blow itself.
        if (kind.hit) {
          kind.hit(item, vx, vy);
          continue;
        }
        list.splice(i, 1);
        // The corpse's art is fixed before onKill resets the creature.
        const draw = kind.corpse ? kind.corpse(item) : (g, ground) => kind.draw(g, item, ground);
        kind.onKill?.(item);
        this.fell({ x }, draw, kind.transient ? null : () => {
          list.push(item);
          kind.onRestore?.(item);
        }, 0, vy * 0.6, lift, kind.height / 2);
        hit = true;
      }
    }
    return hit;
  }

  // Spawns laser cutting sizzle, steam, and molten sparks while beam cuts through a boat
  boatSizzle(boat, hitPoint, dir, dt) {
    if (this.random() < (dt || 0.016) * 45) {
      this.boatSparks.push({
        x: hitPoint.x, y: hitPoint.y,
        vx: (this.random() - 0.5) * 60 + dir.x * 40,
        vy: -30 - this.random() * 60,
        color: this.random() < 0.5 ? 0xfff0a0 : 0xff6620,
        age: 0, life: 0.15 + this.random() * 0.15,
      });
      if (this.random() < 0.3) {
        this.boatSmokes.push({
          x: hitPoint.x, y: hitPoint.y - 2,
          radius: 2 + this.random() * 3,
          rise: 25 + this.random() * 20,
          drift: (this.random() - 0.5) * 10,
          color: 0x444a50,
          age: 0, life: 0.5 + this.random() * 0.4,
        });
      }
    }
  }

  // Ignites realistic fires distributed across a boat's deck, cabin, and wheelhouse
  initBoatFires(boat) {
    boat.onFire = true;
    boat.fires = boat.fires || [];
    const len = boat.length;
    const h = boat.height ?? 12;
    if (boat.fires.length === 0) {
      if (boat.kind === 'cutter') {
        boat.fires.push(
          { rx: -len * 0.28, ry: -Math.min(12, h * 0.32), size: 7, seed: 1 },
          { rx: -len * 0.04, ry: -Math.min(22, h * 0.6), size: 9, seed: 2 },
          { rx: len * 0.22, ry: -Math.min(10, h * 0.3), size: 6, seed: 3 },
        );
      } else if (boat.kind === 'tug') {
        boat.fires.push(
          { rx: -len * 0.08, ry: -Math.min(22, h * 0.65), size: 9, seed: 1 },
          { rx: -len * 0.26, ry: -Math.min(12, h * 0.38), size: 7, seed: 2 },
          { rx: len * 0.2, ry: -Math.min(10, h * 0.32), size: 6, seed: 3 },
        );
      } else if (boat.kind === 'trawler') {
        boat.fires.push(
          { rx: len * 0.18, ry: -Math.min(18, h * 0.55), size: 8, seed: 1 },
          { rx: -len * 0.22, ry: -Math.min(10, h * 0.32), size: 7, seed: 2 },
        );
      } else if (boat.kind === 'yacht' || boat.kind === 'sailboat') {
        boat.fires.push(
          { rx: -len * 0.06, ry: -Math.min(12, h * 0.38), size: 7, seed: 1 },
          { rx: -len * 0.28, ry: -Math.min(7, h * 0.25), size: 6, seed: 2 },
        );
      } else {
        boat.fires.push(
          { rx: 0, ry: -Math.min(6, h * 0.3), size: 5, seed: 1 },
        );
      }
    }
  }

  // Visceral destruction impact feedback when boat/ship is hit by punch, ram, or laser
  boatImpact(boat, hitPoint, dir, kind, groundAt, initial = true) {
    const seaY = typeof groundAt === 'function' ? groundAt(hitPoint.x) : groundAt;
    const isRam = kind === 'ram';
    const isLaser = kind === 'laser';
    boat.waterY = seaY;
    if (initial) this.initBoatFires(boat);

    // Physical impulse & rocking
    boat.rock = (boat.rock ?? 0) + (isRam ? 0.35 : 0.18) * (Math.sign(dir.x) || 1);
    boat.rockSpeed = (boat.rockSpeed ?? 0) + (isRam ? 2.5 : 1.2) * (Math.sign(dir.x) || 1);

    // Blast hole on the hull / superstructure
    boat.holes = boat.holes || [];
    const rx = hitPoint.x - (boat.x + (this.shift ?? 0));
    const ry = hitPoint.y - seaY;
    const holeRadius = isRam ? 10 : isLaser ? 6 : 7;
    boat.holes.push({ rx, ry, radius: holeRadius, kind, age: 0 });

    // Flying debris: chunks of hull, timber, metal plating, cargo
    const debrisCount = isRam ? 16 : isLaser ? 10 : 8;
    const colors = [boat.hull, boat.trim ?? boat.hull, boat.boot ?? 0x8c4f4a, 0x1f2328, 0xd88a38, 0xdedede];
    for (let i = 0; i < debrisCount; i++) {
      const spread = (this.random() - 0.5) * 2;
      const speed = isRam ? (120 + this.random() * 180) : (70 + this.random() * 120);
      this.boatDebris.push({
        x: hitPoint.x + (this.random() - 0.5) * 6,
        y: hitPoint.y + (this.random() - 0.5) * 6,
        vx: dir.x * speed + spread * 80,
        vy: dir.y * speed * 0.5 - 70 - this.random() * 140,
        angle: this.random() * Math.PI * 2,
        spin: (this.random() - 0.5) * 16,
        size: 2 + Math.floor(this.random() * 3),
        color: pick(colors, this.random()),
        age: 0, life: 1.0 + this.random() * 0.8,
        waterY: seaY,
      });
    }

    // High velocity sparks
    const sparkCount = isRam ? 26 : 14;
    for (let i = 0; i < sparkCount; i++) {
      const sSpeed = isRam ? (140 + this.random() * 180) : (90 + this.random() * 130);
      this.boatSparks.push({
        x: hitPoint.x, y: hitPoint.y,
        vx: dir.x * sSpeed + (this.random() - 0.5) * 120,
        vy: dir.y * sSpeed * 0.5 - 40 - this.random() * 100,
        color: this.random() < 0.6 ? 0xfff090 : 0xff6620,
        age: 0, life: 0.18 + this.random() * 0.22,
      });
    }

    // Water impact foam ring and spray
    this.boatSplashes.push({
      x: hitPoint.x, y: seaY,
      radius: isRam ? 26 : 16,
      age: 0, life: 0.75,
    });
    const dropCount = isRam ? 14 : 7;
    for (let i = 0; i < dropCount; i++) {
      this.boatDebris.push({
        x: hitPoint.x + (this.random() - 0.5) * 10,
        y: seaY - 1,
        vx: (this.random() - 0.5) * (isRam ? 160 : 90),
        vy: -(60 + this.random() * (isRam ? 180 : 100)),
        angle: 0, spin: 0,
        size: 1 + Math.floor(this.random() * 2),
        color: 0xeef6f8,
        age: 0, life: 0.6 + this.random() * 0.5,
        waterY: seaY,
      });
    }

    // Exploding fire & smoke puffs
    const smokeCount = isRam ? 7 : 4;
    for (let i = 0; i < smokeCount; i++) {
      this.boatSmokes.push({
        x: hitPoint.x + (this.random() - 0.5) * 10,
        y: hitPoint.y + (this.random() - 0.5) * 8,
        radius: 4 + this.random() * (isRam ? 8 : 5),
        rise: 22 + this.random() * 30,
        drift: dir.x * 12 + (this.random() - 0.5) * 16,
        color: this.random() < 0.35 ? 0xff5511 : 0x22262a,
        age: 0, life: 0.8 + this.random() * 0.9,
      });
    }

    // Sound effects
    if (kind === 'punch') {
      sound.punchImpact();
      sound.crunch(0.4);
      sound.splash(0.5);
    } else if (isRam) {
      sound.blast(1.2);
      sound.crash(0.8);
      sound.splash(0.9);
    } else if (isLaser) {
      sound.blast(0.8);
      sound.crash(0.5);
      sound.splash(0.5);
    } else {
      sound.splash(Math.min(1, boat.length / (20 * METRE)));
    }
  }

  // Holes the boats a world segment passes within pad px of; they sink with visceral destruction
  // effects (sparks, flying hull debris, damage craters, fire and water splash).
  // With dt (the laser), a boat must stay in the beam HERO.cook seconds first. True if any was touched.
  strikeBoats(from, to, pad, groundAt, dt = 0, kind = dt ? 'laser' : 'crush') {
    const low = Math.min(from.x, to.x) - this.shift;
    const high = Math.max(from.x, to.x) - this.shift;
    let hit = false;
    for (const boat of this.moored.length ? [...this.boats, ...this.moored] : this.boats) {
      if (boat.promoted || boat.held || boat.x < low - boat.length || boat.x > high + boat.length) continue;
      const t = this.hitBoat(from, to, boat, groundAt, pad * BOAT_PAD);
      if (t === null) continue;
      hit = true;
      const hitPoint = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      const len = Math.hypot(to.x - from.x, to.y - from.y);
      const dir = len > 0.01 ? { x: (to.x - from.x) / len, y: (to.y - from.y) / len }
        : { x: Math.sign(to.x - (boat.x + (this.shift ?? 0))) || 1, y: 0 };

      // Sinking boats can still be battered: subsequent punches/rams/lasers produce full visceral destruction
      if (boat.sink !== undefined) {
        if (dt) {
          boat.burn = (boat.burn ?? 0) + dt;
          this.boatSizzle(boat, hitPoint, dir, dt);
        } else {
          boat.sink += (kind === 'ram' ? 0.4 : 0.15);
          this.boatImpact(boat, hitPoint, dir, kind, groundAt, false);
        }
        continue;
      }

      if (dt) {
        boat.burn = (boat.burn ?? 0) + dt;
        this.boatSizzle(boat, hitPoint, dir, dt);
        if (boat.burn < HERO.cook) continue;
      }

      // A big ship stops and is handed over to be smashed apart and sunk like the cruise liner.
      if (PIXEL_SHIPS.has(boat.kind) && this.promoteShip?.(boat, from, to, kind)) {
        this.boatImpact(boat, hitPoint, dir, kind, groundAt, true);
        Object.assign(boat, { promoted: true, turn: 1e9, pause: 1e9 });
        continue;
      }

      // turn and pause hold a boat still, on the sea and on the lake.
      this.onBoatLost?.(boat);
      Object.assign(boat, { sink: 0, list: this.random() < 0.5 ? -1 : 1, turn: 1e9, pause: 1e9 });
      this.boatImpact(boat, hitPoint, dir, kind, groundAt, true);
    }
    return hit;
  }

  // Thrown bodies tumble down and lie still; holed boats go under and are gone.
  stepCasualties(dt) {
    for (const body of this.bodies) {
      if (!body.air) continue;
      body.vy -= TOSS.gravity * dt;
      body.h += body.vy * dt;
      body.at.x += body.vx * dt;
      body.angle += body.spin * dt;
      if (body.h > 0) continue;
      body.h = 0;
      body.air = false;
      body.angle = Math.PI;
    }
    let gone = false;
    for (const boat of this.boats) {
      // In the hero's hands: the water copy follows the body, so it stays in view.
      if (boat.held) boat.x = boat.held.x - this.shift;
      if (boat.sink === undefined) continue;
      boat.sink += dt;
      if (boat.sink < sinkTime(boat)) continue;
      this.sunk.push(boat);
      gone = true;
    }
    if (gone) this.boats = this.boats.filter(boat => !(boat.sink >= sinkTime(boat)));

    // Step boat destruction holes & fires (emit rising billowing smoke & sparks from transformed pose)
    for (const boat of this.boats) {
      if (!boat.holes && !boat.fires) continue;
      const t = boat.sink !== undefined ? Math.min(1, boat.sink / sinkTime(boat)) : 0;
      if (t >= 1) continue;

      const seaY = boat.waterY ?? 500;
      const pose = boat.sink !== undefined ? this.sinkPose(boat, t) : { down: 0, angle: 0, pivot: 0, drift: 0 };
      const cos = Math.cos(pose.angle);
      const sin = Math.sin(pose.angle);
      const boatWorldX = boat.x + (this.shift ?? 0);
      const facing = this.boatFacing(boat);

      // All active fire and breach emitters
      const emitters = [...(boat.holes || []), ...(boat.fires || [])];
      for (const em of emitters) {
        em.age = (em.age ?? 0) + dt;
        const px = em.rx - pose.pivot;
        const py = em.ry;
        const worldX = boatWorldX + pose.pivot + pose.drift + (px * cos - py * sin);
        const worldY = seaY + pose.down + (px * sin + py * cos);

        // If above waterline: actively belch thick smoke and burning embers into the sky!
        if (worldY <= seaY + 2) {
          if (this.random() < dt * 16) {
            const isDark = this.random() < 0.65;
            this.boatSmokes.push({
              x: worldX + (this.random() - 0.5) * 6,
              y: worldY - 2,
              radius: 4 + this.random() * 4,
              maxRadius: 18 + this.random() * 12,
              rise: 24 + this.random() * 26,
              drift: -facing * 6 + (this.random() - 0.5) * 14,
              color: isDark ? 0x181a1c : (this.random() < 0.5 ? 0x2e343c : 0x48505a),
              age: 0,
              life: 1.4 + this.random() * 0.9,
            });
          }
          if (this.random() < dt * 10) {
            this.boatSparks.push({
              x: worldX + (this.random() - 0.5) * 4,
              y: worldY,
              vx: (this.random() - 0.5) * 30 - facing * 12,
              vy: -35 - this.random() * 65,
              color: this.random() < 0.6 ? 0xff5511 : 0xffaa22,
              age: 0,
              life: 0.35 + this.random() * 0.35,
            });
          }
        } else if (worldY > seaY + 2 && worldY < seaY + 16) {
          // Fire meeting incoming seawater: hissing white steam clouds!
          if (this.random() < dt * 12) {
            this.boatSmokes.push({
              x: worldX + (this.random() - 0.5) * 8,
              y: seaY - 1,
              radius: 3 + this.random() * 3,
              maxRadius: 14 + this.random() * 8,
              rise: 14 + this.random() * 16,
              drift: (this.random() - 0.5) * 8,
              color: 0xdde6ec, // white steam
              age: 0,
              life: 0.7 + this.random() * 0.5,
            });
          }
        }
      }
    }

    // Step boat debris
    for (const p of this.boatDebris) {
      p.age += dt;
      p.vy += 380 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
    }
    this.boatDebris = this.boatDebris.filter(p => p.age < p.life && p.y < (p.waterY ?? 1e6) + 16);

    // Step boat sparks
    for (const s of this.boatSparks) {
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.94;
      s.vy += 120 * dt;
    }
    this.boatSparks = this.boatSparks.filter(s => s.age < s.life);

    // Step splashes
    for (const sp of this.boatSplashes) sp.age += dt;
    this.boatSplashes = this.boatSplashes.filter(sp => sp.age < sp.life);

    // Step smokes
    for (const sm of this.boatSmokes) {
      sm.age += dt;
      sm.y -= sm.rise * dt;
      sm.x += sm.drift * dt;
      sm.radius = Math.min(sm.maxRadius ?? 22, sm.radius + dt * 6.5);
    }
    this.boatSmokes = this.boatSmokes.filter(sm => sm.age < sm.life);

    // Moored craft (the seaplane) stay listed; drawAfloat hides them once under.
    for (const craft of this.moored) if (craft.sink !== undefined) craft.sink += dt;
  }

  // How far below the area's water line a boat's waterline sits (sea lanes override it).
  waterline() {
    return 0;
  }

  // A promoted ship that has gone under leaves for good (until the area is rebuilt).
  removeBoat(boat) {
    this.boats = this.boats.filter(each => each !== boat);
    this.sunk.push(boat);
  }

  // People standing on a deck (person.deck: its building id, person.deckLift: its height) fall when
  // it gives way (QA-07): the living drop off it tumbling, the dead simply fall. Run every step.
  stepDecks() {
    for (const person of this.crowds) {
      if (!person.deck || person.offDeck || this.deckUp(person.deck)) continue;
      person.offDeck = true;
      const lift = person.lift || person.deckLift || 12;
      person.lift = 0;
      if (person.rod) person.rod = false;
      if (person.state === 'dead' || !this.exposed(person)) {
        continue;
      }
      Object.assign(person, { state: 'thrown', angle: 0, air: { h: lift, vx: (this.random() - 0.5) * 20, vy: 15,
        spin: (this.random() < 0.5 ? -1 : 1) * (3 + this.random() * 3) } });
    }
  }

  kill(person, fromX) {
    if (person.state !== 'dead') this.onKill?.(person);
    person.state = 'dead';
    person.angle = (Math.sign(person.x - fromX) || 1) * Math.PI / 2;
    person.air = null;
    person.lift = 0;
    if (person.rod) person.rod = false;
  }

  // Thrown away from fromX, tumbling.
  toss(person, fromX, power) {
    const away = Math.sign(person.x - fromX) || (this.random() < 0.5 ? -1 : 1);
    person.state = 'thrown';
    person.dir = away;
    person.angle = 0;
    person.air = { h: 0, vx: away * power * (0.6 + 0.4 * this.random()), vy: power * (0.8 + 0.4 * this.random()),
      spin: away * (6 + this.random() * 6) };
    // Thrown off a deck, they fall from its height to the ground or the water below, never landing
    // on thin air at deck height (QA-07).
    if (person.lift > 0) {
      person.air.h = person.lift;
      person.lift = 0;
      person.offDeck = true;
    }
  }

  stepThrown(person, dt) {
    const air = person.air;
    air.vy -= TOSS.gravity * dt;
    air.h += air.vy * dt;
    person.x += air.vx * dt;
    person.angle += air.spin * dt;
    if (air.h > 0) return;
    if (person.doomed) {
      this.kill(person, person.x - air.spin);
      return;
    }
    person.air = null;
    person.angle = Math.sign(air.spin) * Math.PI / 2;
    // Into deep water, they are gone under; on land they lie stunned, then get up and run.
    if (isWater(person.x, this.bridges)) {
      this.kill(person, person.x - air.spin);
      return;
    }
    person.state = 'down';
    person.timer = TOSS.down[0] + this.random() * (TOSS.down[1] - TOSS.down[0]);
  }

  // Can anything still happen to this person? Not once dead, nor while in a doorway or boarding.
  exposed(person) {
    return person.state !== 'dead' && person.state !== 'board' && person.state !== 'enter' && person.state !== 'exit';
  }

  // The world-space hit box of a car or person standing on the street, in the shared scratch box.
  box(thing, groundAt, length = thing.length ?? 5, height = thing.height) {
    BOX.x = thing.x + this.shift;
    BOX.width = length;
    BOX.height = height;
    BOX.y = groundAt(BOX.x) - (thing.lift ?? 0) - height / 2;
    return BOX;
  }

  // A boat's world-space hit boxes. By default one box, length by height, sitting on the water;
  // areas with ships override it with boxes that follow the hull and superstructure (boatParts), so
  // a hit lands only where there is ship, not in the air over her bow or beside her mast.
  boatBoxes(boat, groundAt) {
    return [this.box(boat, groundAt, boat.length, boat.height ?? 12)];
  }

  // Where along a world segment it first meets a boat (0–1), within pad px, or null.
  hitBoat(from, to, boat, groundAt, pad = 0) {
    let best = null;
    for (const part of this.boatBoxes(boat, groundAt)) {
      const t = segmentBox(from, to, part, pad)?.t;
      if (t !== undefined && (best === null || t < best)) best = t;
    }
    return best;
  }

  // Throws a car into the air, tumbling; it wrecks where it comes down (stepFalling).
  launch(car, vx, vy) {
    const dir = Math.sign(vx) || LANES[car.lane].dir;
    // A bus is too long to throw convincingly: a hit that would launch it blows it up where it stands.
    if (car.kind === 'bus') {
      if (!car.wreck) this.wreck(car, false, true);
      if (car.wreck.boom < 0) car.wreck.fuse = 0;
      return;
    }
    car.fall = { h: 1, vx, vy, angle: 0, spin: dir * (2 + this.random() * 3), sink: 0, splash: -1 };
  }

  // A thrown car comes down on land: it wrecks (and may blow up), wrecks the cars it lands on,
  // kills the people under it, and the street around panics.
  land(car) {
    const flip = Math.cos(car.fall.angle) < 0;
    car.fall = null;
    car.endDir = 0;
    if (!car.wreck) this.wreck(car, false, this.random() < WRECK.blow);
    car.wreck.flip = flip;
    sound.crunch(0.5);
    for (const other of this.cars) {
      if (other === car || other.fall || other.wreck) continue;
      if (Math.abs(other.x - car.x) < (other.length + car.length) / 2) this.wreck(other, false, this.random() < WRECK.blow);
    }
    for (const list of [this.crowds, this.walkers]) {
      for (const person of list) {
        if (this.exposed(person) && Math.abs(person.x - car.x) < car.length / 2) this.kill(person, car.x);
      }
    }
    this.alarm(car.x + this.shift);
  }

  // Evil mode: the hero RAMs along world from→to. Cars in the way are bowled off, people thrown.
  heroRam(from, to, velocity, groundAt) {
    if (this.shift === null) return;
    const low = Math.min(from.x, to.x) - 40 - this.shift;
    const high = Math.max(from.x, to.x) + 40 - this.shift;
    let hit = false;
    for (const car of this.cars) {
      if (car.fall || car.x < low || car.x > high || !segmentBox(from, to, this.box(car, groundAt), HERO.ramPad)) continue;
      // Armoured: one hit per RAM pass while it holds.
      if (car.tough > 1) {
        if (this.clock - (car.rammed ?? -1) > 0.4) {
          if (!car.wreck) this.onHeroHit?.(car, 'ram');
          this.knock(car);
        }
        car.rammed = this.clock;
        hit = true;
        continue;
      }
      if (!car.wreck) this.onHeroHit?.(car, 'ram');
      this.launch(car, Math.max(-260, Math.min(260, velocity.x * 0.6)), -(130 + this.random() * 70));
      hit = true;
    }
    if (hit) sound.crunch(0.6);
    for (const list of [this.crowds, this.walkers]) {
      for (const person of list) {
        if (person.x < low || person.x > high || HURT.has(person.state) || !this.exposed(person)
          || !segmentBox(from, to, this.box(person, groundAt), HERO.ramPad)) continue;
        this.toss(person, person.x - Math.sign(velocity.x), HERO.ramToss);
        hit = true;
      }
    }
    if (this.strikeLife(from, to, HERO.ramPad, groundAt, Math.max(-200, Math.min(200, velocity.x * 0.4)), 130)) hit = true;
    if (this.strikeBoats(from, to, HERO.ramPad, groundAt, 0, 'ram')) hit = true;
    if (hit) this.alarm(to.x);
    return hit;
  }

  // Evil mode: the hero's fist is at world point, swinging along angle. A car it touches is launched
  // along the punch, once per punch id; a person is thrown. True if it hit something.
  heroPunch(point, angle, id, groundAt) {
    if (this.shift === null) return false;
    const x = point.x - this.shift;
    const dx = Math.cos(angle);
    let hit = false;
    for (const car of this.cars) {
      if (car.fall || car.punched === id || Math.abs(car.x - x) > car.length) continue;
      const box = this.box(car, groundAt);
      if (Math.abs(point.x - box.x) > box.width / 2 + HERO.punchPad || Math.abs(point.y - box.y) > box.height / 2 + HERO.punchPad) continue;
      car.punched = id;
      if (!car.wreck) this.onHeroHit?.(car, 'punch');
      hit = true;
      if (car.tough > 1) {
        this.knock(car);
        continue;
      }
      this.launch(car, dx * HERO.launch, Math.sin(angle) * HERO.launch - 90);
      sound.crunch(0.3);
      hit = true;
    }
    for (const list of [this.crowds, this.walkers]) {
      for (const person of list) {
        if (Math.abs(person.x - x) > 8 || HURT.has(person.state) || !this.exposed(person)) continue;
        const box = this.box(person, groundAt);
        if (Math.abs(point.y - box.y) > box.height / 2 + HERO.punchPad) continue;
        this.toss(person, person.x - (Math.sign(dx) || 1), HERO.punchToss);
        hit = true;
      }
    }
    if (this.strikeLife(point, point, HERO.punchPad, groundAt, dx * 150, 110)) hit = true;
    if (this.strikeBoats(point, point, HERO.punchPad, groundAt, 0, 'punch')) hit = true;
    if (hit) this.alarm(point.x);
    return hit;
  }

  // Evil mode: a ground pound at world x throws every car and person within radius, harder up close.
  heroPound(worldX, radius, groundAt) {
    if (this.shift === null) return;
    const x = worldX - this.shift;
    for (const car of this.cars) {
      const d = Math.abs(car.x - x);
      if (car.fall || d > radius) continue;
      const strength = 1 - 0.65 * d / radius;
      if (!car.wreck) this.onHeroHit?.(car, 'groundpound');
      this.launch(car, (Math.sign(car.x - x) || 1) * 90 * strength, -180 * strength);
    }
    for (const list of [this.crowds, this.walkers]) {
      for (const person of list) {
        const d = Math.abs(person.x - x);
        if (d > radius || HURT.has(person.state) || !this.exposed(person)) continue;
        this.toss(person, x, 140 * (1 - 0.65 * d / radius));
      }
    }
    const [a, b] = this.span(worldX - radius, worldX + radius, groundAt);
    this.strikeLife(a, b, 6, groundAt, 0, 140);
    this.strikeBoats(a, b, 6, groundAt, 0, 'groundpound');
    this.alarm(worldX);
  }

  // The eye laser is solid against vehicles: the fraction t (0..1) along from→to where the beam
  // first meets a car or boat here, or null. Wrecks still standing block it too; a car tumbling
  // through the air or a sinking boat does not.
  laserBlock(from, to, groundAt) {
    if (this.shift === null) return null;
    const low = Math.min(from.x, to.x) - this.shift;
    const high = Math.max(from.x, to.x) - this.shift;
    let best = null;
    for (const car of this.cars) {
      if (car.fall || car.wreck?.boom >= 0 || car.x < low - 20 || car.x > high + 20) continue;
      const t = segmentBox(from, to, this.box(car, groundAt))?.t;
      if (t !== undefined && (best === null || t < best)) best = t;
    }
    for (const list of [this.boats, this.moored]) {
      for (const boat of list) {
        if (boat.sink !== undefined || boat.promoted || boat.x < low - boat.length || boat.x > high + boat.length) continue;
        const t = this.hitBoat(from, to, boat, groundAt) ?? undefined;
        if (t !== undefined && (best === null || t < best)) best = t;
      }
    }
    return best;
  }

  // Evil mode: the eye laser's beam { x, y, endX, endY } this step. It kills people it crosses and
  // heats the cars it touches until they blow.
  heroLaser(beam, dt, groundAt) {
    if (this.shift === null) return;
    END.x = beam.endX;
    END.y = beam.endY;
    const low = Math.min(beam.x, END.x) - 40 - this.shift;
    const high = Math.max(beam.x, END.x) + 40 - this.shift;
    let hit = false;
    for (const car of this.cars) {
      if (car.fall || car.wreck?.boom >= 0 || car.x < low || car.x > high || !segmentBox(beam, END, this.box(car, groundAt))) continue;
      if (!car.wreck && dt > 0) this.onHeroHit?.(car, 'laser');
      hit = true;
      // The cooling in stepTraffic still runs, so heat past it.
      car.heat = (car.heat ?? 0) + (1 + HERO.cool) * dt;
      if (car.heat > HERO.cook / 2) this.hurt(car, beam.x - this.shift);
      if (car.heat < HERO.cook) continue;
      if (!car.wreck) this.wreck(car, false, true);
      car.wreck.fuse = 0;
    }
    for (const list of [this.crowds, this.walkers]) {
      for (const person of list) {
        if (person.x < low || person.x > high || !this.exposed(person) || person.state === 'thrown'
          || !segmentBox(beam, END, this.box(person, groundAt))) continue;
        this.kill(person, beam.x - this.shift);
        hit = true;
      }
    }
    if (this.strikeLife(beam, END, 0, groundAt, 0, 0)) hit = true;
    if (this.strikeBoats(beam, END, 0, groundAt, dt)) hit = true;
    if (hit) this.alarm(END.x);
    return hit;
  }

  // A car stops for good: hit by debris or burnt out where it stands. blow: it will explode.
  wreck(car, crushed, blow) {
    if (!car.wreck) this.onWreck?.(car);
    car.wreck = { crushed, age: 0, boom: -1, fuse: blow ? WRECK.fuse[0] + this.random() * (WRECK.fuse[1] - WRECK.fuse[0]) : Infinity };
    Object.assign(car, { speed: 0, cruise: 0, bounce: 0, bounceSpeed: 0, panic: 0 });
  }

  // A wreck burns down; one with a lit fuse explodes, setting off the cars beside it and throwing
  // people clear.
  stepWreck(car, dt) {
    const wreck = car.wreck;
    wreck.age += dt;
    if (wreck.boom >= 0) wreck.boom += dt;
    if (wreck.age < wreck.fuse) return;
    wreck.fuse = Infinity;
    wreck.boom = 0;
    sound.blast(Math.min(0.8, 0.4 + car.length / (30 * METRE)));
    this.blastStreet(car);
    this.onBlast?.(car.x + this.shift, Math.min(1, car.length / (11 * METRE) + 0.5));
  }

  // A car blows up on the street: the cars beside it go up or are hurt, people are killed or thrown.
  blastStreet(car) {
    for (const other of this.cars) {
      if (other === car || other.fall || other.wreck?.boom >= 0) continue;
      const gap = Math.abs(other.x - car.x) - (other.length + car.length) / 2;
      if (gap > WRECK.chain) {
        if (gap <= WRECK.shock) this.hurt(other, car.x);
        continue;
      }
      if (other.wreck) other.wreck.fuse = Math.min(other.wreck.fuse, other.wreck.age + 0.2 + this.random() * 0.4);
      else this.wreck(other, false, true);
    }
    for (const list of [this.crowds, this.walkers]) {
      for (const person of list) {
        if (person.state === 'dead' || ['board', 'enter', 'exit'].includes(person.state)) continue;
        const d = Math.abs(person.x - car.x);
        if (d < car.length / 2) this.kill(person, car.x);
        else if (d < car.length / 2 + WRECK.blast) this.toss(person, car.x, 110);
      }
    }
    this.alarm(car.x + this.shift);
  }

  // Grab and throw: the nearest person or vehicle the hero (world { x, y }) can lift, as the body
  // EnemyThrow carries and throws, or null. reach: px from the hero to its body. size: the largest
  // LIFT_SIZES index the hero lifts. A car that has already blown up has nothing left to throw, and
  // nobody already off their feet is picked up.
  liftable(hero, reach, size, groundAt) {
    if (this.shift === null) return null;
    let best = null;
    let nearest = reach;
    const gap = box => Math.hypot(Math.max(0, Math.abs(hero.x - box.x) - box.width / 2),
      Math.max(0, Math.abs(hero.y - box.y) - box.height / 2));
    if (size >= SIZE.person) {
      for (const list of [this.crowds, this.walkers]) {
        for (const person of list) {
          if (HURT.has(person.state) || !this.exposed(person) || Math.abs(person.x + this.shift - hero.x) > reach + 5) continue;
          const box = this.box(person, groundAt);
          const distance = gap(box);
          if (distance > nearest) continue;
          nearest = distance;
          best = person;
          // Carried lying flat across the hands, so half its height is half its width.
          person.body ??= {
            object: true, thud: true, soft: true, size: SIZE.person, radius: person.height / 2, half: 3, width: 7, height: person.height,
            maxHealth: LIFT.body, spinRate: LIFT.tumble,
            grabbed: () => this.pickUp(person), dropped: () => this.putDown(person, groundAt, false),
            burst: () => this.putDown(person, groundAt, true),
            gone: () => {
              this.walkers = this.walkers.filter(other => other !== person);
              this.crowds = this.crowds.filter(other => other !== person);
            },
          };
          person.body.x = box.x;
          person.body.y = box.y;
        }
      }
    }
    for (const boat of this.boats) {
      if (boat.sink !== undefined || boat.held) continue;
      const weight = weigh(boat.length);
      if (weight > size || Math.abs(boat.x + this.shift - hero.x) > reach + boat.length) continue;
      const height = boat.height ?? 12;
      const box = this.box(boat, groundAt, boat.length, height);
      const distance = gap(box);
      if (distance > nearest) continue;
      nearest = distance;
      best = boat;
      boat.body ??= {
        object: true, size: weight, radius: (boat.length + height) / 4, half: height / 2,
        width: boat.length, height, maxHealth: Math.round(boat.length * LIFT.mass), spinRate: LIFT.spin * 0.5,
        scrap: [boat.hull ?? boat.paint ?? 0x8a9aa4, boat.sail ?? 0xe8e2d4, CHAR, 0x6b4a32],
        // turn and pause hold a boat still, on the sea and on the lake.
        grabbed: () => { Object.assign(boat, { held: boat.body, turn: 1e9, pause: 1e9 }); this.alarm(boat.x + this.shift); },
        dropped: () => this.unship(boat, true), burst: () => this.unship(boat, false),
        gone: () => { this.boats = this.boats.filter(other => other !== boat); },
      };
      boat.body.x = box.x;
      boat.body.y = box.y;
    }
    for (const car of this.cars) {
      if (car.fall || car.wreck?.boom >= 0) continue;
      const weight = car.heavy ? SIZE.rubble : weigh(car.length);
      if (weight > size || Math.abs(car.x + this.shift - hero.x) > reach + car.length) continue;
      const box = this.box(car, groundAt);
      const distance = gap(box);
      if (distance > nearest) continue;
      nearest = distance;
      best = car;
      // One body per car, made the first time it comes into reach and reused after.
      car.body ??= {
        object: true, size: weight, radius: (car.length + car.height) / 4, half: car.height / 2,
        // The hands take it by the chassis, so the wheels hang below them.
        hold: car.height / 2 - (car.kind === 'bus' ? Math.round(0.5 * METRE) : Math.max(2, Math.round(car.height * 0.2))),
        width: car.length, height: car.height, maxHealth: Math.round(car.length * LIFT.mass), spinRate: LIFT.spin,
        scrap: [car.paint, GLASS, TYRE, lerpColor(car.paint, CHAR, 0.5)],
        grabbed: from => this.lift(car, from), dropped: () => this.letGo(car, groundAt),
        burst: () => this.burst(car, groundAt),
        gone: () => { this.cars = this.cars.filter(other => other !== car); },
      };
      car.body.x = box.x;
      car.body.y = box.y;
    }
    if (best) best.body.distance = nearest;
    return best?.body ?? null;
  }

  // A boat leaves the hero's hands. Let go over water it founders where it comes down; thrown into
  // something (EnemyThrow deals the blast), or let go over land, there is nothing left of it.
  // ponytail: no falling hull or wreck on land. Give it one if dropped boats should litter the shore.
  unship(boat, whole) {
    if (!boat.held) return;
    boat.x = boat.held.x - this.shift;
    boat.held = null;
    this.onBoatLost?.(boat);
    if (whole && isWater(boat.x)) {
      Object.assign(boat, { sink: 0, list: this.random() < 0.5 ? -1 : 1 });
      sound.splash(Math.min(1, boat.length / (20 * METRE)));
    } else {
      this.boats = this.boats.filter(other => other !== boat);
      if (whole) sound.crash(0.6);
    }
  }

  // The hero snatches someone off the street: they kick in its hands, and the street panics.
  pickUp(person) {
    Object.assign(person, { state: 'held', angle: 0, air: null, doomed: false });
    this.alarm(person.x + this.shift);
  }

  // A held or thrown person leaves the hero's hands where the body is and falls from there. Let go,
  // they land stunned. Thrown (doomed), they die where they land and bowl over whoever is beside it.
  putDown(person, groundAt, doomed) {
    const body = person.body;
    if (person.state !== 'held') return;
    person.x = body.x - this.shift;
    const spin = Math.sign(body.spin ?? 0) || person.dir;
    Object.assign(person, { state: 'thrown', doomed, angle: (body.spin ?? 0) + Math.PI / 2,
      air: { h: Math.max(0, groundAt(body.x) - body.y - person.height / 2), vx: 0, vy: 0, spin: spin * 8 } });
    if (!doomed || person.air.h > LIFT.low) return;
    for (const list of [this.crowds, this.walkers]) {
      for (const other of list) {
        if (other === person || HURT.has(other.state) || !this.exposed(other)) continue;
        if (Math.abs(other.x - person.x) < LIFT.bowl) this.toss(other, person.x, 70);
      }
    }
  }

  // The hero lifts a car off the road: the driver jumps out and runs, and the street panics.
  lift(car, hero) {
    this.hurt(car, hero.x - this.shift);
    Object.assign(car, { speed: 0, cruise: 0, panic: 0, startle: 0 });
    // A wreck about to blow is defused by the lift: it goes off when it is thrown instead.
    if (car.wreck) car.wreck.fuse = Infinity;
    car.fall = { held: car.body, h: 0, vx: 0, vy: 0, angle: 0, spin: 0, sink: 0, splash: -1 };
    this.alarm(car.x + this.shift);
  }

  // A held or thrown car is let go where it is: it drops, and wrecks where it lands.
  letGo(car, groundAt) {
    const fall = car.fall;
    const body = fall?.held;
    if (!body) return;
    fall.held = null;
    car.x = body.x - this.shift;
    fall.h = Math.max(1, groundAt(body.x) - body.y - car.height / 2);
    fall.angle = body.spin ?? 0;
    fall.spin = Math.sign(fall.angle) * (1 + this.random() * 2);
  }

  // A thrown car hits something and blows up (EnemyThrow deals the blast): what is left is a
  // burnt-out wreck that drops to the street. Low down, the street around it takes the blast too.
  burst(car, groundAt) {
    const body = car.fall?.held;
    if (!body) return;
    this.letGo(car, groundAt);
    this.wreck(car, false, false);
    car.wreck.boom = 0;
    car.fall.vx = Math.sign(car.fall.angle) * 30;
    car.fall.vy = -60;
    if (car.fall.h <= LIFT.low) this.blastStreet(car);
  }

  // An armoured vehicle takes a hit it holds against: it rocks on its springs and dents.
  knock(car) {
    car.tough--;
    car.bounceSpeed += 70;
    car.dent = (car.dent ?? 0) + 1;
    sound.crunch(0.4);
  }

  // A car takes a knock it survives: it is stranded, smoking, its alarm going, and the driver
  // jumps out and runs from fromX.
  hurt(car, fromX) {
    if (car.hurt !== undefined || car.wreck || car.fall) return;
    car.hurt = 0;
    car.cruise = 0;
    const driver = this.person(car.x);
    Object.assign(driver, { lane: car.lane, state: 'flee', dir: Math.sign(car.x - fromX) || 1,
      timer: ALARM.flee[0] + this.random() * (ALARM.flee[1] - ALARM.flee[0]) });
    this.walkers.push(driver);
  }

  // Height of a broken deck above the terrain or water: where an unsupported car starts falling.
  deckHeight(x) {
    return Math.max(0, streetRise(x) - Math.max(0, elevation(x)));
  }

  // A car whose road has gone from under it (over open water, no deck) leaves its lane and falls:
  // it carries its speed off the edge, tumbles nose-first, splashes down, then sinks and is gone.
  stepFalling(dt) {
    let falling = false;
    for (const car of this.cars) {
      // A car fading out at a road end barely creeps past it and never falls in.
      let lostDeck = false;
      if (!car.fall && !car.tunnel) for (const deck of this.brokenBridgeDecks) {
        if (car.x > deck.from && car.x < deck.to) { lostDeck = true; break; }
      }
      if (!car.fall && !car.tunnel && (isWater(car.x, this.bridges) || lostDeck && this.deckHeight(car.x) > 0)) {
        const dir = LANES[car.lane].dir;
        car.fall = { h: this.deckHeight(car.x), vx: dir * Math.max(car.speed, 2 * METRE), vy: -12, angle: 0,
          spin: dir * (1.2 + this.random() * 1.6), sink: 0, splash: -1 };
      }
      const fall = car.fall;
      if (!fall) continue;
      if (fall.held) {
        // In the hero's hands or thrown: EnemyThrow moves the body, the car follows.
        car.x = fall.held.x - this.shift;
        continue;
      }
      falling = true;
      car.speed = 0;
      car.x += fall.vx * dt;
      if (fall.h > 0) {
        fall.vy += FALL.gravity * dt;
        fall.h -= fall.vy * dt;
        fall.angle += fall.spin * dt;
        // On land a tilted car comes down on its lowest corner and topples flat before it wrecks,
        // rather than sinking into the street and snapping level.
        const corner = Math.abs(Math.sin(fall.angle)) * car.length / 2
          + Math.abs(Math.cos(fall.angle)) * car.height / 2 - car.height / 2;
        if (fall.h <= corner && fall.vy < 0 && !fall.tip) fall.h = corner;
        else if ((fall.h <= corner || fall.tip) && !isWater(car.x, this.bridges)) {
          const flat = Math.round(fall.angle / Math.PI) * Math.PI;
          const toward = Math.sign(flat - fall.angle);
          if (!fall.tip || Math.sign(fall.spin) !== toward) fall.spin = toward * Math.max(2, Math.abs(fall.spin) * 0.5);
          fall.tip = true;
          fall.spin += toward * 14 * dt;
          if (Math.abs(flat - fall.angle) <= Math.abs(fall.spin * dt) + 0.01) {
            fall.angle = flat;
            this.land(car);
            continue;
          }
          fall.h = corner;
          fall.vy = Math.min(0, fall.vy);
          fall.vx *= Math.exp(-6 * dt);
          continue;
        }
        if (fall.h <= 0) {
          // In the water it splashes down and sinks.
          fall.h = 0;
          fall.splash = 0;
          sound.splash(Math.min(1, car.length / (12 * METRE)));
        }
        continue;
      }
      // In the water: drag stops it, it settles nose-down, and goes under.
      if (!car.wreck) this.wreck(car, false, false);
      fall.vx *= Math.exp(-2.5 * dt);
      fall.splash += dt;
      fall.sink += dt;
      fall.angle += (Math.sign(fall.spin) * 0.7 - fall.angle) * (1 - Math.exp(-2 * dt));
    }
    if (falling) this.cars = this.cars.filter(car => !car.fall || car.fall.sink < FALL.sink);
  }

  // Is x on a road the hero could be standing in?
  onRoad() {
    return true;
  }

  // Each car eases to its cruising speed, then brakes to keep a safe gap to the car ahead, to a
  // hero hovering in the road, or to the end of the road. A RAM's wake rocks it on its springs and
  // makes it brake. At a dead end (the shore) it pulls up, waits, and turns back in the other lane
  // once that has room, so no vehicle ever drives into water.
  stepTraffic(dt, hero) {
    // Every area steps its traffic each frame, so decks are checked here too.
    this.stepDecks();
    this.stepFalling(dt);
    if (this.bodies.length || this.boats.length || this.moored.length) this.stepCasualties(dt);
    for (const car of this.cars) {
      if (car.wreck) this.stepWreck(car, dt);
      if (car.heat > 0) car.heat = Math.max(0, car.heat - HERO.cool * dt);
      if (car.hurt !== undefined && !car.wreck) car.hurt += dt;
    }
    const inRoad = hero && hero.altitude < IN_ROAD && this.onRoad(hero.x);
    for (const [index, { dir }] of LANES.entries()) {
      const lane = this.cars.filter(car => car.lane === index && !car.fall).sort((a, b) => (b.x - a.x) * dir);
      lane.forEach((car, i) => {
        // A wreck stays put; the traffic behind stops for it. Cars in a tunnel mouth move on their own.
        if (car.wreck || car.tunnel) return;
        // The car ahead on the same level: one down in an underpass is not in the way of one on the
        // road above it, nor the other way round.
        const below = this.underground(car);
        // A responder on its way overtakes whatever is ahead rather than queueing behind it.
        const racing = car.dispatch !== undefined && !car.deployed;
        let ahead = null;
        for (let k = i - 1; k >= 0 && !ahead && !racing; k--) if (this.underground(lane[k]) === below) ahead = lane[k];
        let target = car.startle > 0 ? 0 : car.rush > 0 ? car.cruise * PANIC.rush : car.cruise;
        if (car.rush > 0) car.rush -= dt;
        // need: the deceleration it takes to stop short of the nearest thing ahead.
        let need = 0;
        const brakeFor = gap => {
          target = Math.min(target, Math.max(0, (gap - SAFE_GAP) * 2));
          need = Math.max(need, car.speed * car.speed / (2 * Math.max(0.5, gap - SAFE_GAP)));
        };
        if (ahead) brakeFor(Math.abs(ahead.x - car.x) - (ahead.length + car.length) / 2);
        // Another area's car in the same lane (traffic spills over area borders) is queued behind too.
        const foreign = racing ? null : this.foreignAhead(car, index, dir);
        if (foreign !== null) brakeFor(foreign);
        // Over the narrow, humped Old Bridge traffic slows to BRIDGE.speed, easing down on the approach.
        const bridge = this.bridgeAhead(car, dir);
        if (bridge !== null) target = Math.min(target, BRIDGE.speed + Math.sqrt(2 * BRIDGE.ease * bridge));
        const end = (this.carEnd(car, dir) - car.x) * dir - car.length / 2;
        // Toward a road end a car slows to a roll rather than a stop, then fades out; an underpass
        // it drives straight into.
        car.underpass = this.underpassAhead(car, dir);
        if (!car.underpass) brakeFor(end + SAFE_GAP + (this.exits?.length ? PORTAL_ROLL / 2 : 0));
        if (inRoad) {
          const gap = (hero.x - car.x) * dir - car.length / 2 - 8;
          // Only cars still short of the hero stop; one already half past drives on.
          if (gap > -car.length / 2) brakeFor(gap);
        }
        if (car.kind === 'bus') target = Math.min(target, this.busTarget(car, dir, dt));
        if (car.dispatch !== undefined) {
          // Siren on: no startle, no stopping for the hero; brake hard onto the stop point.
          target = car.cruise;
          brakeFor((car.dispatch - car.x) * dir + SAFE_GAP);
          // Pulled up, or held up by traffic or the hero on the way: the officers get out there.
          car.halt = car.speed < 1 ? (car.halt ?? 0) + dt : 0;
          if (!car.deployed && car.halt > 0.4) {
            car.deployed = true;
            this.onDeploy?.(car.x + this.shift, car);
          }
        }
        if (hero && this.wake(hero) && hero.altitude < ROCK.altitude
          && Math.abs(hero.x - car.x) < car.length / 2 + ROCK.reach && car.startle <= 0) {
          car.bounceSpeed += 45;
          car.startle = 0.8;
        }
        car.startle -= dt;
        if (car.panic > 0) car.panic -= dt;
        // Drivers brake gently (DRIVE.brake) and only harder when they must, up to an emergency stop.
        const hard = (car.panic > 0 ? 20 : 12) * METRE;
        const rate = target < car.speed ? (car.panic > 0 ? hard : Math.min(hard, Math.max(DRIVE.brake, need * 1.25)))
          : (car.rush > 0 ? 9 : 3) * METRE;
        const before = car.speed;
        car.speed += Math.max(-rate * dt, Math.min(rate * dt, target - car.speed));
        // Hard stop: never past the end of the road or into the car ahead, whatever the braking.
        const room = ahead ? Math.abs(ahead.x - car.x) - (ahead.length + car.length) / 2 : Infinity;
        const was = car.x;
        car.x += dir * Math.min(car.speed * dt, car.underpass ? Infinity : Math.max(0, end), Math.max(0, room));
        // The wheels turn with the distance covered.
        car.roll = (car.roll ?? 0) + (car.x - was);
        // Each axle knocks over the bridge's expansion joints.
        if (this.bridges.length) for (const edge of [BRIDGE_DECK.from, BRIDGE_DECK.to]) {
          for (const axle of [-0.3, 0.3]) {
            const at = edge - axle * car.length;
            if ((was - at) * (car.x - at) < 0) car.bounceSpeed += DRIVE.joint;
          }
        }
        // Damped spring: the body bobs on its wheels and settles.
        car.bounceSpeed += (-260 * car.bounce - 9 * car.bounceSpeed) * dt;
        car.bounce += car.bounceSpeed * dt;
        // The body pitches on its springs: the nose dips under braking and lifts pulling away.
        const accel = dt > 0 ? (car.speed - before) / dt : 0;
        car.braking = car.speed < before - 1e-3 || car.speed < 0.5;
        const pitchTo = dir * Math.max(-DRIVE.squat, Math.min(DRIVE.dive, -accel * DRIVE.pitch));
        car.pitchSpeed = (car.pitchSpeed ?? 0) + (-140 * ((car.pitch ?? 0) - pitchTo) - 16 * (car.pitchSpeed ?? 0)) * dt;
        car.pitch = (car.pitch ?? 0) + car.pitchSpeed * dt;
        car.park = end < 1.5 && !car.underpass ? (car.park ?? 0) + dt : 0;
      });
    }
    this.stepTunnelMouths(dt);
    this.stepExits(dt);
  }

  // Gap to the nearest car ahead in this lane that belongs to a neighbouring area's life (this.neighbours,
  // set by the map), or null. Each area simulates its own traffic, but cars cross area borders.
  foreignAhead(car, lane, dir) {
    if (!this.neighbours) return null;
    let best = null;
    for (const life of this.neighbours) {
      if (life === this || life.shift === null || life.shift === undefined || !life.cars?.length) continue;
      const offset = life.shift - this.shift;
      const below = this.underground(car);
      for (const other of life.cars) {
        if (other.lane !== lane || other.fall || (life.underground?.(other) ?? false) !== below) continue;
        const d = (other.x + offset - car.x) * dir;
        if (d <= 0 || d > 400) continue;
        const gap = d - (other.length + car.length) / 2;
        if (best === null || gap < best) best = gap;
      }
    }
    return best;
  }

  // Distance from a car's nose to the Old Bridge ahead (0 while on it), or null when the bridge is
  // behind it, far off or down.
  bridgeAhead(car, dir) {
    if (!this.bridges.length) return null;
    const at = wrapX(car.x);
    const tail = at - dir * car.length / 2;
    const nose = at + dir * car.length / 2;
    if (dir > 0 ? tail >= BRIDGE_DECK.to : tail <= BRIDGE_DECK.from) return null;
    const d = dir > 0 ? BRIDGE_DECK.from - nose : nose - BRIDGE_DECK.to;
    return d > BRIDGE.look ? null : Math.max(0, d);
  }

  // The underpass a car heading dir is about to drive into: its road ends at the mouth.
  underpassAhead(car, dir) {
    for (const under of this.underpasses ?? []) {
      const ahead = (under.x - car.x) * dir;
      if (under.dir === dir && ahead > -car.length && ahead < UNDERPASS.ramp + 600
        && Math.abs(this.carEnd(car, dir) - under.x) < 40) return under;
    }
    return null;
  }

  // How far (px) below the road a car on an underpass ramp or in its tunnel sits. Only cars going
  // into it or coming out of it: other traffic nearby (Ember Base's) stays on the road.
  // Down an underpass far enough to be under the road, out of the way of traffic on it.
  underground(car) {
    return (this.underpasses?.length ?? 0) > 0 && this.underpassSink(car).sink > UNDERPASS.depth / 2;
  }

  // Also its tilt (radians) on the ramp, front and rear axle each at the ramp's depth under them.
  underpassSink(car) {
    if (car.fall || car.wreck) return { sink: 0, tilt: 0 };
    for (const under of this.underpasses ?? []) {
      if (car.underpass !== under && car.fromUnderpass !== under) continue;
      const t = ((car.x - under.x) * under.dir + UNDERPASS.ramp) / UNDERPASS.ramp;
      if (t <= 0 || t >= 1 + UNDERPASS.cover / UNDERPASS.ramp) continue;
      const depth = x => {
        const u = Math.min(1, Math.max(0, ((x - under.x) * under.dir + UNDERPASS.ramp) / UNDERPASS.ramp));
        return UNDERPASS.depth * u * u * (3 - 2 * u);
      };
      const half = car.length * 0.35;
      const [back, front] = [depth(car.x - half), depth(car.x + half)];
      return { sink: (back + front) / 2, tilt: Math.atan2(front - back, half * 2) };
    }
    return { sink: 0, tilt: 0 };
  }

  // Drawn over the traffic: the ramp's concrete retaining wall with its railing, the tunnel's
  // headwall at the mouth with hazard stripes, and the ground over the tunnel beyond it, which hide
  // the cars going down; plus a blue underpass sign at the top of the ramp.
  drawUnderpasses(g, groundAt, left, right) {
    const { ramp, depth, cover } = UNDERPASS;
    for (const under of this.underpasses ?? []) {
      const mouth = under.x + this.shift;
      const dir = under.dir;
      const top = mouth - dir * ramp;
      const far = mouth + dir * cover;
      if (Math.max(top, far) < left - 40 || Math.min(top, far) > right + 40) continue;
      const wall = depth + 6;
      // Ground over the tunnel past the mouth.
      const earth = groundColors(mouth + dir * 40).ground;
      for (let i = 0; i < cover; i += 4) {
        const x = Math.round(mouth + dir * i - (dir < 0 ? 4 : 0));
        const y = Math.round(groundAt(x + 2));
        g.fillStyle(earth[1] ?? earth[0]);
        g.fillRect(x, y, 4, wall);
        g.fillStyle(earth[0]);
        g.fillRect(x, y, 4, 2);
      }
      // Retaining wall along the ramp, with expansion joints, a coping and railing posts.
      for (let i = 0; i < ramp; i += 4) {
        const x = Math.round(top + dir * i - (dir < 0 ? 4 : 0));
        const y = Math.round(groundAt(x + 2));
        const t = i / ramp;
        g.fillStyle(0x9c9a92);
        g.fillRect(x, y, 4, wall);
        g.fillStyle(0x7e7c75);
        g.fillRect(x, y + Math.round(6 + t * (wall - 8)), 4, 1);
        g.fillStyle(0xc4c2ba);
        g.fillRect(x, y - 1, 4, 2);
        if (i % 40 === 0) {
          g.fillStyle(0x86847d);
          g.fillRect(x, y + 1, 1, wall - 1);
          g.fillStyle(0x6a6e72);
          g.fillRect(x, y - 6, 1, 5);
        }
      }
      const [ra, rb] = [top, mouth].sort((a, b) => a - b);
      g.fillStyle(0x8a8e92);
      for (let x = Math.round(ra); x < rb; x += 4) g.fillRect(x, Math.round(groundAt(x)) - 6, 4, 1);
      // Headwall over the mouth: a concrete slab with yellow and black hazard stripes.
      const hx = Math.round(mouth - (dir > 0 ? 0 : 8));
      const hy = Math.round(groundAt(mouth));
      g.fillStyle(0x8a8880);
      g.fillRect(hx, hy - 14, 8, wall + 14);
      g.fillStyle(0xb2b0a8);
      g.fillRect(hx, hy - 15, 8, 2);
      for (let k = 0; k < 4; k++) {
        g.fillStyle(k % 2 ? 0x222222 : 0xe8c030);
        g.fillRect(hx, hy - 12 + k * 3, 8, 3);
      }
      // Blue sign at the top of the ramp: a white arrow pointing down.
      const sx = Math.round(top - dir * 10);
      const sy = Math.round(groundAt(sx));
      g.fillStyle(0x5a5e62);
      g.fillRect(sx, sy - 20, 1, 20);
      g.fillStyle(0x2a5aa8);
      g.fillRect(sx - 5, sy - 28, 11, 9);
      g.fillStyle(0xffffff);
      g.fillRect(sx, sy - 27, 1, 5);
      g.fillRect(sx - 2, sy - 23, 5, 1);
      g.fillRect(sx - 1, sy - 22, 3, 1);
    }
  }

  // Every dead end of this area's road: just short of each shore along the street (bridges
  // excepted) and at the area's own road ends (this.ends). Planet-local x; mouth is where a stopped
  // car's nose sits, dir points past the road's end. An end facing across open water is linked to
  // the one on the far bank, so cars that fade out on one side fade back in on the other.
  refreshExits() {
    const exits = [];
    if (this.noRoads) {
      this.exits = exits;
      return;
    }
    const [from, to] = this.streetSpan;
    const STEP = 4;
    let wet = isWater(from - 400, this.bridges);
    for (let x = from - 400 + STEP; x <= to + 400; x += STEP) {
      const now = isWater(x, this.bridges);
      if (now && !wet) exits.push({ x: x - STEP - ROAD_END, dir: 1, water: true });
      if (!now && wet) exits.push({ x: x + ROAD_END, dir: -1, water: true });
      wet = now;
    }
    for (const [i, end] of (this.ends ?? []).entries()) if (end !== null) exits.push({ x: end, dir: i ? 1 : -1 });
    for (const under of this.underpasses ?? []) {
      const exit = exits.find(e => e.dir === under.dir && Math.abs(e.x - under.x) < 4);
      if (exit) exit.underpass = under;
      else exits.push({ x: under.x, dir: under.dir, underpass: under });
    }
    // Only dead ends the street actually reaches.
    this.exits = exits.filter(exit => exit.x > from - 300 && exit.x < to + 300).sort((a, b) => a.x - b.x);
    for (const exit of this.exits) Object.assign(exit, { mouth: exit.x + exit.dir * (exit.water ? 2 : 0), queue: [] });
    for (let i = 0; i + 1 < this.exits.length; i++) {
      const [near, far] = [this.exits[i], this.exits[i + 1]];
      if (near.dir === 1 && far.dir === -1 && near.water && far.water) {
        near.link = far;
        far.link = near;
      }
    }
  }

  // The road end a car has pulled up at, if any.
  portalAhead(car) {
    const dir = LANES[car.lane].dir;
    const nose = car.x + dir * car.length / 2;
    return this.exits?.find(exit => exit.dir === dir && Math.abs(exit.mouth - nose) < 8) ?? null;
  }

  // Cars at a road end roll on a little, fading, and are gone once faded out; if the end is linked,
  // the same car fades in across the water after the crossing. Cars fading in roll back onto the
  // road, then rejoin the traffic.
  stepTunnelMouths(dt) {
    for (const car of this.cars) {
      if (car.fall || car.wreck) continue;
      if (!car.tunnel && car.park > 0 && !car.hurt) {
        // A dead end not in the list (none should be left) still never strands a car.
        const dir = LANES[car.lane].dir;
        const exit = this.portalAhead(car) ?? (car.park > 1 ? { mouth: car.x + dir * car.length / 2, dir, queue: [] } : null);
        if (exit) {
          car.tunnel = { exit, inward: exit.dir, depth: 0, hide: FADE };
          car.exit = 0;
          car.speed = Math.max(car.speed, PORTAL_ROLL);
        }
      }
      const tunnel = car.tunnel;
      if (!tunnel) continue;
      if (car.exit !== undefined) car.exit += dt;
      if (car.enter !== undefined) car.enter += dt;
      const step = car.speed * dt;
      const going = car.exit !== undefined ? 1 : -1;
      car.x += tunnel.inward * going * step * DRIFT;
      tunnel.depth += going * step;
    }
    const gone = [];
    this.cars = this.cars.filter(car => {
      // Down an underpass and out of sight past its mouth: gone.
      const under = car.underpass;
      if (under && !car.fall && !car.wreck && (car.x - under.x) * under.dir > car.length / 2 + 8) return false;
      const tunnel = car.tunnel;
      if (!tunnel || car.fall || car.wreck) return true;
      if (car.enter !== undefined && tunnel.depth <= 0) {
        // Clear of the mouth: back to ordinary driving, looking afresh for its road's end.
        Object.assign(car, { tunnel: null, enter: undefined, endDir: 0, park: 0 });
        return true;
      }
      if (car.exit !== undefined && tunnel.depth >= tunnel.hide) {
        gone.push(car);
        return false;
      }
      return true;
    });
    for (const car of gone) {
      const { exit } = car.tunnel;
      const far = exit.link;
      if (!far || far.queue.length >= PORTAL_QUEUE) continue;
      const crossing = Math.min(8, Math.max(1, Math.abs(far.mouth - exit.mouth) / Math.max(car.cruise, 1)));
      far.queue.push({ car, wait: crossing });
    }
  }

  // While a road end is near the view, cars fade in there: first any that faded out across the
  // water, then now and then a new one, onto the lane heading away from the dead end.
  stepExits(dt) {
    if (!this.exits) this.refreshExits();
    const [from, to] = this.view ?? [-Infinity, Infinity];
    for (const exit of this.exits) {
      for (const queued of exit.queue) queued.wait -= dt;
      if (exit.x < from - SPAWN_FAR || exit.x > to + SPAWN_FAR) {
        exit.queue.length = 0;
        continue;
      }
      exit.timer = (exit.timer ?? EXIT_GAP[0] * this.random()) - dt;
      const due = exit.queue.findIndex(queued => queued.wait <= 0);
      if (due < 0 && exit.timer > 0) continue;
      const lane = LANES.findIndex(l => l.dir === -exit.dir);
      const car = due >= 0 ? exit.queue[due].car : this.car(exit.x, lane);
      const hide = FADE;
      // Faded out just past the end, its nose toward the road; or, from an underpass, still in the
      // tunnel just past the mouth.
      const x = exit.underpass ? exit.mouth + exit.dir * (car.length / 2 + 6) : exit.mouth + exit.dir * (hide * DRIFT - car.length / 2);
      if (this.cars.some(other => other.lane === lane && Math.abs(other.x - x) < (other.length + car.length) / 2 + SAFE_GAP * 2)) continue;
      if (due >= 0) exit.queue.splice(due, 1);
      else exit.timer = EXIT_GAP[0] + this.random() * (EXIT_GAP[1] - EXIT_GAP[0]);
      if (exit.underpass) Object.assign(car, { x, lane, speed: car.cruise, enter: undefined, exit: undefined, park: 0, endDir: 0, tunnel: null, fromUnderpass: exit.underpass });
      else Object.assign(car, { x, lane, speed: PORTAL_ROLL * 1.5, enter: 0, exit: undefined, park: 0, endDir: 0,
        tunnel: { exit, inward: exit.dir, depth: hide, hide } });
      this.cars.push(car);
    }
  }

  // Can a car of the given length start at x in lane, clear of the road's end ahead and with its
  // tail on the road behind?
  roomToSpawn(car) {
    const dir = LANES[car.lane].dir;
    return Math.abs(this.roadEnd(car.x, dir) - car.x) >= car.length + ROAD_END
      && Math.abs(this.roadEnd(car.x, -dir) - car.x) >= car.length / 2 + ROAD_END
      && this.clearOfNeighbours(car);
  }

  // No neighbouring area's car (one that has driven over the border) on the same level in its lane
  // where this one would appear.
  clearOfNeighbours(car) {
    if (!this.neighbours) return true;
    const below = this.underground(car);
    for (const life of this.neighbours) {
      if (life === this || life.shift === null || life.shift === undefined || !life.cars?.length) continue;
      const offset = life.shift - this.shift;
      for (const other of life.cars) {
        if (other.lane !== car.lane || other.fall || (life.underground?.(other) ?? false) !== below) continue;
        if (Math.abs(other.x + offset - car.x) < (other.length + car.length) / 2 + SAFE_GAP) return false;
      }
    }
    return true;
  }

  // A bus slows into the next stop ahead, waits there, then pulls away.
  busTarget(bus, dir, dt) {
    if (bus.dwell > 0) {
      bus.dwell -= dt;
      return 0;
    }
    const ahead = this.stops.filter(stop => stop !== bus.lastStop && (stop.x - bus.x) * dir > -2);
    const stop = ahead.sort((a, b) => (a.x - b.x) * dir)[0];
    if (!stop) return Infinity;
    const gap = (stop.x - bus.x) * dir;
    if (gap > 2) return gap * 1.5 + 3;
    bus.dwell = DWELL;
    bus.lastStop = stop;
    this.arrive(bus, stop);
    return 0;
  }

  // Back pavement, far lane, near lane, then front pavement, so walkers in front stay readable.
  // Rain dims everything under the hero, then falls in front of it all. top/bottom: the view's
  // world span.
  draw(g, left, right, groundAt, top, bottom) {
    if (this.shift === null) return;
    // The shower belongs to the city: it thins out over the 800 px past either end.
    const centre = (left + right) / 2 - this.shift;
    const beyond = Math.max(CITY.from - centre, centre - CITY.to, 0);
    const rain = this.rain * Math.max(0, 1 - beyond / 800);
    if (rain > 0.01) {
      g.fillStyle(0x4a5a68, 0.2 * rain);
      g.fillRect(left, top, right - left, bottom - top);
    }
    const visible = item => item.x + this.shift > left - 40 && item.x + this.shift < right + 40;
    const people = [...this.crowds, ...this.walkers].filter(visible);
    for (const stop of this.stops) if (visible(stop)) this.drawStop(g, stop, groundAt);
    const flocks = this.flocks.filter(flock => flock.state !== 'gone' && flock.x + this.shift > left - 300 && flock.x + this.shift < right + 300);
    for (const flock of flocks) if (flock.state === 'perched') this.drawPerched(g, flock, groundAt);
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
    this.drawBodies(g, groundAt, left, right);
    for (const flock of flocks) if (flock.state === 'flying') this.drawFlying(g, flock, groundAt);
    if (rain > 0.01) this.drawRain(g, left, right, top, bottom, rain);
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'policebike') { drawPoliceBike(g, car, groundAt, this.shift, this.clock); return; }
    car.kind === 'bus' ? this.drawBus(g, car, groundAt) : car.kind === 'tank' ? this.drawTank(g, car, groundAt)
      : ARMOURED.has(car.kind) ? this.drawArmoured(g, car, groundAt) : this.drawCar(g, car, groundAt);
  }

  // Every vehicle draws through here: on the road as usual (with skid marks while panic-braking),
  // or, once its bridge has gone, tumbling down, splashing in and sinking.
  drawTraffic(g, car, groundAt) {
    const fall = car.fall;
    const x = Math.round(car.x + this.shift);
    if (car.wreck && !fall) {
      this.drawWreck(g, car, groundAt);
      return;
    }
    if (!fall) {
      if (car.panic > 0 && car.speed > 0.5) {
        const dir = LANES[car.lane].dir;
        const base = Math.round(groundAt(x)) + LANES[car.lane].y;
        const skid = Math.round(Math.min(18, car.speed * 0.6));
        g.fillStyle(0x23262a, 0.45 * Math.min(1, car.panic));
        g.fillRect(Math.round(dir > 0 ? x - car.length / 2 - skid : x + car.length / 2), base - 1, skid, 1);
      }
      // Under the laser the metal glows orange before it blows.
      const glow = Math.min(0.8, (car.heat ?? 0) / HERO.cook);
      // At a road end the car fades out (or in).
      const away = car.tunnel ? Math.min(1, Math.max(0, car.tunnel.depth / car.tunnel.hide)) : 0;
      // On an underpass ramp: lowered behind the retaining wall.
      const { sink, tilt } = this.underpassSink(car);
      if (sink > 0.5) {
        // Pitched to the ramp about the middle of its wheelbase.
        const px = x;
        const py = Math.round(groundAt(x)) + LANES[car.lane].y;
        g.save();
        g.translateCanvas(px, py + Math.round(sink));
        g.rotateCanvas(tilt);
        g.translateCanvas(-px, -py);
        this.drawVehicle(glow > 0 ? restyled(g, (color, a) => [lerpColor(color, HOT, glow), a]) : g, car, groundAt);
        g.restore();
        return;
      }
      if (away > 0) {
        const fade = 1 - away * away;
        this.drawVehicle(restyled(g, (color, a) => [glow > 0 ? lerpColor(color, HOT, glow) : color, a * fade]), car, groundAt);
        return;
      }
      this.drawVehicle(glow > 0 ? restyled(g, (color, a) => [lerpColor(color, HOT, glow), a]) : g, car, groundAt);
      if (car.hurt !== undefined) {
        // Stranded: grey smoke from the engine, and all four lamps flashing while the alarm lasts.
        const base = Math.round(groundAt(x)) + LANES[car.lane].y;
        const half = Math.round(car.length / 2);
        const nose = x + LANES[car.lane].dir * (half - 4);
        for (let i = 0; i < 4; i++) {
          const p = (this.clock * 0.7 + i / 4) % 1;
          g.fillStyle(0x6a6661, 0.45 * (1 - p) ** 2);
          g.fillCircle(nose + p * 6, base - car.height * 0.6 - p * 28, 1.5 + p * 4);
        }
        if (car.hurt < WRECK.alarm && Math.floor(car.hurt * 4) % 2 === 0) {
          const lamps = base - Math.round(car.height * 0.45);
          g.fillStyle(0xffc94a);
          g.fillRect(x - half, lamps, 2, 2);
          g.fillRect(x + half - 2, lamps, 2, 2);
        }
      }
      return;
    }
    if (fall.held) {
      // Carried or thrown: drawn at its body, turned by the tumble.
      const { x: bx, y: by, spin = 0 } = fall.held;
      const pen = car.wreck ? restyled(g, (color, a) => [lerpColor(color, CHAR, 0.4), a]) : g;
      g.save();
      g.translateCanvas(bx, by);
      g.rotateCanvas(spin);
      g.translateCanvas(-bx, -by);
      car.x = bx - this.shift;
      this.drawVehicle(pen, car, () => by + car.height / 2 - LANES[car.lane].y);
      g.restore();
      return;
    }
    const surface = Math.round(groundAt(x));
    const sunk = fall.sink / FALL.sink;
    const base = surface - fall.h + sunk * car.height * 0.9;
    const pivot = base - car.height / 2;
    g.save();
    g.translateCanvas(x, pivot);
    g.rotateCanvas(fall.angle);
    g.translateCanvas(-x, -pivot);
    // A pen that fades every fill as the car goes under.
    const alpha = 1 - sunk;
    const char = car.wreck ? 0.6 : 0;
    const pen = alpha >= 1 && !char ? g : restyled(g, (color, a) => [char ? lerpColor(color, CHAR, char) : color, a * alpha]);
    this.drawVehicle(pen, car, () => base - LANES[car.lane].y);
    g.restore();
    if (fall.splash >= 0 && fall.splash < FALL.splash) {
      const t = fall.splash / FALL.splash;
      // A white crown of spray thrown up and out, and a ring spreading on the water.
      g.fillStyle(0xeef6f8, 0.85 * (1 - t));
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1;
        const reach = (4 + (i >> 1) * 3) * t * 3;
        const up = 30 * t - 36 * t * t + (i % 3) * 3 * t;
        g.fillRect(Math.round(x + side * reach), Math.round(surface - Math.max(0, up)), 2, 2);
      }
      g.fillStyle(0xeef6f8, 0.6 * (1 - t));
      const ring = Math.round(car.length / 2 + 30 * t);
      g.fillRect(x - ring, surface, ring * 2, 1);
    }
    if (fall.h <= 0) {
      g.fillStyle(0xeef6f8, 0.7 * (1 - sunk));
      for (let i = 0; i < 3; i++) {
        const bob = (this.clock * 2 + i * 0.37) % 1;
        g.fillRect(Math.round(x + (i - 1) * 4), Math.round(surface - bob * 6), 1, 1);
      }
    }
  }

  // Glass and torn metal spread on the road either side of a crushed car.
  drawCrushBits(g, car, x, base, seed) {
    for (let i = 0; i < CRUSH.bits; i++) {
      const u = (hash(seed + i * 3) - 0.5) * (car.length + 14);
      g.fillStyle(i % 3 ? 0x2b2e33 : GLASS, i % 3 ? 0.9 : 0.8);
      g.fillRect(Math.round(x + u), base - 1 - (i % 2), 1 + (i % 2), 1);
    }
  }

  // The chunks that crushed it, lying across the roof.
  drawRubbleOn(g, car, x, roof, seed) {
    for (let i = 0; i < CRUSH.rubble; i++) {
      const w = 3 + Math.round(hash(seed + i * 5) * 5);
      const h = 2 + Math.round(hash(seed + i * 7) * 3);
      const u = (hash(seed + i * 11) - 0.5) * car.length * 0.8;
      g.fillStyle(i % 2 ? 0x8d9097 : 0x6f737a);
      g.fillRect(Math.round(x + u - w / 2), Math.round(roof - h + 1), w, h);
      g.fillStyle(0xffffff, 0.15);
      g.fillRect(Math.round(x + u - w / 2), Math.round(roof - h + 1), w, 1);
    }
  }

  // Wrecks keep their body proportions: charred, tilted, with debris after a falling-piece hit.
  // Explosions add a fireball, then fire and smoke.
  drawWreck(g, car, groundAt) {
    const wreck = car.wreck;
    const x = Math.round(car.x + this.shift);
    const base = Math.round(groundAt(x)) + LANES[car.lane].y;
    const seed = Math.round(car.length * 7 + car.lane * 13 + (car.x | 0));
    const char = wreck.boom >= 0 ? 0.8 : 0.65;
    if (wreck.crushed) this.drawCrushBits(g, car, x, base, seed);
    g.save();
    if (wreck.crushed) {
      // Sagging to one end about the low end's wheel.
      const sag = (hash(seed) - 0.5) * CRUSH.sag;
      g.translateCanvas(x, base);
      g.rotateCanvas(sag);
      g.translateCanvas(-x, -base);
    }
    // A thrown car that landed on its roof lies upside down.
    if (wreck.flip) {
      g.translateCanvas(x, base - car.height / 2);
      g.scaleCanvas(1, -1);
      g.translateCanvas(-x, -(base - car.height / 2));
    }
    this.drawVehicle(restyled(g, (color, a) => [lerpColor(color, CHAR, char), a]), car, groundAt);
    g.restore();
    const top = base - car.height * 0.8;
    if (wreck.crushed) this.drawRubbleOn(g, car, x, base - car.height, seed);
    if (wreck.boom < 0) return;
    if (wreck.boom < WRECK.boom) {
      const t = wreck.boom / WRECK.boom;
      const radius = (6 + car.length * 0.3) * (0.4 + t);
      g.fillStyle(0xff7a2a, 0.7 * (1 - t));
      g.fillCircle(x, top - radius * 0.4, radius * 1.3);
      g.fillStyle(0xffd27a, 1 - t);
      g.fillCircle(x, top - radius * 0.4, radius);
    }
    const fire = 1 - wreck.boom / WRECK.burn;
    if (fire > 0) {
      const tick = Math.floor(this.clock * 12);
      for (let i = 0; i < 3; i++) {
        const height = Math.round((2 + hash(i + tick + car.length) * 5) * fire);
        g.fillStyle(i % 2 ? 0xff9a3c : 0xffd27a, 0.9);
        g.fillRect(Math.round(x + (i - 1) * car.length * 0.25) - 1, Math.round(top) - height, 2, height);
      }
    }
    // Thick black smoke while it burns, thinning to grey after.
    const smoke = Math.min(1, 1.5 - wreck.boom / WRECK.burn);
    if (smoke <= 0) return;
    for (let i = 0; i < 6; i++) {
      // Each puff rises, spreads and fades out (quadratic) within 1.4 s, so none hangs in the air (QA-05).
      const p = (this.clock * 0.7 + i / 6) % 1;
      g.fillStyle(fire > 0 ? 0x34312e : 0x8a8580, 0.5 * (1 - p) ** 2 * smoke);
      g.fillCircle(x + (hash(i + car.length) - 0.5) * car.length * 0.4 + p * 10, top - 4 - p * 50, 2 + p * 6);
    }
  }

  // The dead: each drawn by its own area's art, tumbling through the air or lying on its back.
  drawBodies(g, groundAt, left, right) {
    for (const body of this.bodies) {
      const x = Math.round(body.at.x + this.shift);
      if (x < left - 80 || x > right + 80) continue;
      const y = Math.round(groundAt(x) - body.h) - body.pivot;
      body.base = groundAt;
      g.save();
      g.translateCanvas(x, y);
      g.rotateCanvas(body.angle);
      g.translateCanvas(-x, -y);
      body.draw(g, body.ground, left, right);
      g.restore();
    }
    this.drawBoatParticles(g, groundAt, left, right);
  }

  // Which way a boat's bow points (1 east, -1 west). Areas whose boats keep it elsewhere override.
  boatFacing(boat) {
    return boat.dir ?? (boat.speed < 0 ? -1 : 1);
  }

  // How far through her sinking a holed boat is, as a pose: down (px she has dropped), angle (rad,
  // clockwise), pivot (px from her centre, along x, she turns about), drift (px she slides along x)
  // and squash (her height seen side on: a hull rolling over shows less of itself).
  sinkPose(boat, t) {
    const style = SINKING[boat.kind]?.style;
    const length = boat.length;
    const height = boat.height ?? 12;
    const dir = this.boatFacing(boat);
    const side = boat.list ?? 1;
    const flood = smoothstep(t / 0.25);
    // Enough drop to take her highest point (a reared bow, a raised stern) under the surface.
    const under = angle => height * 1.15 + Math.abs(Math.sin(angle)) * length * 0.55;
    if (style === 'swamp') {
      const slide = smoothstep((t - 0.35) / 0.65);
      return { down: height * (0.25 * flood + 1.4 * slide), angle: side * 0.08 * Math.sin(t * 11) * (1 - t), pivot: 0, drift: 0,
        squash: 1 };
    }
    if (style === 'capsize') {
      // A holed sailing yacht/boat floods and lists heavily, bows plunging or stern settling,
      // her tall mast and sails tilting naturally as she slides under without flattening like paper.
      const list = side * (0.15 * flood + 0.22 * smoothstep(t / 0.7));
      const pitch = -dir * (0.10 * flood + 0.32 * smoothstep((t - 0.2) / 0.7));
      const angle = list + pitch;
      const slide = smoothstep((t - 0.2) / 0.8);
      // Mast height for sailing craft is 1.4-1.8x height: take the whole rig under the surface
      const mastHeight = Math.max(height * 1.6, 34);
      const down = height * 0.18 * flood + (mastHeight + under(angle)) * slide;
      return { down, angle, pivot: dir * length * 0.08, drift: dir * length * 0.1 * slide, squash: 1 };
    }
    if (style === 'stern' || style === 'bow') {
      // Stern first rears the bow (counter-clockwise when she faces east); by the head, the reverse.
      const stern = style === 'stern';
      // She hangs a moment with her bow (or stern) high before she goes.
      const steep = stern ? 0.6 : 0.38;
      const rear = smoothstep((t - 0.1) / 0.45);
      const pitch = 0.04 * flood + steep * rear + 0.15 * smoothstep((t - 0.65) / 0.35);
      const angle = (stern ? -dir : dir) * pitch;
      const slide = Math.pow(clamp01((t - 0.5) / 0.5), 2);
      // The end going down first, as a sign along x. She turns about a point a little towards it,
      // so the other end rises well clear.
      const toward = stern ? -dir : dir;
      return { down: height * 0.05 * flood + under(angle) * slide, angle, pivot: toward * length * 0.1,
        drift: toward * length * 0.12 * slide, squash: 1 - 0.06 * flood };
    }
    if (style === 'founder') {
      // A long, slow settling, low in the water with a heavy list (seen as a lower profile), then
      // she trims by the stern, her bow lifts and she goes under fast.
      const settle = smoothstep(t / 0.6);
      const plunge = smoothstep((t - 0.55) / 0.45);
      const slide = Math.pow(clamp01((t - 0.6) / 0.4), 1.8);
      const angle = -dir * (0.02 * flood + 0.04 * settle + 0.2 * plunge);
      return { down: height * 0.07 * settle + under(angle) * slide, angle, pivot: -dir * length * 0.1, drift: 0,
        squash: 1 - 0.15 * settle };
    }
    // Default: a quick list as she floods, then she settles and slides down.
    const ease = smoothstep(t);
    const angle = side * (0.12 * Math.min(1, t * 5) + 0.42 * ease);
    return { down: ease * height * 1.4, angle, pivot: 0, drift: 0, squash: 1 };
  }

  // A boat, through its area's drawBoat. A holed one goes down the way her kind would (sinkPose):
  // whatever is below the waterline sits behind a veil of water, so she sinks into the sea instead
  // of fading on top of it, with froth where she meets the surface and air bubbling up after her.
  // Areas can add wreckage (drawWreckage). water: the surface y, or a function of world x giving it.
  drawAfloat(g, boat, water, draw = this.drawBoat) {
    // A promoted big ship is drawn by the scene's destruction, holes and all.
    if (boat.promoted) return;
    const x = Math.round(boat.x + this.shift);
    const y = Math.round(typeof water === 'function' ? water(x) : water);
    boat.waterY = y;
    if (boat.held) {
      // Out of the water, turned with the body EnemyThrow moves.
      const x = Math.round(boat.x + this.shift);
      const y = Math.round(typeof water === 'function' ? water(x) : water);
      g.save();
      g.translateCanvas(boat.held.x, boat.held.y);
      g.rotateCanvas(boat.held.spin ?? 0);
      g.translateCanvas(-x, -(y - (boat.height ?? 12) / 2));
      draw.call(this, g, boat, water);
      g.restore();
      return;
    }
    if (boat.sink === undefined) {
      draw.call(this, g, boat, water);
      if (boat.holes?.length) {
        this.drawBoatHoles(g, boat, x, y);
      }
      return;
    }
    const time = sinkTime(boat);
    if (boat.sink >= time) return;
    const t = Math.min(1, boat.sink / time);
    const pose = this.sinkPose(boat, t);
    const pivot = x + pose.pivot;
    const height = boat.height ?? 12;
    // Only the very last of her fades: the water veil does the rest.
    const fade = 1 - smoothstep((t - 0.82) / 0.18);
    g.save();
    g.translateCanvas(pivot + pose.drift, y + pose.down);
    g.rotateCanvas(pose.angle);
    g.scaleCanvas(1, pose.squash);
    g.translateCanvas(-pivot, -y);
    draw.call(this, fade < 1 ? restyled(g, (color, a) => [color, a * fade]) : g, boat, water);
    if (boat.holes?.length) this.drawBoatHoles(g, boat, x, y);
    if (boat.fires?.length) this.drawBoatFires(g, boat, x, y, pose);
    g.restore();
    // The veil: the water's own colour over everything of hers below the surface, thin just under
    // it (so the hull shows through as it does afloat) and thick deeper down, feathered at the ends.
    const tint = groundColors(wrapX(boat.x)).water;
    const reach = Math.round(Math.max(boat.length, height) * 0.85 + Math.abs(pose.drift) + 12);
    const deep = Math.round(pose.down + height * 1.8 + Math.abs(Math.sin(pose.angle)) * boat.length * 0.6 + 12);
    const cx = Math.round(x + pose.pivot / 2 + pose.drift);
    // Bands: the first few px stay thin (the hull just under shows, as it does afloat), then murk.
    const edges = [0, 3, 7, 12, deep].filter((v, i, all) => i === 0 || v > all[i - 1]);
    for (let k = 0; k < edges.length - 1; k++) {
      const top = y + 1 + edges[k];
      const h = edges[k + 1] - edges[k];
      // Deeper down the veil is solid: the sea is one colour there, so nothing ghosts through.
      const a = [0.55, 0.8, 0.93][k] ?? 1;
      g.fillStyle(tint, a);
      g.fillRect(cx - reach, top, reach * 2, h);
      g.fillStyle(tint, a < 1 ? a * 0.5 : 1);
      g.fillRect(cx - reach - 6, top, 6, h);
      g.fillRect(cx + reach, top, 6, h);
    }
    this.drawWreckage?.(g, boat, x, y, t);
    // Froth churning where she meets the surface (patchy foam, never one straight line), over the
    // part of her still afloat, and air bubbling up after her, both dying away.
    const span = boat.length * (0.35 + 0.65 * (1 - smoothstep(t)));
    const big = Math.min(2, Math.max(1, boat.length / 120));
    for (let i = 0; i < 9 + Math.round(big * 4); i++) {
      const churn = (this.clock * 1.7 + i * 0.37) % 1;
      const fx = Math.round(cx + ((i * 37 % 9) / 8 - 0.5) * span + Math.sin(this.clock * 3 + i) * 2);
      g.fillStyle(0xeef6f8, 0.7 * (1 - t * 0.8) * (1 - churn));
      g.fillRect(fx - 2, y - 1, Math.round((2 + (i % 3) * 2) * big), 1 + (i % 2));
    }
    for (let i = 0; i < 7; i++) {
      const bob = (this.clock * 2 + i * 0.23) % 1;
      g.fillStyle(0xeef6f8, 0.8 * (1 - t * 0.6) * (1 - bob));
      g.fillRect(Math.round(cx + (i - 3) * span * 0.14), Math.round(y - bob * 7 * big), Math.round(big), Math.round(big));
    }
    // As she goes under for good, the air she held bursts up in a short dome of spray.
    const burst = clamp01((t - 0.8) / 0.2);
    if (burst > 0 && burst < 1) {
      const w = Math.round(boat.length * 0.25 * (0.5 + burst));
      g.fillStyle(0xeef6f8, 0.55 * (1 - burst));
      g.fillEllipse(cx, y - 1, w, Math.max(3, Math.round(w * 0.22 * Math.sin(burst * Math.PI))));
    }
  }

  // Scorched impact holes and fire on holed ships
  drawBoatHoles(g, boat, x, y) {
    for (const hole of boat.holes) {
      const hx = hole.rx;
      const hy = hole.ry;
      const r = hole.radius;
      // Scorched / blasted jagged hole
      g.fillStyle(0x181a1c);
      g.fillRect(x + hx - r, y + hy - Math.round(r * 0.7), r * 2, Math.round(r * 1.4));
      g.fillRect(x + hx - Math.round(r * 0.7), y + hy - r, Math.round(r * 1.4), r * 2);
      // Red-hot fiery interior
      g.fillStyle(0xff3311);
      g.fillRect(x + hx - Math.round(r * 0.5), y + hy - Math.round(r * 0.4), Math.round(r * 1.0), Math.round(r * 0.8));
      // Flickering flame tongues
      if (hole.age < 15) {
        const flameH = Math.round(r * (0.8 + 0.4 * Math.sin(this.clock * 18 + hole.rx)));
        g.fillStyle(0xffaa22);
        g.fillTriangle(x + hx - 3, y + hy - 2, x + hx + 3, y + hy - 2, x + hx, y + hy - 2 - flameH);
        g.fillStyle(0xff3311);
        g.fillTriangle(x + hx - 2, y + hy - 1, x + hx + 2, y + hy - 1, x + hx, y + hy - 1 - Math.round(flameH * 0.6));
      }
    }
  }

  // Roaring flames and glowing embers across damaged deck, cabin, and wheelhouse
  drawBoatFires(g, boat, x, y, pose) {
    if (!boat.fires) return;
    const t = boat.sink !== undefined ? Math.min(1, boat.sink / sinkTime(boat)) : 0;
    const fade = Math.max(0, 1 - (t - 0.72) / 0.28);
    if (fade <= 0.01) return;

    for (const fire of boat.fires) {
      const hx = fire.rx;
      const hy = fire.ry;
      const size = fire.size * (0.8 + 0.3 * Math.sin(this.clock * 10 + fire.seed));

      // Scorched soot base
      g.fillStyle(0x141618, 0.9 * fade);
      g.fillRect(x + hx - Math.round(size * 0.8), y + hy - 1, Math.round(size * 1.6), 2);

      // Flickering flame tongues (wind swept)
      const fH = Math.round(size * (1.3 + 0.6 * Math.sin(this.clock * 24 + fire.seed * 4)));
      const fW = Math.round(size * 0.75);
      const flutter = Math.round(Math.sin(this.clock * 18 + fire.seed * 2) * 2);

      // Roaring outer orange/red flame
      g.fillStyle(0xdd3311, 0.9 * fade);
      g.fillTriangle(x + hx - fW, y + hy, x + hx + fW, y + hy, x + hx + flutter, y + hy - fH);

      // Bright yellow/gold body
      g.fillStyle(0xffaa22, 0.95 * fade);
      g.fillTriangle(x + hx - Math.round(fW * 0.65), y + hy, x + hx + Math.round(fW * 0.65), y + hy, x + hx + Math.round(flutter * 0.7), y + hy - Math.round(fH * 0.75));

      // White-hot core
      g.fillStyle(0xfff4cc, fade);
      g.fillTriangle(x + hx - Math.round(fW * 0.35), y + hy, x + hx + Math.round(fW * 0.35), y + hy, x + hx + Math.round(flutter * 0.4), y + hy - Math.round(fH * 0.45));
    }
  }

  // Active destruction particles: water splash rings, rising smoke, tumbling debris, and sparks
  drawBoatParticles(g, groundAt, left, right) {
    // Water splash rings
    for (const sp of this.boatSplashes) {
      const t = sp.age / sp.life;
      const r = sp.radius * (0.4 + 0.6 * t);
      g.fillStyle(0xeef6f8, 0.75 * (1 - t));
      g.fillEllipse(sp.x, sp.y, r * 2, Math.max(2, r * 0.5));
      g.fillStyle(0xffffff, 0.9 * (1 - t));
      g.fillEllipse(sp.x, sp.y, Math.max(1, (r - 2) * 2), Math.max(1, (r - 2) * 0.5));
    }
    // Billowing multi-layered smoke puffs
    for (const sm of this.boatSmokes) {
      const t = sm.age / sm.life;
      const alpha = (sm.color === 0xdde6ec ? 0.75 : 0.8) * (1 - t * t);
      g.fillStyle(sm.color ?? 0x22262a, alpha);
      g.fillCircle(sm.x, sm.y, sm.radius);
      // Darker / denser core for large dark smoke puffs
      if (sm.radius > 6 && sm.color !== 0xdde6ec) {
        g.fillStyle(0x141618, alpha * 0.6);
        g.fillCircle(sm.x, sm.y + 1, sm.radius * 0.55);
      }
    }
    // Flying debris fragments
    for (const piece of this.boatDebris) {
      if (piece.x < left - 20 || piece.x > right + 20) continue;
      g.save();
      g.translateCanvas(piece.x, piece.y);
      g.rotateCanvas(piece.angle);
      g.fillStyle(piece.color);
      g.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
      g.restore();
    }
    // Bright glowing sparks and fire embers
    for (const s of this.boatSparks) {
      if (s.x < left - 20 || s.x > right + 20) continue;
      const t = s.age / s.life;
      g.fillStyle(s.color, 1 - t);
      g.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    }
  }

  // People knocked off their feet draw rotated: tumbling through the air, or lying flat.
  drawFigure(g, person, groundAt) {
    const onDeck = person.pier && !person.offDeck;
    // If a person is in open water without a deck, they are submerged and not drawn floating or walking on water
    if (!onDeck && isWater(person.x, this.bridges)) return;
    if (person.state === 'held') {
      // Lying across the hero's hands, turned with the body EnemyThrow moves.
      const x = Math.round(person.x + this.shift);
      const feet = Math.round(groundAt(x)) + 1 + person.lane * 3 - (person.lift ?? 0);
      g.save();
      g.translateCanvas(person.body.x, person.body.y);
      g.rotateCanvas((person.body.spin ?? 0) + Math.PI / 2);
      g.translateCanvas(-x, -(feet - person.height / 2));
      this.drawPerson(g, person, groundAt);
      g.restore();
      return;
    }
    if (!person.angle) {
      this.drawPerson(g, person, groundAt);
      return;
    }
    const x = Math.round(person.x + this.shift);
    const feet = Math.round(groundAt(x)) + 1 + person.lane * 3 - (person.lift ?? 0);
    const lift = (person.air?.h ?? 0) + Math.round(person.height * 0.14);
    g.save();
    g.translateCanvas(x, feet - lift);
    g.rotateCanvas(person.angle);
    g.translateCanvas(-x, -feet);
    this.drawPerson(g, person, groundAt);
    g.restore();
  }

  // Streaks fixed to the view, falling fast with a slight slant; more of them as the shower builds.
  drawRain(g, left, right, top, bottom, rain) {
    const width = right - left;
    const height = bottom - top;
    const count = Math.round(rain * width * height / 2200);
    g.fillStyle(0xdfeaf2, 0.35);
    for (let i = 0; i < count; i++) {
      const x = left + ((hash(i + 0.13) * width + this.clock * 30) % width);
      const y = top + ((hash(i + 0.71) * height + this.clock * (380 + hash(i) * 120)) % height);
      g.fillRect(Math.round(x), Math.round(y), 1, 4);
      g.fillRect(Math.round(x) - 1, Math.round(y) + 4, 1, 3);
    }
  }

  // Far behind the city: drawn before the buildings, as a flat pale silhouette with no detail.
  drawSky(g, left, right, groundAt) {
    const craft = this.aircraft;
    if (this.shift === null || !craft) return;
    const x = Math.round(craft.x + this.shift);
    if (x < left - 200 || x > right + 200) return;
    const y = Math.round(groundAt(x) - craft.altitude);
    const tail = -craft.dir;
    if (craft.kind === 'plane') {
      // Contrail fading behind.
      for (let i = 0; i < 6; i++) {
        g.fillStyle(0xffffff, 0.35 - i * 0.055);
        g.fillRect(x + tail * (craft.length / 2 + i * 24) - (tail < 0 ? 24 : 0), y - 1, 24, 2);
      }
      g.fillStyle(0xdde8ee);
      g.fillRect(x - craft.length / 2, y - 2, craft.length, 4);
      g.fillTriangle(x + tail * craft.length / 2, y - 2, x + tail * (craft.length / 2 - 7), y - 2, x + tail * craft.length / 2, y - 9);
      g.fillStyle(0xc7d6de);
      g.fillRect(x - 6 + tail * 2, y, 12, 2);
      return;
    }
    g.fillStyle(0x8fa6b3);
    g.fillEllipse(x, y, 11, 6);
    g.fillRect(Math.min(x + tail * 5, x + tail * 17), y - 1, 12, 1);
    g.fillRect(x + tail * 18 - 1, y - 3, 2, 4);
    // Rotor blur: a long blade and a short one, swapping fast.
    const blade = Math.sin(craft.rotor * 40) > 0 ? 9 : 4;
    g.fillRect(x - blade, y - 5, blade * 2, 1);
    g.fillRect(x, y - 4, 1, 1);
  }

  drawStop(g, stop, groundAt) {
    const x = Math.round(stop.x + this.shift) + 14;
    const base = Math.round(groundAt(x)) + 1;
    const pole = Math.round(2.6 * METRE);
    g.fillStyle(0x6b737c);
    g.fillRect(x, base - pole, 1, pole);
    g.fillStyle(0x4f6a86);
    g.fillRect(x - 3, base - pole - 1, 7, 6);
    g.fillStyle(0xe2e8ec);
    g.fillRect(x - 1, base - pole + 1, 3, 2);
    // Bench beside the pole.
    const seat = Math.round(0.45 * METRE);
    g.fillStyle(0x7a6a58);
    g.fillRect(x - 16, base - seat - 1, 11, 2);
    g.fillRect(x - 15, base - seat + 1, 1, seat - 1);
    g.fillRect(x - 7, base - seat + 1, 1, seat - 1);
  }

  drawPerched(g, flock, groundAt) {
    for (const bird of flock.birds) {
      const x = Math.round(flock.x + bird.dx + this.shift);
      const y = Math.round(groundAt(x)) + 1 - Math.round(flock.height);
      const peck = Math.sin(bird.phase) > 0.6 ? 1 : 0;
      g.fillStyle(bird.color);
      g.fillRect(x - 1, y - 2, 3, 2);
      g.fillRect(x + bird.dir * (peck ? 2 : 1), y - 3 + peck * 2, 1, 1);
    }
  }

  drawFlying(g, flock, groundAt) {
    for (const bird of flock.birds) {
      const x = Math.round(bird.x + this.shift);
      const y = Math.round(groundAt(x)) + 1 - Math.round(bird.h);
      const up = Math.sin(bird.phase) > 0;
      g.fillStyle(bird.color);
      g.fillRect(x - 1, y - 1, 3, 1);
      g.fillRect(x - 2, up ? y - 2 : y, 1, 1);
      g.fillRect(x + 2, up ? y - 2 : y, 1, 1);
    }
  }

  // City bus: a long window band, a door by the front, and the town's livery.
  drawBus(g, bus, groundAt) {
    const x = Math.round(bus.x + this.shift);
    const dir = LANES[bus.lane].dir;
    const base = Math.round(groundAt(x)) + LANES[bus.lane].y;
    const length = Math.round(bus.length);
    const height = Math.round(bus.height);
    const left = x - Math.round(length / 2);
    const wheel = Math.round(0.5 * METRE);
    const lift = Math.round(Math.max(-1, Math.min(3, bus.bounce)));
    const roof = base - height - lift;
    const bottom = base - Math.round(wheel * 0.8) - lift;
    tiltWithRoad(g, groundAt, x, base, length, (bus.pitch ?? 0) * 0.6);
    // No road shadow in the air.
    if (!bus.fall) {
      g.fillStyle(0x000000, 0.18);
      g.fillRect(left, base - 1, length, 1);
    }
    // Each town paints its buses in its own livery (bus-liveries.js).
    const livery = bus.livery ?? BUS_LIVERIES.greenCity;
    const band = Math.round(height * 0.42);
    g.fillStyle(livery.body);
    g.fillRect(left, roof, length, bottom - roof);
    if (livery.top) {
      g.fillStyle(livery.top);
      g.fillRect(left, roof, length, band + 6);
    }
    if (livery.skirt) {
      g.fillStyle(livery.skirt);
      g.fillRect(left, bottom - 4, length, 4);
    }
    g.fillStyle(0x000000, 0.08);
    g.fillRect(left, roof, length, 2);
    // Window band, with a tall windscreen at the front.
    g.fillStyle(GLASS);
    for (let wx = left + 3; wx < left + length - 8; wx += 8) g.fillRect(wx, roof + 4, 6, band);
    const nose = dir > 0 ? left + length - 5 : left;
    g.fillRect(nose, roof + 3, 5, band + 3);
    g.fillStyle(livery.stripe);
    if (livery.wave) {
      // A rolling wave: 2px columns stepping up and down along the side.
      for (let sx = 0; sx < length; sx += 2) {
        const dy = Math.round(Math.sin(sx / length * Math.PI * 4) * 2);
        g.fillRect(left + sx, roof + band + 6 + dy, 2, 2);
      }
    } else g.fillRect(left, roof + band + 6, length, 3);
    // Door near the front; destination sign above the windscreen.
    const door = dir > 0 ? left + length - 15 : left + 9;
    g.fillStyle(0x5f6b74);
    g.fillRect(door, roof + 4, 6, bottom - roof - 5);
    g.fillStyle(GLASS);
    g.fillRect(door + 1, roof + 5, 4, band);
    g.fillStyle(0xe8d9a0);
    g.fillRect(nose, roof + 1, 5, 2);
    g.fillStyle(0xf4ecc8);
    g.fillRect(dir > 0 ? left + length - 2 : left, bottom - 5, 2, 2);
    g.fillStyle(bus.speed < bus.cruise * 0.6 ? 0xff5a4a : 0xb8473f);
    g.fillRect(dir > 0 ? left : left + length - 2, bottom - 5, 2, 2);
    for (const t of [0.18, 0.8]) {
      const wx = left + Math.round(t * length);
      g.fillStyle(TYRE);
      g.fillCircle(wx, base - wheel, wheel);
      g.fillStyle(0x9aa3ab);
      g.fillCircle(wx, base - wheel, Math.max(1, wheel / 2.5));
    }
    g.restore();
  }

  drawPerson(g, person, groundAt) {
    if (person.fade < 1) g = faded(g, person.fade);
    const x = Math.round(person.x + this.shift);
    // lift: standing on a deck above the ground line, such as a fishing pier.
    const feet = Math.round(groundAt(x)) + 1 + person.lane * 3 - (person.lift ?? 0);
    const h = person.height;
    const unit = v => Math.max(1, Math.round(v * h / 18));
    const width = unit(5);
    const head = unit(4);
    if (person.state !== 'held') {
      g.fillStyle(0x000000, 0.15);
      g.fillRect(x - Math.floor(width / 2) - 1, feet - 1, width + 2, 1);
    }
    if (person.state === 'flinch') {
      this.drawCrouch(g, person, x, feet, unit, head);
      return;
    }
    // Cheering hops.
    const hop = person.state === 'look' && person.gesture === 'cheer'
      ? Math.round(Math.max(0, Math.sin(this.clock * 9 + person.phase)) * unit(2)) : 0;
    const legs = unit(7);
    const torso = unit(7);
    const base = feet - hop;
    const left = x - Math.floor(width / 2);
    const stride = person.state === 'walk' || person.state === 'flee' || person.state === 'held' ? Math.round(Math.sin(person.phase) * unit(1.5)) : 0;
    g.fillStyle(person.pants);
    g.fillRect(left + stride, base - legs, unit(2), legs);
    g.fillRect(left + width - unit(2) - stride, base - legs, unit(2), legs);
    const shoulders = base - legs - torso;
    // Hikers carry a pack on their back.
    if (person.pack) {
      g.fillStyle(person.pack);
      g.fillRect(person.dir > 0 ? left - unit(1.5) : left + width - unit(0.5), shoulders + 1, unit(2), unit(5));
    }
    g.fillStyle(person.shirt);
    g.fillRect(left, shoulders, width, torso);
    const headLeft = x - Math.floor(head / 2) + (person.dir > 0 ? 0 : -1) + 1;
    const headTop = shoulders - head;
    g.fillStyle(person.skin);
    g.fillRect(headLeft, headTop, head, head);
    g.fillStyle(person.hair);
    g.fillRect(headLeft, headTop, head, 1);
    g.fillRect(person.dir > 0 ? headLeft : headLeft + head - 1, headTop, 1, unit(2));
    this.drawArms(g, person, x, shoulders, headTop, stride, unit);
    if (person.umbrella && this.rain > 0.3 && person.state !== 'look') this.drawUmbrella(g, person, x, headTop, unit);
  }

  // Held just above the head: a canopy with a rounded top and a short handle down to the hand.
  drawUmbrella(g, person, x, headTop, unit) {
    const span = unit(11);
    const left = x - Math.floor(span / 2);
    const top = headTop - unit(4);
    g.fillStyle(person.umbrella);
    g.fillRect(left + 2, top, span - 4, 1);
    g.fillRect(left, top + 1, span, unit(2));
    g.fillStyle(0x2b2b2b);
    g.fillRect(x, top + 1 + unit(2), 1, unit(4));
  }

  // Ducking from a RAM: squatting on bent knees, back hunched, head tucked under both arms. About
  // 60% of standing height, so it reads at a glance.
  drawCrouch(g, person, x, feet, unit, head) {
    const d = person.dir;
    const thighs = feet - unit(4);
    g.fillStyle(person.pants);
    g.fillRect(x - unit(2), feet - unit(3), unit(2), unit(3));
    g.fillRect(x + (d > 0 ? unit(1) : -unit(1)), feet - unit(3), unit(2), unit(3));
    g.fillRect(x - unit(2.5), thighs, unit(5.5), unit(2));
    const back = thighs - unit(5);
    g.fillStyle(person.shirt);
    g.fillRect(x - unit(2.5) + d * unit(0.5), back, unit(5), unit(5));
    const headLeft = x - Math.floor(head / 2) + d * unit(2);
    const headTop = back - head + unit(2);
    g.fillStyle(person.skin);
    g.fillRect(headLeft, headTop, head, head);
    g.fillStyle(person.hair);
    g.fillRect(headLeft, headTop, head, 1);
    g.fillStyle(person.shirt);
    g.fillRect(headLeft - 1, headTop - 1, head + 2, unit(1.5));
    g.fillRect(headLeft + (d > 0 ? head : -1), headTop, 1, unit(2.5));
  }

  // Arms show the reaction: raised to wave, both up to cheer, angled up to point. Walking swings
  // one against the stride.
  drawArms(g, person, x, shoulders, headTop, stride, unit) {
    const front = x + person.dir * unit(2);
    const reach = unit(5);
    g.fillStyle(person.shirt);
    // Running for it: both arms thrown up, flailing.
    if (person.state === 'flee') {
      for (const side of [-1, 1]) {
        const flail = Math.sin(this.clock * 14 + person.phase + side) > 0 ? side : 0;
        g.fillRect(x + side * unit(2.5) - (side < 0 ? 0 : 1) + flail, shoulders - reach + 1, 1, reach);
      }
      return;
    }
    if (person.state === 'look' && person.gesture === 'wave') {
      const sway = Math.sin(this.clock * 10 + person.phase) > 0 ? 1 : 0;
      g.fillRect(front + sway * person.dir, shoulders - reach + 1, 1, reach);
      g.fillStyle(person.skin);
      g.fillRect(front + sway * person.dir, shoulders - reach, 1, 1);
      return;
    }
    if (person.state === 'look' && person.gesture === 'cheer') {
      for (const side of [-1, 1]) g.fillRect(x + side * unit(2.5) - (side < 0 ? 0 : 1), shoulders - reach + 1, 1, reach);
      return;
    }
    if (person.state === 'look' && person.gesture === 'point') {
      for (let i = 0; i < reach; i++) g.fillRect(front + person.dir * i, shoulders + 1 - i, 1, 1);
      return;
    }
    // Anglers rest a rod over the water, its line dropping to the surface below the deck.
    const canFish = (person.pier ? !person.offDeck : isWater(person.x + person.dir * 24, this.bridges));
    if (person.rod && person.state === 'idle' && canFish) {
      const reach = unit(9);
      g.fillStyle(0x5a4632);
      for (let i = 0; i < reach; i++) g.fillRect(front + person.dir * i, shoulders + 2 - Math.round(i * 0.7), 1, 1);
      const tipX = front + person.dir * reach;
      const tipY = shoulders + 2 - Math.round(reach * 0.7);
      const bob = Math.round(Math.sin(this.clock * 2 + person.phase));
      g.fillStyle(0xe8ecee, 0.6);
      // Down past the deck to the water line, about a person's height below the shoulders.
      g.fillRect(tipX, tipY, 1, shoulders + unit(14) + (person.lift ?? 0) - tipY + bob);
      return;
    }
    g.fillStyle(0x000000, 0.12);
    g.fillRect(x - stride * person.dir, shoulders + 1, 1, unit(5));
  }

  drawCar(g, car, groundAt) {
    const x = Math.round(car.x + this.shift);
    const dir = LANES[car.lane].dir;
    const base = Math.round(groundAt(x)) + LANES[car.lane].y;
    const length = Math.round(car.length);
    const height = Math.round(car.height);
    const left = x - Math.round(length / 2);
    const wheel = Math.max(2, Math.round(height * 0.2));
    // The body rides on its springs; wheels stay on the road.
    const lift = Math.round(Math.max(-1, Math.min(3, car.bounce)));
    const bodyTop = base - Math.round(height * 0.6) - lift;
    const bodyBottom = base - wheel - lift;
    // Cabin sits a little behind the middle; hatchbacks run it to the tail.
    const [rear, front] = car.kind === 'hatch' ? [0.06, 0.62] : [0.2, 0.66];
    const cabin = (t) => dir > 0 ? left + t * length : left + (1 - t) * length;
    const cabinLeft = Math.round(Math.min(cabin(rear), cabin(front)));
    const cabinWidth = Math.round(Math.abs(cabin(front) - cabin(rear)));
    const roof = base - height - lift;
    tiltWithRoad(g, groundAt, x, base, length, (car.pitch ?? 0));
    if (!car.fall) {
      g.fillStyle(0x000000, 0.18);
      g.fillRect(left, base - 1, length, 1);
    }
    g.fillStyle(car.paint);
    g.fillRect(cabinLeft, roof, cabinWidth, bodyTop - roof);
    g.fillRect(left, bodyTop, length, bodyBottom - bodyTop);
    g.fillStyle(0x000000, 0.12);
    g.fillRect(left, bodyBottom - 2, length, 2);
    {
      g.fillStyle(GLASS);
      g.fillRect(cabinLeft + 2, roof + 2, cabinWidth - 4, bodyTop - roof - 2);
      g.fillStyle(car.paint);
      g.fillRect(cabinLeft + Math.round(cabinWidth * (dir > 0 ? 0.55 : 0.45)) - 1, roof + 2, 2, bodyTop - roof - 2);
    }
    if (car.kind === 'taxi') {
      g.fillStyle(0xf2e6b8);
      g.fillRect(cabinLeft + Math.round(cabinWidth / 2) - 3, roof - 2, 6, 2);
    }
    if (car.kind === 'police') {
      // Navy doors under the windows, and a light bar flashing red and blue until it is hurt.
      g.fillStyle(POLICE_DOOR);
      g.fillRect(cabinLeft, bodyTop + 1, cabinWidth, Math.max(1, bodyBottom - bodyTop - 3));
      this.lightBar(g, car, cabinLeft + Math.round(cabinWidth / 2) - 4, roof - 2);
    }
    const nose = dir > 0 ? left + length - 2 : left;
    const tail = dir > 0 ? left : left + length - 2;
    g.fillStyle(0xf4ecc8);
    g.fillRect(nose, bodyTop + 1, 2, 2);
    // Brake lights glow while slowing.
    g.fillStyle(braking(car) ? 0xff5a4a : 0xb8473f);
    g.fillRect(tail, bodyTop + 1, 2, 2);
    for (const t of [0.2, 0.8]) wheelAt(g, left + Math.round(t * length), base - wheel, wheel, car.roll);
    g.restore();
  }

  // Red and blue, flashing until the car is hurt.
  lightBar(g, car, x, y) {
    const flash = !car.wreck && car.hurt === undefined ? Math.floor(this.clock * 6) % 2 : -1;
    g.fillStyle(flash === 0 ? 0xff4a4a : 0x8a2f35);
    g.fillRect(x, y, 4, 2);
    g.fillStyle(flash === 1 ? 0x5aa8ff : 0x2f4a8a);
    g.fillRect(x + 4, y, 4, 2);
  }

  // Heat's armoured vehicles, drawn nose-right in u (px from the tail, mirrored when heading left)
  // and v (px up from the road). swat: the SWAT van (enemy-refs/level-2-swat.jpg), a tall black box
  // with a sloped windscreen. armoured: the armoured truck (level-3-swat.jpg), a gunmetal armour box
  // behind a cab and bonnet, bolted plates, a push bar. apc: the APC (level-4-army.jpg), olive, a
  // long glacis, vision slits, a rear door, four big wheels a side. Roof guns: the enemy lab.
  drawArmoured(g, car, groundAt) {
    const x = Math.round(car.x + this.shift);
    const dir = LANES[car.lane].dir;
    const base = Math.round(groundAt(x)) + LANES[car.lane].y;
    const L = Math.round(car.length);
    const H = Math.round(car.height);
    const left = x - Math.round(L / 2);
    const lift = Math.round(Math.max(-1, Math.min(3, car.bounce)));
    const kind = car.kind;
    const wheel = Math.max(2, Math.round(H * (kind === 'swat' ? 0.2 : kind === 'apc' ? 0.25 : 0.23)));
    const ux = u => Math.round(dir > 0 ? left + u : left + L - u);
    const vy = v => Math.round(base - lift - v);
    const pts = (...uv) => uv.map(([u, v]) => ({ x: ux(u), y: vy(v) }));
    const rect = (u0, u1, v0, v1) => g.fillRect(Math.min(ux(u0), ux(u1)), vy(v1), Math.max(1, Math.abs(ux(u1) - ux(u0))), Math.max(1, vy(v0) - vy(v1)));
    tiltWithRoad(g, groundAt, x, base, L, (car.pitch ?? 0));
    if (!car.fall) {
      g.fillStyle(0x000000, 0.18);
      g.fillRect(left, base - 1, L, 1);
    }
    const shade = lerpColor(car.paint, 0x000000, 0.3);
    const light = lerpColor(car.paint, 0xffffff, 0.12);
    const low = wheel * 0.6;
    let wheels;
    let bar = null;
    if (kind === 'apc') {
      const belly = wheel * 0.9;
      const plate = H * 0.56;
      wheels = [0.12, 0.34, 0.56, 0.78];
      // Wheel arches behind the wheels, then the hull: flat roof, long glacis to the nose.
      g.fillStyle(0x1f2318);
      for (const t of wheels) g.fillCircle(ux(t * L), vy(wheel), wheel + 1.5);
      g.fillStyle(car.paint);
      g.fillPoints(pts([0, belly], [0, H - 1], [1, H], [L * 0.6, H], [L - 1, H * 0.42], [L, H * 0.36], [L - 2, belly]), true);
      for (const t of wheels) {
        g.fillStyle(0x1f2318);
        g.fillRect(ux(t * L) - wheel - 1, vy(belly), 2 * wheel + 2, Math.max(1, vy(0) - vy(belly) - wheel));
      }
      // The upper side plate: its lower edge in shade, its top edge in light.
      g.fillStyle(shade);
      g.fillPoints(pts([0, plate - 1], [L * 0.84, plate - 1], [L * 0.83, plate], [0, plate]), true);
      g.fillStyle(light);
      g.fillPoints(pts([1, H - 1], [L * 0.6, H - 1], [L * 0.59, H - 2], [1, H - 2]), true);
      g.fillPoints(pts([L * 0.6, H - 1], [L - 1.5, H * 0.43], [L - 2.5, H * 0.43], [L * 0.6 - 1, H - 1]), true);
      // Hatch on the glacis, vision blocks, the side door with its port, the rear door, a headlight.
      g.fillStyle(0x23281b);
      g.fillPoints(pts([L * 0.66, H * 0.86], [L * 0.8, H * 0.66], [L * 0.77, H * 0.62], [L * 0.63, H * 0.82]), true);
      for (const t of [0.24, 0.36, 0.48, 0.6]) rect(L * t, L * t + 3, H * 0.74, H * 0.74 + 1.5);
      g.fillStyle(0x000000, 0.25);
      rect(L * 0.44, L * 0.44 + 1, belly + 1, plate - 2);
      rect(L * 0.54, L * 0.54 + 1, belly + 1, plate - 2);
      rect(L * 0.44, L * 0.54 + 1, plate - 2, plate - 1);
      rect(2, 3, belly + 1, H - 2);
      g.fillStyle(0x23281b);
      rect(L * 0.475, L * 0.505, plate - 6, plate - 4);
      g.fillStyle(0xe9e2b8);
      rect(L - 4, L - 2, H * 0.3, H * 0.3 + 1.5);
    } else {
      const policeVan = kind === 'policevan';
      const swat = kind === 'swat' || policeVan;
      // The box, then the cab (the van's under the same roof; the truck's lower, with a bonnet).
      const box = swat ? 0.68 : 0.6;
      const cabTop = swat ? H : H * 0.84;
      g.fillStyle(car.paint);
      g.fillRect(Math.min(ux(0), ux(L * box)), vy(H), Math.round(L * box), vy(low) - vy(H));
      const screen = swat ? [[L * 0.82, cabTop - 0.5], [L * 0.92, H * 0.6]] : [[L * 0.8, cabTop], [L * 0.86, H * 0.58]];
      g.fillPoints(pts([L * box - 1, low], [L * box - 1, cabTop], screen[0], screen[1], [L, H * 0.55], [L, low]), true);
      // Windscreen along the slope, the cab's side window, and the box's slit windows.
      g.fillStyle(GLASS);
      g.fillPoints(pts([screen[0][0] - 1, screen[0][1] - 1.5], [screen[1][0] - 1, screen[1][1]], [screen[0][0] - 2.5, screen[1][1]]), true);
      rect(L * (box + 0.03), L * (box + 0.12), H * (swat ? 0.62 : 0.6), cabTop - 2);
      g.fillStyle(swat ? GLASS : 0x23272d);
      for (const t of swat ? [0.18, 0.4] : [0.16, 0.3, 0.44]) rect(L * t, L * t + (swat ? 5 : 3), H * 0.74, H * 0.74 + 2);
      if (policeVan) {
        // Navy belt, blue checks and a gold badge distinguish the transport from black SWAT vans.
        g.fillStyle(POLICE_DOOR);
        rect(1, L - 2, H * 0.32, H * 0.6);
        g.fillStyle(0x5595cf);
        for (let u = 3; u < L * 0.62; u += 6) rect(u, u + 3, H * 0.6, H * 0.6 + 2);
        g.fillStyle(0xe5bc54);
        rect(L * 0.73, L * 0.73 + 3, H * 0.4, H * 0.4 + 4);
        // Sliding passenger door: an open dark gap once the six officers have disembarked.
        g.fillStyle(car.deployed ? 0x182337 : 0x8e9eaf);
        rect(L * 0.46, L * 0.46 + (car.deployed ? 6 : 1), low + 1, H * 0.7);
        g.fillStyle(0x313c48);
        rect(L * 0.43, L * 0.59, low, low + 1);
      }
      // Panel seams, the skirt, the door, the tail light.
      g.fillStyle(0x000000, 0.25);
      rect(L * box, L * box + 1, low, cabTop);
      rect(0, L, wheel * 1.4, wheel * 1.4 + 1);
      rect(L * (box + 0.14), L * (box + 0.14) + 1, low, cabTop - 1);
      if (!swat) {
        // Bolted plates, the rear door, the push bar over the nose.
        g.fillStyle(light);
        for (let u = 3; u < L * box - 2; u += 6) for (const v of [H * 0.88, H * 0.5]) rect(u, u + 1, v, v + 1);
        g.fillStyle(0x000000, 0.25);
        rect(L * 0.2, L * 0.2 + 1, low, H - 1);
        rect(L * 0.4, L * 0.4 + 1, low, H - 1);
        g.fillStyle(0x15171b);
        rect(L - 1, L + 2, low, H * 0.5);
        g.fillStyle(car.paint);
        for (const v of [H * 0.2, H * 0.35]) rect(L, L + 2, v, v + 1);
      } else {
        g.fillStyle(0x0e1014);
        rect(L - 1, L + 1, low, H * 0.3);
      }
      g.fillStyle(0xf4ecc8);
      rect(L - 2, L, H * 0.42, H * 0.42 + 2);
      g.fillStyle(braking(car) ? 0xff5a4a : 0xb8473f);
      rect(0, 2, H * 0.55, H * 0.55 + 2);
      bar = ux(L * (swat ? 0.72 : 0.68)) - 4;
      this.lightBar(g, car, bar, vy(cabTop) - 2);
      wheels = [0.2, 0.8];
    }
    g.fillStyle(0x000000, 0.3);
    for (let i = 0; i < (car.dent ?? 0); i++) rect(L * (0.12 + i * 0.18), L * (0.12 + i * 0.18) + 3, H * 0.6 - (i % 2) * 3, H * 0.6 - (i % 2) * 3 + 2);
    for (const t of wheels) {
      if (kind !== 'apc') {
        wheelAt(g, ux(t * L), base - wheel, wheel, car.roll);
        continue;
      }
      // Military wheels: a deep tyre round an olive hub.
      g.fillStyle(TYRE);
      g.fillCircle(ux(t * L), base - wheel, wheel);
      g.fillStyle(shade);
      g.fillCircle(ux(t * L), base - wheel, wheel * 0.55);
      g.fillStyle(0x1f2318);
      g.fillRect(ux(t * L) - 0.5, base - wheel - 0.5, 1, 1);
    }
    g.restore();
  }

  // A tank: a low hull over its track run (road wheels turning in the dark track band), the hull's
  // sloped front plate, and dents as it is hit. The turret and gun are drawn by the enemy lab.
  drawTank(g, car, groundAt) {
    const x = Math.round(car.x + this.shift);
    const dir = LANES[car.lane].dir;
    const base = Math.round(groundAt(x)) + LANES[car.lane].y;
    const length = Math.round(car.length);
    const height = Math.round(car.height);
    const left = x - Math.round(length / 2);
    const lift = Math.round(Math.max(-1, Math.min(2, car.bounce)));
    const hullTop = base - height - lift;
    tiltWithRoad(g, groundAt, x, base, length, (car.pitch ?? 0));
    if (!car.fall) {
      g.fillStyle(0x000000, 0.2);
      g.fillRect(left - 1, base - 1, length + 2, 1);
    }
    // Drawn nose-right in u (px from the left end, mirrored when heading left), v up from the road.
    const ux = u => dir > 0 ? left + u : left + length - u;
    const pts = (...uv) => uv.map(([u, v]) => ({ x: ux(u), y: base - lift - v }));
    const L = length;
    const skirt = Math.round(height * 0.3);
    // Track belt, raised at the front idler and the rear sprocket, round its road wheels.
    g.fillStyle(0x23261e);
    g.fillPoints(pts([2, 3], [6, 0], [L - 7, 0], [L - 1, 4], [L - 2, skirt + 1], [1, skirt + 1]), true);
    const wheel = Math.max(2, Math.round(height * 0.14));
    for (let i = 0; i < 7; i++) wheelAt(g, ux(8 + i * (L - 16) / 6), base - lift - wheel, wheel, car.roll);
    wheelAt(g, ux(3), base - lift - wheel - 1, wheel - 1, car.roll);
    wheelAt(g, ux(L - 3), base - lift - wheel - 2, wheel - 1, car.roll);
    // Hull: the skirt over the upper track with its panel seams, the deck above, and the long
    // glacis sloping from the deck's nose down to the idler.
    g.fillStyle(car.paint);
    g.fillPoints(pts([0, skirt], [L - 4, skirt], [L, height - 4], [L - 2, height], [2, height], [0, height - 2]), true);
    g.fillStyle(lerpColor(car.paint, 0x000000, 0.18));
    g.fillPoints(pts([1, skirt], [L - 4, skirt], [L - 2.5, skirt + 3], [1, skirt + 3]), true);
    g.fillStyle(0x000000, 0.2);
    for (let u = 12; u < L - 10; u += 12) g.fillRect(ux(u), base - lift - height + 4, 1, height - skirt - 4);
    g.fillRect(Math.min(ux(1), ux(L - 3)), base - lift - height + 4, L - 4, 1);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(Math.min(ux(2), ux(L - 2)), hullTop, L - 4, 1);
    // Exhaust grille and a tool box at the rear.
    g.fillStyle(0x2c3222);
    g.fillRect(Math.min(ux(1), ux(5)), base - lift - height + 1, 4, 2);
    g.fillStyle(0x000000, 0.3);
    for (let i = 0; i < (car.dent ?? 0); i++) g.fillRect(left + 6 + i * Math.round(length / 6), hullTop + 2 + (i % 2), 3, 2);
    g.restore();
  }
}
