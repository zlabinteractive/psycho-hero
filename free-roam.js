import { withEnemyResponse } from './enemy-response.js';
import { CAMPAIGN } from './campaign.js';
import { ChaosHud } from './chaos-hud.js';
import { installCrashDiagnostics } from './crash-diagnostics.js';
import { MAX_LIFT_SIZE } from './enemy-throw.js';
import { HeroMovement, MIN_ALTITUDE_ZOOM as FLIGHT_MIN_ZOOM, drawSky } from './hero-movement.js';
import { altitudeZoomLimit } from './touch-controls.js';
import { COMBAT, CombatArena } from './hero-combat.js';
import { CombatArtwork } from './hero-combat-art.js';
import { CIRCUMFERENCE, REGIONS, elevation, maxElevation, groundColors, isWater, lerpColor, regionAt, snowAt, surfaceColor, wrapX } from './planet.js';
import { PlanetMap, PlanetProfile } from './planet-map.js';
import { CITY_BUILDINGS, drawCity } from './city-art.js';
import { CityDestruction } from './building-destruction.js';
import { CityLife } from './city-life.js';
import { FOREST_BUILDINGS, drawForest, drawLakeReflections } from './forest-art.js';
import { ForestLife } from './forest-life.js';
import { RivertownLife } from './rivertown-life.js';
import { WINDMILL_BUILDINGS, drawWindmill } from './windmill-art.js';
import { WindmillLife } from './windmill-life.js';
import { BRIDGE_DECK, RIVERTOWN_BUILDINGS, drawRivertown, streetRise } from './rivertown-art.js';
import { ORCHARD_BUILDINGS, drawOrchard } from './orchard-art.js';
import { OrchardLife } from './orchard-life.js';
import { BAYPORT_BUILDINGS, drawBayport } from './bayport-art.js';
import { BayportLife } from './bayport-life.js';
import { SHELL_BEACH_BUILDINGS, drawShellBeach } from './shell-beach-art.js';
import { ShellBeachLife } from './shell-beach-life.js';
import { BLUE_SEA_BUILDINGS, drawBlueSea } from './blue-sea-art.js';
import { SeaLife } from './blue-sea-life.js';
import { GOLDEN_BEACH_BUILDINGS, drawGoldenBeach } from './golden-beach-art.js';
import { GoldenBeachLife } from './golden-beach-life.js';
import { SANDPORT_BUILDINGS, drawSandport } from './sandport-art.js';
import { SandportLife } from './sandport-life.js';
import { RED_DUNES_BUILDINGS, drawRedDunes } from './red-dunes-art.js';
import { RedDunesLife } from './red-dunes-life.js';
import { PALM_OASIS_BUILDINGS, drawPalmOasis } from './palm-oasis-art.js';
import { PalmOasisLife } from './palm-oasis-life.js';
import { SUNLAND_BUILDINGS, drawSunland } from './sunland-art.js';
import { SunlandLife } from './sunland-life.js';
import { FROSTLAND_BUILDINGS, drawFrostland } from './frostland-art.js';
import { FrostlandLife } from './frostland-life.js';
import { SkyLife } from './sky-life.js';
import { CRUISE_SHIP_BUILDING, drawOceanArt, shipDeckAt } from './ocean-art.js';
import { AIR_KINDS, AirLife } from './air-life.js';
import { sound } from './sound.js';

const SEA_Y = 300;
// The dev panel's spawn list: label to what spawnItem makes.
const SPAWNS = { Person: 'person', 'Crowd of 8': 'crowd', Car: 'car',
  ...Object.fromEntries(Object.entries(AIR_KINDS).map(([kind, name]) => [name, kind])) };
// How far a car blowing up reaches (evil mode).
const BLAST = 34;
// The cruise liner sinks once she is down to this fraction of her strength (evil mode).
const SHIP_SINK = 0.6;
// A landing splash's foam ring spreads and fades over this many seconds.
const SPLASH_RING = 1.4;
// Diving (QA-12): the hero can go this far under the surface (less where the water is shallower),
// slowed by the water's drag per second and floated back up while not steering down.
const DIVE_DEPTH = 46;
const WATER_DRAG = 2.4;
const BUOYANCY = 560;
// Half the hero's height: feet and head sit this far below and above position.y.
const HERO_HALF = 11;
// The hero reads blue-green under water.
const UNDERWATER_TINT = 0x7fb4c8;

// A copy of a laser beam lengthened by px past its end, along its own direction.
function reach(beam, px) {
  const dx = beam.endX - beam.x;
  const dy = beam.endY - beam.y;
  const length = Math.hypot(dx, dy) || 1;
  return { ...beam, endX: beam.endX + dx / length * px, endY: beam.endY + dy / length * px };
}
// Each column overlaps the next by 1 px so fractional zooms never leave seams.
const COLUMN = 2;
// Terrain height and colours per planet column never change, so each column is computed once, on first
// sight. Recomputing them for every column on every frame took most of free roam's frame time.
const TERRAIN_COLUMNS = CIRCUMFERENCE / COLUMN;
const terrain = {
  ready: new Uint8Array(TERRAIN_COLUMNS), rise: new Float64Array(TERRAIN_COLUMNS),
  water: new Uint32Array(TERRAIN_COLUMNS), waterEdge: new Uint32Array(TERRAIN_COLUMNS),
  cap: new Uint32Array(TERRAIN_COLUMNS), soil: new Uint32Array(TERRAIN_COLUMNS), deep: new Uint32Array(TERRAIN_COLUMNS),
};

// x is a multiple of COLUMN, so every copy of a column across the wrap shares one entry.
function terrainColumn(x) {
  const i = Math.floor(wrapX(x) / COLUMN);
  if (terrain.ready[i]) return i;
  const rise = elevation(x);
  const { ground: [cap, soil, deep], water } = groundColors(x);
  terrain.rise[i] = rise;
  terrain.water[i] = water;
  terrain.waterEdge[i] = lerpColor(water, 0xffffff, 0.35);
  terrain.cap[i] = rise < 0 ? cap : surfaceColor(x, rise);
  terrain.soil[i] = lerpColor(soil, 0xd6e2ea, snowAt(x, rise));
  terrain.deep[i] = deep;
  terrain.ready[i] = 1;
  return i;
}

export function drawTerrainColumns(ground, left, right, bottom) {
  for (let x = left; x < right;) {
    const i = terrainColumn(x);
    const rise = terrain.rise[i];
    const surface = SEA_Y - rise;
    let end = x + COLUMN;
    // Opaque, identical strips have the same union as one wide rectangle, including
    // the 1px seam overlap. Keep every varying slope and colour boundary intact.
    while (end < right) {
      const next = terrainColumn(end);
      if (terrain.rise[next] !== rise || terrain.water[next] !== terrain.water[i]
        || terrain.cap[next] !== terrain.cap[i] || terrain.soil[next] !== terrain.soil[i]
        || terrain.deep[next] !== terrain.deep[i]) break;
      end += COLUMN;
    }
    const width = end - x + 1;
    if (rise < 0) {
      ground.fillStyle(terrain.water[i]);
      ground.fillRect(x, SEA_Y, width, Math.min(surface, bottom) - SEA_Y);
      ground.fillStyle(terrain.waterEdge[i]);
      ground.fillRect(x, SEA_Y, width, 1);
    }
    if (surface <= bottom) {
      ground.fillStyle(terrain.cap[i]);
      ground.fillRect(x, surface, width, 3);
      ground.fillStyle(terrain.soil[i]);
      ground.fillRect(x, surface + 3, width, 9);
      ground.fillStyle(terrain.deep[i]);
      ground.fillRect(x, surface + 12, width, bottom - surface - 12);
    }
    x = end;
  }
}
// Vertical framing, as fractions of the unzoomed view from the top. The ground starts on GROUND_LINE
// and the camera holds still while the hero is below HERO_LINE; above it, the view zooms out to keep
// the hero there. The strip of ground below the surface stays the same world depth, so it thins on
// screen as the view widens. Once fully zoomed out the camera stops and the hero can rise to the top edge.
// The zoom-out stops at MIN_ALTITUDE_ZOOM everywhere. Above that the camera follows the hero up on
// HERO_LINE to a ceiling TOWER_HEADROOM over the planet's tallest tower, measured from the ground
// here, so every area flies as high as the skyscrapers. Ground dropping away never pushes the hero
// down: the ceiling holds, then tightens behind the hero only as they descend on their own.
const GROUND_LINE = 0.9;
const TOUCH_GROUND_LINE = 0.87;
// Low enough that a mobile browser's address bar and the top HUD never cover the hero.
const HERO_LINE = 0.3;
// Phones: the top HUD takes about a quarter of a landscape screen (more under Safari's address bar),
// so the hero flies lower to stay clear of it.
const TOUCH_HERO_LINE = 0.42;
const ZOOM_IN_LINE = 0.55;
const CEILING_HERO_MARGIN = 24;
// How far above the tallest tower the hero may climb.
const TOWER_HEADROOM = 160;
// Seconds a lower limit waits before it starts following the hero down, and how far above the
// hero it then trails, so a small dip doesn't lock out climbing back.
const LOCK_DELAY = 1.5;
const LOCK_SLACK = 120;
// Free roam zooms out 25% further than ordinary flight, then 10% more (0.4). Past the flight limit
// the hero holds the on-screen size it had there, so the extra height reads as scale.
const MIN_ALTITUDE_ZOOM = FLIGHT_MIN_ZOOM / 1.25 / 1.1;
const MIN_HERO_SCREEN_SIZE = Math.sqrt(FLIGHT_MIN_ZOOM);
const SKY = [0x77b8dc, 0x7fc2e0, 0x89c9e3, 0x95d1e5, 0xa5d9e5];
// [parallax factor, hill scale, land colour, sea colour]: far layer first.
const SKY_TINT = 0.35;
const BACKDROP_LAYERS = [[0.3, 1, 0x9fcad0, 0x8cc4de], [0.55, 0.6, 0x86bcbf, 0x6fb0d4]];

// Every promotable building on the planet.
const ALL_BUILDINGS = () => [...CITY_BUILDINGS, ...WINDMILL_BUILDINGS, ...FOREST_BUILDINGS, ...RIVERTOWN_BUILDINGS,
  ...ORCHARD_BUILDINGS, ...BAYPORT_BUILDINGS, ...SHELL_BEACH_BUILDINGS, ...BLUE_SEA_BUILDINGS, ...GOLDEN_BEACH_BUILDINGS, ...SANDPORT_BUILDINGS,
  ...RED_DUNES_BUILDINGS, ...PALM_OASIS_BUILDINGS, ...SUNLAND_BUILDINGS, ...FROSTLAND_BUILDINGS, CRUISE_SHIP_BUILDING];
const TALLEST_BUILDING = Math.max(...ALL_BUILDINGS().map(building => building.height));

const LOWEST_SNOWLINE = Math.min(...REGIONS.map(region => region.snowline ?? Infinity));
// Reused for every backdrop column (two layers × every 2 px, each frame) instead of a new object.
const backdrop = { rise: 0, land: 0, snowy: false };

// Distant landscape at parallax coordinate s. It is fixed in its own layer and derived from the
// map it represents (x = s / factor), so mountains and seas appear behind the right places.
function backdropRise(s, factor, scale) {
  const x = s / factor;
  const height = elevation(x);
  // Only open sea flattens the distant hills; lakes, rivers, and marshes stay land.
  const land = Math.min(1, Math.max(0, (height + 150) / 100));
  backdrop.rise = (land * (20 + 12 * Math.sin(s / 150) + 6 * Math.sin(s / 53)) + Math.max(0, height - 40) * 0.6) * scale;
  backdrop.land = land;
  // The region lookup only matters above the lowest snowline.
  backdrop.snowy = height > LOWEST_SNOWLINE && height > (regionAt(x).snowline ?? Infinity);
  return backdrop;
}

// Sky bands near x, tinted by the regions within ±1,600 px so the tint shifts gradually across borders.
function skyAt(x) {
  const samples = Array.from({ length: 17 }, (_, i) => regionAt(x + (i - 8) * 200).sky);
  const tints = samples.filter(tint => tint !== undefined);
  if (!tints.length) return SKY;
  const channel = shift => Math.round(tints.reduce((sum, tint) => sum + ((tint >> shift) & 255), 0) / tints.length);
  const tint = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return SKY.map(color => lerpColor(color, tint, SKY_TINT * tints.length / samples.length));
}

class MapWorld extends HeroMovement {
  constructor() {
    super();
    // ?x=8800 starts the hero over any world x, e.g. Mirror Lake, for testing a region.
    const startX = Number(new URLSearchParams(window.location.search).get('x'));
    this.spawnX = Number.isFinite(startX) && startX > 0 ? startX : CAMPAIGN[0].x;
    // Wider than the combat lab so cities and terrain read at a glance.
    this.viewHeight = 600;
    // Each bridge carries street life only while its own destructible deck stands.
    this.bridgeUp = true;
    this.deckStanding = id => this.bridgeStanding(id);
    this.streetAt = x => SEA_Y - Math.max(0, streetRise(x, this.deckStanding));
    // Droplets and foam rings from the hero landing on water (onLanding).
    this.waterSplash = { drops: [], rings: [], bubbles: [] };
    // Evil mode lifts everything on the size path, people to jumbo jets; the Dev panel's Lift size
    // slider lowers it.
    this.liftSize = MAX_LIFT_SIZE;
  }

  // Grab and throw is evil mode's: in free roam nothing on the street or in the sky can be lifted.
  liftSources() { return this.evilMode ? [...this.lives, this.destruction] : []; }

  // The land and sea surface, or the cruise ship's deck while it floats. The hero skims it, and can
  // dive under the sea (floorAt).
  groundAt(x) {
    const ground = SEA_Y - Math.max(0, elevation(x));
    // In evil mode the ship is breakable like any building, not a deck to stand on.
    const deck = this.destruction ? null : shipDeckAt(x);
    return deck === null ? ground : Math.min(ground, SEA_Y - deck);
  }

  // Over open water the hero's floor is below the surface, down to DIVE_DEPTH or the bed.
  floorAt(x) {
    if (!this.diveable(x)) return this.groundAt(x);
    return SEA_Y + Math.min(DIVE_DEPTH, -elevation(x));
  }

  diveable(x) {
    return isWater(wrapX(x)) && (this.destruction || shipDeckAt(x) === null);
  }

  // Gliding off a beach skims the water surface; diving under takes steering down.
  glues(x) {
    return !this.diveable(x);
  }

  // The land and sea surface alone, for things that live on them rather than on the ship.
  terrainAt(x) {
    return SEA_Y - Math.max(0, elevation(x));
  }

  // A deck carries traffic until more than half of it is smashed. Cache body references, not health:
  // street drawing and every area's traffic check these repeatedly while a bridge is in view.
  bridgeStanding(id = BRIDGE_DECK.id) {
    if (!this.destruction) return true;
    if (this.deckBodySource !== this.destruction) {
      this.deckBodySource = this.destruction;
      this.deckBodies = new Map();
    }
    if (!this.deckBodies.has(id)) this.deckBodies.set(id, this.destruction.bodies.find(b => b.building.id === id));
    const body = this.deckBodies.get(id);
    return !!body?.prop && body.prop.health > body.building.maxHealth * 0.5;
  }

  createArena() {
    // Free roam has nothing to hit. Evil mode promotes every city building to a target.
    // Labs built on this one (the enemy lab) supply enemyDefinitions.
    this.combat = new CombatArena([], x => this.groundAt(x), [], this.enemyDefinitions ?? []);
    this.combatArtwork = new CombatArtwork(this, this.combat);
    this.cityLife = new CityLife();
    // The village shares Green City's showers.
    this.windmillLife = new WindmillLife(Math.random, this.cityLife);
    this.forestLife = new ForestLife();
    this.rivertownLife = new RivertownLife();
    // Bayport shares Orchard's showers.
    this.orchardLife = new OrchardLife();
    this.bayportLife = new BayportLife(Math.random, this.orchardLife);
    // Shell Beach shares Bayport's showers.
    this.shellBeachLife = new ShellBeachLife(Math.random, this.bayportLife);
    this.seaLife = new SeaLife();
    // Golden Beach keeps its own showers; Sandport shares them.
    this.goldenBeachLife = new GoldenBeachLife();
    this.sandportLife = new SandportLife(Math.random, this.goldenBeachLife);
    // The Red Dunes share Sandport's showers, and Palm Oasis the dunes'.
    this.redDunesLife = new RedDunesLife(Math.random, this.sandportLife);
    this.palmOasisLife = new PalmOasisLife(Math.random, this.redDunesLife);
    this.sunlandLife = new SunlandLife(Math.random, this.palmOasisLife);
    this.frostlandLife = new FrostlandLife(Math.random, this.sunlandLife);
    // Civil air traffic in the hero's airspace, over every region.
    this.airLife = new AirLife(x => this.terrainAt(x));
    // In evil mode a downed aircraft ploughs through buildings and blows up where it lands.
    this.airLife.solidAt = (x, y) => this.destruction?.solidAt(x, y) ?? false;
    this.airLife.onCrash = (x, y, length, power, grounded) => {
      this.streetBlast(x, power, y, 30 + length * 0.25);
      if (grounded) for (const life of this.lives) life.crush(x - length / 2, x + length / 2, 3.5, this.streetAt);
    };
    // Every area's life, west to east: stepped, drawn and told about the Old Bridge together.
    this.lives = [this.cityLife, this.windmillLife, this.forestLife, this.rivertownLife, this.orchardLife, this.bayportLife,
      this.shellBeachLife, this.seaLife, this.goldenBeachLife, this.sandportLife,
      this.redDunesLife, this.palmOasisLife, this.sunlandLife, this.frostlandLife, this.airLife];
    this.skyLife = new SkyLife(x => this.groundAt(x));
    for (const life of this.lives) life.onBlast = (x, power) => this.streetBlast(x, power);
    // Cars cross area borders, so each area's traffic queues behind its neighbours' cars too.
    for (const life of this.lives) life.neighbours = this.lives;
    // People on a pier fall when evil mode breaks more than half of it, as traffic does off the bridge.
    for (const life of this.lives) life.deckUp = this.deckStanding;
  }

  // Evil mode: a car blows up at world x. Buildings, falling pieces and anything else in the arena
  // within BLAST px take the blast, burning scrap flies, and the view jolts. power: 0..1.
  // y and radius default to a car's: at street level, BLAST px.
  streetBlast(x, power, y = this.streetAt(x) - 8, radius = BLAST) {
    if (!this.destruction) return;
    const point = { x, y };
    for (const target of [...this.combat.damageables]) {
      if (target.health <= 0 || target.carried) continue;
      const dx = target.x - x;
      const dy = target.y - point.y;
      const distance = target.destructible
        ? Math.hypot(Math.max(0, Math.abs(dx) - target.width / 2), Math.max(0, Math.abs(dy) - target.height / 2))
        : Math.hypot(dx, dy);
      if (distance > radius) continue;
      this.combat.damage(target, 40 + 50 * power, { x: Math.sign(dx) || 1, y: -0.3 }, 220, 'blast', point);
    }
    for (let i = 0; i < 10; i++) {
      this.destruction.addDebris({ x, y: point.y, vx: (Math.random() - 0.5) * 280, vy: -90 - Math.random() * 170,
        size: 1 + i % 3, color: i % 2 ? 0x2a2622 : 0xff9a3c, glow: i % 2 ? 0 : 0.9 });
    }
    this.destruction.trauma = Math.max(this.destruction.trauma, 0.25 + 0.2 * power);
  }

  // Free roam's dev panel also jumps the hero to any region.
  createDevPanel() {
    super.createDevPanel();
    const label = document.createElement('label');
    label.htmlFor = 'dev-jump';
    label.textContent = 'Jump to ';
    const select = document.createElement('select');
    select.id = 'dev-jump';
    select.append(new Option('Region…', ''), ...REGIONS.map(region => new Option(`${region.name} · ${region.from}`, (region.from + region.to) / 2)));
    select.addEventListener('change', () => {
      if (select.value) this.jumpTo(Number(select.value));
      select.value = '';
      select.blur();
    });
    label.append(select);
    // Spawn: type to search the list, then Enter or the button puts one beside the hero.
    const spawn = document.createElement('label');
    spawn.htmlFor = 'dev-spawn';
    spawn.innerHTML = `Spawn <span class="dev-spawn"><input id="dev-spawn" list="dev-spawn-items" placeholder="Search…" autocomplete="off">
      <button type="button" id="dev-spawn-go">Go</button></span>
      <datalist id="dev-spawn-items">${Object.keys(SPAWNS).map(name => `<option value="${name}">`).join('')}</datalist>`;
    const input = spawn.querySelector('input');
    const go = () => {
      // An exact name, or else the first one containing what was typed.
      const typed = input.value.trim().toLowerCase();
      const name = Object.keys(SPAWNS).find(n => n.toLowerCase() === typed) ?? (typed && Object.keys(SPAWNS).find(n => n.toLowerCase().includes(typed)));
      if (!name) return;
      input.value = name;
      this.spawnItem(SPAWNS[name]);
      // Back to the game, so the hero can go and hit it.
      input.blur();
    };
    spawn.querySelector('button').addEventListener('click', go);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') go(); });
    this.devPanel.querySelector('.dev-panel-content').prepend(label, spawn);
  }

  // Dev panel: an aircraft appears ahead of the hero and a little above; street life appears on
  // the street below, in whichever area the hero is over.
  spawnItem(what) {
    const x = this.position.x;
    if (!(what in AIR_KINDS)) {
      for (const life of this.lives) if (life.spawnAt?.(x, what)) return;
      return;
    }
    const craft = this.airLife.spawn(x - 400, x + 400, what);
    craft.x = x + craft.dir * -(craft.spec.length / 2 + 120);
    craft.y = Math.min(this.position.y - craft.spec.height / 2 - 30, this.terrainAt(x) - 140);
    if (craft.spot !== undefined) craft.spot = x;
  }

  // Puts the hero in the air over world x, with the camera already there. Combat resets return here too.
  jumpTo(x) {
    this.spawnX = x;
    this.position.x = this.cameraCenter.x = x;
    this.position.y = this.cameraCenter.y = this.groundAt(x) - 90;
    this.cameraGround = undefined;
    this.velocity.x = this.velocity.y = 0;
  }

  setEvilMode(on) {
    // Whatever is held or in the air goes back to its owner before the world is rebuilt.
    this.throwing?.reset();
    this.evilMode = on;
    this.destruction?.destroy();
    this.linerBody = null;
    // Windmill, Oakwood, Mirror Lake, Rivertown, Orchard, Bayport, Shell Beach, the Blue Sea, Golden Beach
    // Sandport, the Red Dunes and Palm Oasis promote with the city: trees and palms topple; the mills,
    // beacon, bridge, minster, oast, wheels, lighthouses, piers, sea forts, the Sun Tower, the Caravan
    // Gate, the Red Arch and the watchtower come down.
    this.destruction = on ? new CityDestruction(this, ALL_BUILDINGS(), x => this.terrainAt(x),
      (from, to) => SEA_Y - Math.max(0, maxElevation(from, to))) : null;
    for (const life of this.lives) life.setBuildingsIntact(!on);
    // Big ships (freighters, tankers) break up pixel by pixel like the liner once the hero hits them.
    this.pixelShips = [];
    for (const life of this.lives) {
      life.promoteShip = this.destruction ? (boat, from, to, kind) => this.promoteShip(life, boat, from, to, kind) : null;
    }
    // The street reacts: people flee breaking buildings, and falling pieces crush what is under them.
    if (this.destruction) {
      this.destruction.onLanding = (from, to, size) => { for (const life of this.lives) life.crush(from, to, size, this.streetAt); };
      this.destruction.onBreak = x => { for (const life of this.lives) life.alarm(x); };
      // A sinking liner churns white foam on the sea, not dust.
      this.destruction.onFroth = (x, size) => this.froth(x, size);
    }
    this.combat.propDefinitions = this.destruction?.props() ?? [];
    this.combat.onSceneryHit = this.destruction
      ? (prop, amount, direction, kind, point) => this.destruction.hit(prop, amount, direction, kind, point)
      : null;
    this.combat.reset();
    this.destruction?.link(this.combat);
    this.combatArtwork.reset();
  }

  // Resetting combat rebuilds the city in evil mode.
  resetCombat(event) {
    super.resetCombat(event);
    if (this.evilMode && !event?.repeat) this.setEvilMode(true);
  }

  step(dt) {
    const from = { x: this.position.x, y: this.position.y };
    dt = super.step(dt);
    if (!dt) return;
    this.stepWater(dt, from);
    this.stepSplashes(dt);
    const half = this.cameras.main.width / this.cameras.main.zoom / 2;
    const hero = {
      x: this.position.x, vx: this.velocity.x, vy: this.velocity.y,
      altitude: this.groundAt(this.position.x) - this.position.y, ram: this.ramDamageActive,
    };
    // Traffic crosses the river on the Old Bridge while it stands; otherwise roads end at the banks.
    const bridge = this.bridgeUp = this.bridgeStanding();
    for (const life of this.lives) {
      life.setBridgeStanding(bridge);
      life.step(dt, this.cameraCenter.x - half, this.cameraCenter.x + half, hero);
    }
    this.skyLife.step(dt, this.cameraCenter.x - half, this.cameraCenter.x + half, this.position);
    if (!this.destruction) return;
    // Promoted buildings are baked at one planet copy. Move each to the copy nearest the hero, as
    // nearestCopy does for the base's guns, so ones across the x = 0 seam (Ember Base seen from
    // Green City's west end) still show and take hits. Only bodies half a planet away move.
    for (const body of this.destruction.bodies) {
      const dx = Math.round((this.position.x - body.left) / CIRCUMFERENCE) * CIRCUMFERENCE;
      if (!dx) continue;
      body.left += dx;
      body.x += dx;
      if (body.prop) { body.prop.x += dx; body.prop.previousX = body.prop.x; }
    }
    // RAM tunnels through buildings along the hero's path, every step it stays inside.
    // Both upgrade levels share flight; only level 2 can break scenery.
    const ram = this.ramDamageActive && Math.hypot(this.velocity.x, this.velocity.y) >= COMBAT.ramMinSpeed;
    this.power.plow(ram ? this.destruction.ram(from, this.position, this.velocity) : 0, dt);
    this.destruction.step(dt);
    // The cruise liner and the promoted big ships are ships, not buildings: holed past SHIP_SINK of
    // their strength, they sink. A sunk big ship then leaves her sea lane.
    const liner = this.linerBody ??= this.destruction.bodies.find(body => body.building.id === CRUISE_SHIP_BUILDING.id);
    for (const ship of [liner, ...this.pixelShips.map(each => each.body)]) {
      if (!ship?.prop || ship.sinking || ship.prop.health >= ship.building.maxHealth * SHIP_SINK) continue;
      this.destruction.sink(ship.building.id, ship.building.sinkTime);
      sound.splash?.(1);
    }
    for (const ship of this.pixelShips) if (ship.body.sinking?.done) ship.life.removeBoat(ship.boat);
    this.pixelShips = this.pixelShips.filter(ship => !ship.body.sinking?.done);
    // The hero's attacks hit street life too. Cars and people are never aim targets (the punch
    // flow stays on enemies and buildings); they are hit when an attack passes through them.
    const punch = this.rig.punch;
    const hand = punch.canHit ? this.lastPunchSample : null;
    // A beam stopped by a vehicle ends on its edge; reach a few px in so the hit counts.
    const beam = this.laser.beam && this.laser.beam.hitsVehicle ? reach(this.laser.beam, 4) : this.laser.beam;
    const pound = this.combat.groundPounds.at(-1);
    let punched = false;
    let rammed = false;
    for (const life of this.lives) {
      if (ram && life.heroRam(from, this.position, this.velocity, this.streetAt)) rammed = true;
      if (hand && life.heroPunch(hand, punch.angle, punch.attackId, this.streetAt)) punched = true;
      if (beam) life.heroLaser(beam, dt, this.streetAt);
      if (pound && pound !== this.lastPound) life.heroPound(pound.x, pound.radius, this.streetAt);
    }
    this.lastPound = pound;
    if (rammed) {
      this.punchEffects?.contact?.(this.position, Math.atan2(this.velocity.y, this.velocity.x));
    }
    if (punched) {
      this.punchEffects?.contact?.(hand, punch.angle);
      sound.punchImpact();
    }
  }

  create() {
    installCrashDiagnostics(this);
    super.create();
    this.chaosHud = new ChaosHud(document.getElementById('status-hud') ?? document.querySelector('.stage-wrap'));
    this.events.once('shutdown', () => this.chaosHud?.remove());
    // ?debug exposes the scene for driving the lab from the console or a test harness.
    if (new URLSearchParams(window.location.search).has('debug')) window.freeRoam = this;
    this.splashArt = this.add.graphics().setDepth(10);
    // The eye laser stops on the first car, boat or aircraft in its path as well as on
    // targets and buildings, in or out of evil mode. A vehicle stop has no combat target.
    const traceTargets = this.traceCombatLaser;
    this.traceCombatLaser = (from, to) => {
      let best = traceTargets(from, to);
      for (const life of this.lives) {
        const t = life.laserBlock?.(from, to, this.streetAt) ?? null;
        if (t !== null && (!best || t < best.t)) best = { t, target: null };
      }
      return best;
    };
    this.regionName = document.getElementById('region-name');
    this.countryName = document.getElementById('country-name');
    this.mapDialog = document.getElementById('world-map');
    this.expandedMap = new PlanetMap(document.getElementById('expanded-planet-map'));
    this.mapProfile = new PlanetProfile(document.getElementById('planet-profile'));
    this.atlasRegionName = document.getElementById('atlas-region-name');
    this.atlasCountryName = document.getElementById('atlas-country-name');
    this.openMapButton = document.getElementById('open-world-map');
    this.closeMapButton = document.getElementById('close-world-map');
    this.openMap = () => {
      if (this.mapDialog.open || this.policeWon || this.levelMapOpen) return;
      // In a campaign level the map is the level map; world travel is Free Roam's.
      if (this.level) { this.showLevelMap?.(); return; }
      const altitude = this.groundAt(this.position.x) - this.position.y;
      this.expandedMap.update(this.position.x, altitude);
      this.mapProfile.update(this.position.x);
      this.atlasRegionName.textContent = this.regionName.textContent;
      this.atlasCountryName.textContent = this.countryName.textContent;
      this.handleControlBlur();
      this.input.keyboard.resetKeys();
      this.scene.pause();
      this.mapDialog.showModal();
      this.closeMapButton.focus();
    };
    this.closeMap = () => this.mapDialog.close();
    // Pause menu (Esc, P or the HUD button): resume and the world map. The map replaces it.
    this.pauseMenu = document.getElementById('pause-menu');
    this.pauseButton = document.getElementById('pause-button');
    const musicVolume = document.getElementById('music-volume');
    const sfxVolume = document.getElementById('sfx-volume');
    const muteAll = document.getElementById('mute-all');
    const syncAudio = () => {
      musicVolume.value = Math.round(sound.musicVolume * 100);
      sfxVolume.value = Math.round(sound.sfxVolume * 100);
      document.getElementById('music-volume-value').textContent = `${musicVolume.value}%`;
      document.getElementById('sfx-volume-value').textContent = `${sfxVolume.value}%`;
      muteAll.textContent = sound.muted ? 'Unmute all' : 'Mute all';
      muteAll.setAttribute('aria-pressed', String(sound.muted));
    };
    const changeMusic = () => { sound.setMusicVolume(Number(musicVolume.value) / 100); syncAudio(); };
    const changeSfx = () => { sound.setSfxVolume(Number(sfxVolume.value) / 100); syncAudio(); };
    const toggleMute = () => { sound.setMuted(!sound.muted); syncAudio(); };
    musicVolume.addEventListener('input', changeMusic);
    sfxVolume.addEventListener('input', changeSfx);
    muteAll.addEventListener('click', toggleMute);
    syncAudio();
    this.openPause = () => {
      if (this.pauseMenu.open || this.mapDialog.open || this.policeWon) return;
      this.handleControlBlur();
      this.input.keyboard.resetKeys();
      this.scene.pause();
      syncAudio();
      this.pauseMenu.showModal();
      document.getElementById('pause-resume').focus();
    };
    this.closePause = () => this.pauseMenu.close();
    // Leaving to the main menu loses the run, so it asks first in a dialog over the pause menu.
    this.leaveConfirm = document.getElementById('leave-confirm');
    const leaveYes = document.getElementById('leave-yes');
    const leaveNo = document.getElementById('leave-no');
    this.pauseToMap = () => {
      if (!this.leaveConfirm.open) { this.leaveConfirm.showModal(); leaveNo.focus(); return; }
      this.leaveConfirm.close();
      this.pauseMenu.close();
      this.openMap();
    };
    const stayInPause = () => { this.leaveConfirm.close(); this.openMapButton.focus(); };
    this.resumeFromPause = () => { this.leaveConfirm.close(); if (!this.mapDialog.open) this.resumeFromMap(); };
    this.resumeFromMap = () => {
      this.input.keyboard.resetKeys();
      this.handleControlFocus();
      this.scene.resume();
      this.game.canvas.tabIndex = -1;
      this.game.canvas.focus({ preventScroll: true });
    };
    this.setEvilMode(true);
    this.mapKey = event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (this.levelMap?.dialogOpen) return; // Settings or a wipe confirm: Esc closes it, nothing else.
      if ((event.code === 'Escape' || event.code === 'KeyP') && !this.pauseMenu.open && !this.mapDialog.open) {
        event.preventDefault();
        if (!event.repeat) this.openPause();
        return;
      }
      if (this.levelMapOpen) {
        // Esc closes the level map only mid-level; on launch and after a boss, pick a level.
        if (event.code === 'Escape' && this.level && !this.policeWon) this.hideLevelMap();
        return;
      }
      if (event.code === 'KeyV' && !this.mapDialog.open) {
        if (this.level) return;
        event.preventDefault();
        if (!event.repeat) this.setEvilMode(!this.evilMode);
        return;
      }
      if (event.code !== 'KeyM') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (this.mapDialog.open) this.closeMap();
      else if (this.pauseMenu.open) this.pauseToMap();
      else this.openMap();
    };
    const pauseControls = [[this.pauseButton, this.openPause], [document.getElementById('pause-resume'), this.closePause], [leaveYes, this.pauseToMap], [leaveNo, stayInPause]];
    this.openMapButton.addEventListener('click', this.pauseToMap);
    this.closeMapButton.addEventListener('click', this.closeMap);
    this.mapDialog.addEventListener('close', this.resumeFromMap);
    this.pauseMenu.addEventListener('close', this.resumeFromPause);
    for (const [button, action] of pauseControls) button.addEventListener('click', action);
    window.addEventListener('keydown', this.mapKey, true);
    this.events.once('shutdown', () => {
      musicVolume.removeEventListener('input', changeMusic);
      sfxVolume.removeEventListener('input', changeSfx);
      muteAll.removeEventListener('click', toggleMute);
      this.openMapButton.removeEventListener('click', this.pauseToMap);
      this.closeMapButton.removeEventListener('click', this.closeMap);
      this.mapDialog.removeEventListener('close', this.resumeFromMap);
      this.pauseMenu.removeEventListener('close', this.resumeFromPause);
      for (const [button, action] of pauseControls) button.removeEventListener('click', action);
      this.leaveConfirm.close();
      this.pauseMenu.close();
      window.removeEventListener('keydown', this.mapKey, true);
      this.mapDialog.close();
    });
  }

  syncCombatHud() {
    super.syncCombatHud();
    this.chaosHud?.sync(this.chaos, this.director.title);
  }

  updateCamera(dt) {
    const camera = this.cameras.main;
    this.cameraCenter.x += (this.position.x + this.velocity.x * 0.4 - this.cameraCenter.x) * (1 - Math.exp(-4 * dt));
    // Ease the ground line so the camera glides over terrain instead of tracing every bump. It
    // frames the land and sea, not the cruise ship's decks, so the water stays in view on board.
    // A diving hero pulls it down so they stay well above the bottom edge.
    const ground = Math.max(this.terrainAt(this.position.x), this.position.y + HERO_HALF - 20);
    this.cameraGround = this.cameraGround === undefined ? ground
      : this.cameraGround + (ground - this.cameraGround) * (1 - Math.exp(-3 * dt));
    const baseHeight = camera.height / this.baseZoom;
    // Touch shows a little more ground than desktop, about an underpass deep, for the thumb pads.
    const below = (1 - (this.touchMove ? TOUCH_GROUND_LINE : GROUND_LINE)) * baseHeight;
    const top = this.cameraGround + below + CEILING_HERO_MARGIN;
    const target = this.cameraGround - TALLEST_BUILDING - TOWER_HEADROOM;
    // The ceiling rises at once. It never pushes the hero down: when the ground below asks for a
    // lower one, it holds, and after LOCK_DELAY s only follows the hero down as they descend on
    // their own, LOCK_SLACK px above them, so the tighter limit settles in unnoticed.
    if (this.ceiling === undefined || target <= this.ceiling) {
      this.ceiling = target;
      this.lockTimer = 0;
    } else if ((this.lockTimer += dt) > LOCK_DELAY) {
      this.ceiling = Math.min(target, Math.max(this.ceiling, this.position.y - LOCK_SLACK));
    }
    const minZoom = altitudeZoomLimit(MIN_ALTITUDE_ZOOM, Boolean(this.touchMove));
    const heroLine = this.touchMove ? TOUCH_HERO_LINE : HERO_LINE;
    const topLimit = top - baseHeight / minZoom;
    if (this.position.y < this.ceiling) {
      this.position.y = this.ceiling;
      this.velocity.y = Math.max(0, this.velocity.y);
    }
    // Zoom out to keep the hero below HERO_LINE, but only zoom back in once it sinks below ZOOM_IN_LINE.
    const span = baseHeight / Math.max(1, this.cameraGround - this.position.y + below);
    // streetZoom: how far in the view sits at street level (the enemy lab's is closer).
    const targetZoom = Math.max(minZoom, Math.min(this.streetZoom ?? 1, (1 - heroLine) * span,
      Math.max(this.altitudeZoom, (1 - ZOOM_IN_LINE) * span)));
    // Zoom out briskly so a fast climb never leaves the frame, and back in gently.
    const rate = targetZoom < this.altitudeZoom ? 8 : 2.5;
    this.altitudeZoom += (targetZoom - this.altitudeZoom) * (1 - Math.exp(-rate * dt));
    camera.setZoom(this.baseZoom * this.altitudeZoom);
    // Partly offset the zoom-out so the hero stays readable high up (~75% of ground size on screen).
    this.rig.size = Math.max(1 / Math.sqrt(Math.min(1, this.altitudeZoom)), MIN_HERO_SCREEN_SIZE / this.altitudeZoom);
    // Past the zoom-out limit, lift the view to keep the hero on HERO_LINE.
    const height = camera.height / camera.zoom;
    const framed = this.cameraGround + below - height / 2;
    // Up to the ceiling, plus the room to hold the hero on HERO_LINE rather than the top edge. The
    // hero first climbs to HERO_LINE at full zoom-out, then the view follows from there.
    const raised = Math.max(0, topLimit - this.ceiling);
    const room = raised + (height * heroLine - CEILING_HERO_MARGIN) * Math.min(1, raised / 200);
    const lift = this.altitudeZoom > minZoom * 1.02 ? 0 : Math.min(room, Math.max(0, framed - (this.position.y - height * heroLine + height / 2)));
    this.cameraLift = (this.cameraLift ?? 0) + (lift - (this.cameraLift ?? 0)) * (1 - Math.exp(-8 * dt));
    this.cameraCenter.y = framed - this.cameraLift;
    camera.centerOn(this.cameraCenter.x, this.cameraCenter.y);
  }

  update(time, delta) {
    super.update(time, delta);
    this.destruction?.draw(this.elapsed);
    this.drawSplashes();
    this.drawMinimap();
  }

  groundPoundSurface(x) {
    if (this.diveable(x)) return { water: true };
    if (isWater(wrapX(x))) return { dust: 0xaeb6bb, chip: 0x59656d, light: 0xd0d8dc, ink: 0x35434c };
    const { ground } = groundColors(x);
    const top = surfaceColor(x);
    return { dust: lerpColor(top, 0xb4a58f, 0.4), chip: ground[1],
      light: top, ink: ground[2] };
  }

  // Landing on the sea is a splash, never a thud. Where the hero can dive, the splash comes as they
  // break the surface (stepWater), and touching the bed below is silent. A ground pound reads as foam.
  onLanding(speed, pounded) {
    const x = this.position.x;
    if (!this.diveable(x)) return;
    if (pounded) {
      const wave = this.combat.groundPounds.at(-1);
      if (wave) wave.water = true;
    }
    if (speed < 40 || this.floorAt(x) > SEA_Y) return;
    this.splash(x, speed);
  }

  // Diving (QA-12). Breaking the surface going down is a splash with a foam ring; under it, water
  // drags on every move, floats the hero back up unless they steer down, trails bubbles, tints them
  // and muffles the sound. Coming back up throws droplets off the hero.
  stepWater(dt, from) {
    const x = this.position.x;
    const wet = this.diveable(x);
    const feet = this.position.y + HERO_HALF;
    const wasIn = from.y + HERO_HALF > SEA_Y;
    const isIn = wet && feet > SEA_Y;
    if (isIn && !wasIn && this.velocity.y > 0) this.splash(x, Math.max(60, this.velocity.y));
    if (!isIn && wasIn && this.diveable(from.x) && this.velocity.y < -25) this.emerge(x, -this.velocity.y);
    const under = isIn && this.position.y - HERO_HALF > SEA_Y;
    if (isIn) {
      const drag = Math.exp(-WATER_DRAG * dt);
      if (!this.ramActive) {
        this.velocity.x *= drag;
        this.velocity.y *= drag;
      }
      // Full buoyancy until half out, so the hero bursts up through the surface rather than creeping.
      if (!(this.movementInput().y > 0)) this.velocity.y -= BUOYANCY * dt * Math.min(1, (feet - SEA_Y) / HERO_HALF);
      if (under && Math.random() < dt * 9) {
        this.waterSplash.bubbles.push({ x: x + (Math.random() - 0.5) * 6, y: this.position.y - HERO_HALF, age: 0,
          size: Math.random() < 0.3 ? 2 : 1, wobble: Math.random() * 6 });
      }
    }
    if (under !== this.underwater) {
      this.underwater = under;
      this.rig.image.setTint?.(UNDERWATER_TINT);
      if (!under) this.rig.image.clearTint?.();
      this.rig.image.setAlpha?.(under ? 0.8 : 1);
      sound.underwater?.(under);
    }
  }

  // Bursting up out of the water: a ring on the surface, a quiet splash and droplets shed off the hero.
  emerge(x, speed) {
    const size = Math.min(1, speed / 250);
    sound.splash(0.1 + 0.3 * size);
    this.waterSplash.rings.push({ x, y: SEA_Y, age: 0, size: size * 0.5 });
    const count = Math.round(10 + size * 18);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 2;
      this.waterSplash.drops.push({
        x: x + spread * 7, y: this.position.y + (Math.random() - 0.5) * HERO_HALF,
        vx: spread * (20 + size * 50), vy: this.velocity.y * (0.4 + Math.random() * 0.5) - 20, age: 0,
      });
    }
  }

  // A big ship the hero has just hit stops and is baked, as she looks, into a destructible body
  // like the cruise liner's, which takes this first hit and every one after it: her hull holes,
  // scorches and sheds debris, and once holed enough she sinks (step). True if she was promoted.
  promoteShip(life, boat, from, to, kind) {
    if (!this.destruction || life.shift === null) return false;
    const x = Math.round(boat.x + life.shift);
    const drop = life.waterline(boat);
    const ship = { ...boat, rock: 0, phase: 0, speed: 0 };
    const building = {
      vehicle: boat, vehicleKind: boat.kind,
      id: `ship-${boat.kind}-${this.destruction.serial}`, x, surface: SEA_Y + drop, ship: true,
      width: Math.round(boat.length + 24), height: Math.round(boat.height * 0.75),
      // Strength like the liner's, for her size; the bigger the longer she takes to go down.
      maxHealth: Math.round(CRUISE_SHIP_BUILDING.maxHealth * boat.length / CRUISE_SHIP_BUILDING.width),
      sinkTime: boat.kind === 'tanker' ? 16 : 14,
      // Drawn at the bake's waterline (3 px above its base), with the lane drop taken back out.
      draw: (g, localX, base) => {
        ship.x = localX - life.shift;
        life.drawBoat(g, ship, base - 3 - drop);
      },
    };
    const body = this.destruction.addBody(building);
    this.pixelShips.push({ life, boat, body });
    this.combat.propDefinitions = this.destruction.props();
    this.combat.reset();
    // This hit lands on her now; the arena carries every later one.
    const t = this.destruction.trace(body, from, to, 8) ?? 0.5;
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const direction = length > 0.5 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
      : { x: Math.sign(x - point.x) || 1, y: 0 };
    this.destruction.impact(body, point, direction, kind === 'laser' ? 'punch' : kind);
    return true;
  }

  // Foam churned up on the surface where a ship goes down: a spreading ring and a little spray.
  // y: the water surface there (a lake sits above the sea).
  froth(x, size, y = SEA_Y) {
    this.waterSplash.rings.push({ x, y, age: 0, size: size * 0.6 });
    for (let i = 0; i < 4; i++) {
      this.waterSplash.drops.push({ x: x + (Math.random() - 0.5) * 10, y: y - 1,
        vx: (Math.random() - 0.5) * 40, vy: -(30 + Math.random() * 60) * size, age: 0 });
    }
    for (let i = 0; i < 2; i++) {
      this.waterSplash.bubbles.push({ x: x + (Math.random() - 0.5) * 12, y: y + 4 + Math.random() * 20, age: 0,
        size: 1 + (Math.random() < 0.4 ? 1 : 0), wobble: Math.random() * 6 });
    }
  }

  // The sea's own sound, a crown of droplets thrown up and out, and a foam ring spreading on the surface.
  splash(x, speed) {
    const size = Math.min(1, speed / 500);
    sound.splash(0.25 + 0.75 * size);
    const surface = this.terrainAt(x);
    this.waterSplash.rings.push({ x, y: surface, age: 0, size });
    const count = Math.round(8 + size * 22);
    for (let i = 0; i < count; i++) {
      const spread = (i / (count - 1) - 0.5) * 2;
      this.waterSplash.drops.push({
        x: x + spread * 6, y: surface - 1, vx: spread * (40 + size * 120) + (Math.random() - 0.5) * 30,
        vy: -(70 + size * 200) * (1 - Math.abs(spread) * 0.5) * (0.7 + Math.random() * 0.5), age: 0,
      });
    }
    if (this.waterSplash.drops.length > 160) this.waterSplash.drops.splice(0, this.waterSplash.drops.length - 160);
  }

  stepSplashes(dt) {
    const { drops, rings } = this.waterSplash;
    for (const drop of drops) {
      drop.age += dt;
      drop.vy += 520 * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
    }
    for (const ring of rings) ring.age += dt;
    // Bubbles wobble up and pop at the surface.
    for (const bubble of this.waterSplash.bubbles) {
      bubble.age += dt;
      bubble.y -= (28 + bubble.size * 10) * dt;
      bubble.x += Math.sin(bubble.age * 7 + bubble.wobble) * 8 * dt;
    }
    this.waterSplash.bubbles = this.waterSplash.bubbles.filter(bubble => bubble.y > this.terrainAt(bubble.x) + 1 && bubble.age < 3);
    this.waterSplash.drops = drops.filter(drop => drop.y < this.terrainAt(drop.x) + 1 && drop.age < 2);
    this.waterSplash.rings = rings.filter(ring => ring.age < SPLASH_RING);
  }

  drawSplashes() {
    const g = this.splashArt;
    g.clear();
    for (const ring of this.waterSplash.rings) {
      const t = ring.age / SPLASH_RING;
      const reach = (10 + ring.size * 30) + t * (40 + ring.size * 80);
      g.fillStyle(0xeef6f8, 0.75 * (1 - t) ** 2);
      // Broken foam on either side, thinning out as it spreads.
      for (let i = 0; i < 10; i++) {
        const along = (i % 5 + 0.5) / 5;
        const side = i < 5 ? -1 : 1;
        g.fillRect(Math.round(ring.x + side * reach * along) - 2, Math.round(ring.y) - 1, 3 + (i % 3), 1 + (i % 2));
      }
      if (t < 0.3) {
        g.fillStyle(0xeef6f8, 0.8 * (1 - t / 0.3));
        g.fillEllipse(ring.x, ring.y - 2, 10 + ring.size * 18, 4 + ring.size * 10);
      }
    }
    g.lineStyle(1, 0xeef6f8, 0.7);
    for (const bubble of this.waterSplash.bubbles) g.strokeCircle(bubble.x, bubble.y, bubble.size);
    g.fillStyle(0xeef6f8, 0.9);
    for (const drop of this.waterSplash.drops) g.fillRect(Math.round(drop.x), Math.round(drop.y), 2, 2);
  }

  drawWorld() {
    const graphics = this.world;
    const camera = this.cameras.main;
    const width = camera.width / camera.zoom;
    const height = camera.height / camera.zoom;
    const left = Math.floor((this.cameraCenter.x - width / 2) / COLUMN) * COLUMN - COLUMN;
    const right = this.cameraCenter.x + width / 2 + COLUMN;
    const top = this.cameraCenter.y - height / 2 - 2;
    const bottom = top + height + 4;
    graphics.clear();
    drawSky(graphics, { left, top, width: right - left, height }, skyAt(this.cameraCenter.x), this.cameraCenter);

    for (const [factor, scale, landColor, seaColor] of BACKDROP_LAYERS) {
      const baseY = this.cameraCenter.y + (SEA_Y - this.cameraCenter.y) * factor;
      const shift = this.cameraCenter.x * (1 - factor);
      for (let x = left; x < right; x += COLUMN) {
        const { rise, land, snowy } = backdropRise(x - shift, factor, scale);
        graphics.fillStyle(lerpColor(seaColor, landColor, land));
        graphics.fillRect(x, baseY - rise, COLUMN + 1, bottom - baseY + rise);
        if (snowy) {
          graphics.fillStyle(0xe8f2f6);
          graphics.fillRect(x, baseY - rise, COLUMN + 1, 3);
        }
      }
    }
    this.skyLife?.drawSky(graphics, left, right);
    for (const life of this.lives ?? []) life.drawSky(graphics, left, right, x => this.groundAt(x));
    drawCity(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawWindmill(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawForest(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawRivertown(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawOrchard(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawBayport(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawShellBeach(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawBlueSea(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction, this.cameraCenter.y);
    drawOceanArt(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawGoldenBeach(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawSandport(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawRedDunes(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawPalmOasis(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawSunland(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    drawFrostland(graphics, left, right, SEA_Y, this.cameraCenter.x, this.elapsed, !this.destruction);
    // Terrain draws over promoted buildings' images, so their bases still tuck into the soil.
    const ground = this.terrain ??= this.add.graphics().setDepth(2);
    ground.clear();

    drawTerrainColumns(ground, left, right, bottom);
    // People and traffic stand on the terrain cap, in front of the buildings.
    const life = this.lifeGraphics ??= this.add.graphics().setDepth(2.5);
    life.clear();
    drawLakeReflections(life, left, right, SEA_Y, this.cameraCenter.x, this.elapsed);
    // People and traffic cross the river on the Old Bridge's deck while it stands, not down the bank.
    this.bridgeUp = this.bridgeStanding();
    const street = this.streetAt;
    for (const area of this.lives ?? []) area.draw(life, left, right, street, top, bottom);
    this.skyLife?.draw(life, left, right);
  }

  drawMinimap() {
    const region = regionAt(this.position.x);
    if (this.regionName && this.regionName.textContent !== region.name) {
      this.regionName.textContent = region.name;
      this.countryName.textContent = region.country ?? (region.kind === 'ocean' ? 'Open waters' : 'Wildlands');
    }
  }
}

// Shared response owns the roster, attacks and dispatch hooks for both map and enemy labs.
export class FreeRoam extends withEnemyResponse(MapWorld) {}
