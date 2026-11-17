import { ChaosStats, casualtyKind } from './chaos-stats.js';
import { HeatHud } from './chaos-hud.js';
import { EnemyDirector, HEAT_PHASES, LEVELS } from './enemy-director.js';
import { CAMPAIGN, LevelMap, levelState, markCleared } from './campaign.js';
import { poki } from './poki.js';
import { Objectives, VillainiumGems, rollDrop } from './objectives.js';
import { RESPONSE_VEHICLES } from './response-vehicles.js';
import { BOSSES, PoliceEncounter, SLOW_MO } from './police-encounter.js';
import { RecordBanner, Records, STATS, StatsPanel, WinPanel } from './records.js';
import { ShopPanel, upgradeValue } from './shop.js';
import { drawPoliceElite, ELITE_TYPES } from './police-elite-art.js';
import { DIFFICULTY, ENEMY_RULES, EnemySystem, HERO_DAMAGE } from './enemy-system.js';
import { EnemyArtwork } from './enemy-art.js';
import { drawGunRound, enemyShotColor, bulletScreenZoom } from './enemy-attack-art.js';
import { LIFT } from './enemy-throw.js';
import { HELI_METRE } from './air-life.js';
import { sound } from './sound.js';
import { VILLAINIUM_TIP_AT } from './tutorial.js';
import { CIRCUMFERENCE, isWater, wrapX } from './planet.js';
import { EMBER_BARRACKS, EMBER_BASE_ZONE, EMBER_GUN_MOUNTS } from './frostland-art.js';
import { OFFICER_HEIGHT, SKINS, drawDrone, drawOfficer, drawTurret, tankMuzzle } from './police-art.js';

// Shared map/lab response: destruction selects the roster; the director bounds arrivals.
// Two punches put an officer down.
const OFFICER = { radius: 9, maxHealth: 90, enemyType: 'police', customArt: true };
// Police cars bring three officers; the director sets the officer and car targets (Police heat
// level 1 ramps 3 to 10 officers and 1 to 3 cars). Foot squads replace losses when parked cars
// fill the car slots.
const RESPONSE = { first: 2, every: 3, retry: 0.5, officers: 12, stop: [70, 140], offscreen: 60 };
// Heat level 2: SWAT troopers come 4 to a van. Three punches put one down.
const TROOPER = { radius: 9, maxHealth: 135, enemyType: 'swat', customArt: true };
// A riot shield leads each van's team. Its shield soaks a hit from the front (a punch, RAM or the
// laser; not from above, a blast or a grab): a punch or RAM knocks it aside for `down` s, the body
// still pushed `soak` × the knockback, so the next punch lands as usual (heat-and-enemies.md).
const RIOT = { radius: 9, maxHealth: 135, enemyType: 'riot', customArt: true };
const SHIELD = { down: 2.5, soak: 0.35, stagger: 0.3 };
// A SWAT van every `every` s (first after `first`) while fewer than `troopers` stand and fewer
// than `vans` vans have work. It stops like a police car (RESPONSE.stop) and lets out a riot
// shield and `team` - 1 troopers.
const VANS = { first: 4, every: 6, retry: 0.75, troopers: 8, vans: 2, team: 4 };
// Helicopters: one of each unlocked kind, up to 1/2/3 total at heat 2/3/4+,
// replacing losses every `every` s after the initial arrival. Each hovers `rise` px above
// the hero, `beside` px to the side, easing at `ease`/s up to its speed. The police door
// gunner (one hit kills him) goes down with his helicopter, and it with him.
const HELI = { first: 5, every: 5, rise: 95, beside: 60, ease: 1.5, low: 60 };
const GUNNER = { radius: 9, maxHealth: 40, enemyType: 'police-heli', customArt: true };
// The attack chopper's chin gun (heat level 4).
const CHIN_GUN = { radius: 6, maxHealth: 60, enemyType: 'chin-gun', customArt: true };
// Heat level 3's door gunner helicopter (2 hits) strafes: it flies past the hero to `strafe` px
// beyond, turns, and comes back, its rifleman firing from the door.
const HELIS = {
  policeheli: { heat: 2, first: HELI.first, gunner: GUNNER, light: true },
  gunheli: { heat: 3, first: 14, strafe: 170, gunner: { ...GUNNER, enemyType: 'heli-rifle' } },
  // The attack chopper stands off further and higher; its chin gun is no one to fall out.
  attackheli: { heat: 4, first: 16, beside: 150, rise: 115, gun: [3.55, 1.2], crewless: true, size: 1.1, stretch: 1.05, gunner: CHIN_GUN },
};
// Heat level 3's armoured truck: one at a time, the first after `first` s, then `every` s once the
// last has no work. It drives in like a police car; its roof gun (`gun`) fires from on top.
const TRUCKS = { first: 6, every: 22, retry: 2 };
const TRUCK_GUN = { radius: 4, maxHealth: 60, enemyType: 'truck-gun', customArt: true };
// Heat level 4, the army. Soldiers: three punches. Each lobs a grenade every `every` s (its own
// clock) at a hero `near`–`far` px off, arcing `flight` s onto where the hero was; it sits blinking
// and blows `fuse` s after the throw (or on touching the hero), carving any wall it lies against.
const SOLDIER = { radius: 9, maxHealth: 135, enemyType: 'soldier', customArt: true };
const GRENADE = { every: 6, near: 50, far: 200, flight: 0.85, fuse: 1.7, gravity: 400, radius: 22, damage: 12, power: 0.5 };
// APC: one every `every` s while fewer than `soldiers` stand and fewer than `apcs` are busy; it
// lets out `team` soldiers. Its roof autocannon fires from on top.
const APCS = { first: 5, every: 20, retry: 2, soldiers: 10, apcs: 2, team: 6 };
const AUTOCANNON = { radius: 5, maxHealth: 80, enemyType: 'autocannon', customArt: true };
// Tank: one at a time. Its gun elevates onto the hero at `turn` rad/s, within `elevation` rad
// (the telegraph: the aim freezes where the barrel points); a hero `behind` px past its back makes
// the turret swing round over `traverse` s, holding the windup. Then a shell flies at SHELL.speed and blows, carving and
// toppling what it hits. Five punches or the laser stop it.
const TANKS = { first: 12, every: 30, retry: 3, turn: 1.1, elevation: [-0.15, 1.2], behind: 24, traverse: 0.7 };
const TANK_GUN = { radius: 6, maxHealth: 120, enemyType: 'tank-gun', customArt: true };
const SHELL = { speed: 420, radius: 30, power: 1, life: 2 };
// The attack chopper's rockets: every `every` s while the hero is within `range`, the pod glows
// `charge` s, then `count` rockets `gap` s apart, `spread` rad apart, at `speed` px/s.
const ROCKETS = { every: 4.5, charge: 0.8, count: 4, gap: 0.14, spread: 0.08, speed: 300, range: 320, radius: 20,
  damage: 10, power: 0.6, life: 2 };
// Recon drone: olive, unarmed, one at a time; it hovers over the hero (spotting for the heat system).
const RECON = { radius: 7, maxHealth: 40, enemyType: 'recon', customArt: true };
const RECONS = { first: 3, every: 20, max: 1 };
// Heat 5 and 6: jets (heat-and-enemies.md "Jets"), each kind one at a time, the first after
// `first` s, then `every` s after the last is gone. While a recon drone is up, strike jets come
// twice as often.
const JETS = { strikejet: { heat: 5, first: 10, every: 24 }, vtol: { heat: 5, first: 18, every: 26 },
  fighter: { heat: 6, first: 12, every: 20 } };
// VTOL jet: flies in at `speed` px/s and brakes into a hover `beside` px to the side of the hero
// and `rise` px above (never lower than `low` over the street), easing at `ease`/s; its nozzles
// swing down as it slows. It stays level and faces the hero.
// VTOL: it picks a hover station `beside` px off the hero, `rise` px up, and holds it while the hero
// is within `range` px (its gun's reach); only then it moves to a new one on its own side. It speeds
// up and brakes at `accel` px/s², so it never jinks after every hero move.
const VTOL = { speed: 600, beside: 150, rise: 100, low: 70, ease: 1.6, accel: 520, range: 480 };
// The VTOL's and fighter's belly machine gun swivels after the hero at `turn` rad/s (a hero moving
// fast outruns it). Each cycle warns, fires a sustained stream, then reloads. Automatic duration
// and round spacing stay fixed across difficulty so the stream cannot become a denser curtain.
const VTOL_GUN = { turn: 1.4, duration: 3.15, variation: 0.9, off: 2.4, reloadFloor: 1.5, warn: 0.4, gap: 0.08, speed: 900, length: 10, radius: 6, damage: 3, power: 0.15, life: 0.6 };
// A fighter's short, tighter strafing volley contrasts with the VTOL's hovering stream.
const FIGHTER_GUN = { ...VTOL_GUN, duration: 0.55, variation: 0.22, off: 1.45, reloadFloor: 0, warn: 0.3, gap: 0.06, speed: 1150, length: 8, life: 0.5 };
// Strike jet: one pass at a steady `speed` px/s, `above` px over the hero (and at least `rise`
// px over the street), so its missiles come down at the hero rather than flat along its line. As soon as it is in view it locks on (MISSILE.lock) and fires `salvo`
// heat-seeking missiles `gap` s apart.
const STRIKE = { speed: 750, rise: 170, above: 170, salvo: 5, gap: 0.15 };
// Fighter: passes at `slow` px/s within `near` px of the hero, `dash` further out, turning `turn`
// px past the view's edge. It flies `above` px over the hero (and at least `low` px over the
// street), so its missiles come down at the hero. Its belly gun swivels after the hero (VTOL_GUN)
// while it is in view; one missile a pass after the lock.
// The pass's height is set when it starts; mid-pass it only climbs over terrain, easing vy at `climb`.
const FIGHTER = { slow: 420, dash: 700, near: 260, turn: 140, above: 170, low: 170, ease: 2.5, climb: 1.2, maxClimb: 160 };
// Missiles lock for `lock` s (a tone, the seeker blinking) once the jet is in view (`edge` px
// inside the view's edge), then launch straight at the hero at `speed` px/s and home at `turn`
// rad/s: a straight line to dodge, and a wide loop back for another go if the hero does. A punch
// sends one back `reflect` × faster along the punch; sent back, it no longer homes and downs an
// aircraft it flies into.
const MISSILE = { edge: 20, lock: 0.5, speed: 300, turn: 1.8, life: 5, radius: 22, damage: 14, power: 0.6, reflect: 1.6, punch: 12 };
// Guns mounted on a vehicle's roof, and the drones (flown in, wrecked when downed).
const MOUNTED = new Set([TRUCK_GUN.enemyType, AUTOCANNON.enemyType, TANK_GUN.enemyType]);
const DRONE_TYPES = new Set(['police-drone', 'recon', 'swarm']);
// The vehicles heat sends (CityLife.dispatch).
const SENT = Object.keys(RESPONSE_VEHICLES);
// Late SWAT's marksmen take `share` of the rooftop spots: a laser line tracks the hero through
// the aim, then one heavy shot. Police heat level 3 posts police snipers the same way.
const MARKSMAN = { radius: 9, maxHealth: 90, enemyType: 'sniper', customArt: true, share: 0.5 };
const POLICE_SNIPER = { ...MARKSMAN, enemyType: 'police-sniper' };
// The searchlight: its pool's radius on the hero, how fast the pool closes on the hero (per s;
// high, so it reads as locked on), and its beam's soft layers (fractions of the radius, alphas).
const SPOT = { radius: 13, follow: 20, layers: [[1, 0.06], [0.62, 0.07], [0.3, 0.09]] };
// Police drones fly in from off screen, `rise` px above the hero, every `every` s while fewer than
// `max` are up. One punch brings one down; it falls and lies wrecked.
const DRONE = { radius: 6, maxHealth: 40, enemyType: 'police-drone', customArt: true };
// Out past `notice` px, a drone cruises in at `cruise` × its rule speed.
const DRONES = { first: 3, every: 0.9, max: 14, rise: 70, notice: 260, cruise: 2.5 };
// An officer in the hero's hands is a person: thrown, they hit like one (city-life.js LIFT.body)
// and tumble at its rate. Let go, they fall at `gravity` px/s², tumbling, and lie `daze` s.
// Landing faster than `lethal` px/s (a fall of about 8m) kills.
const BODY = { maxHealth: 40, spinRate: 14, gravity: 620, tumble: 8, daze: 1.4, lethal: 330 };
// Rooftop officers: up to `max` perched at once, on flat roofs (buildings with a `roof`, as birds
// use) `near`–`far` px from the hero (off screen first), at least `high` px above the street.
const ROOF = { max: 2, near: 160, far: 360, high: 30, flat: 5, every: 8 };
// Ember Base defends itself at any heat: its gun pits and citadel roof are manned by big guns (drawn
// `scale`x, `health`x tougher) while the hero is within `reach` px of the base, a gun knocked out comes
// back after `respawn` s, and soldiers file out of the barracks, `every` s, up to `soldiers` at once.
const BASE = { reach: 800, scale: 1.8, health: 3, respawn: 45, soldiers: 24, squad: 3, every: 2,
  shellSpeed: 560 };
// The dev panel's heat levels (heat-and-enemies.md); only those up to HEAT_BUILT are in code.
const HEAT_LEVELS = ['Calm', 'Police', 'SWAT', 'SWAT full response', 'Army', 'Full arsenal',
  'Countermeasures', 'Black ops', 'Scorched earth'];
// Past 4, only the jets are built so far (heat-and-enemies.md).
const HEAT_BUILT = 6;
// The dev panel's enemy spawn list: label to what spawnEnemy makes.
const ENEMY_SPAWNS = { 'Patrol officer': 'officer', 'Rooftop officer': 'roof', 'Police car': 'car', 'Police drone': 'drone',
  'Police van': 'policevan', 'SWAT trooper': 'trooper', 'Riot shield': 'riot', 'SWAT van': 'van', 'Police helicopter': 'policeheli',
  'Police sniper': 'police-sniper', Marksman: 'marksman', 'Door gunner helicopter': 'gunheli', 'Armoured truck': 'truck',
  'Pursuit officer': 'pursuit', Breacher: 'breacher', 'Police interceptor': 'interceptor',
  'Police sniper helicopter': 'sniperheli', 'Sky Marshal': 'marshal', 'Bulwark boss': 'boss', 'Rhino boss (SWAT)': 'rhino', 'Goliath boss (Army)': 'goliath',
  Soldier: 'soldier', APC: 'apc', Tank: 'tank', 'Attack chopper': 'attackheli', 'Recon drone': 'recon',
  'Strike jet': 'strikejet', 'VTOL jet': 'vtol', 'Fighter jet': 'fighter' };

export const withEnemyResponse = Base => class extends Base {
  constructor() {
    super();
    this.restartResponse();
    this.chaos = new ChaosStats();
    this.heat = 0;

    this.deployed = 0;
    // Officers lift like people: at once, at people size, no wearing down first.
    this.policeLift = { liftable: (hero, reach, size) => this.liftableOfficer(hero, reach, size) };
  }

  createArena() {
    super.createArena();
    this.enemies = new EnemySystem(this.combat);
    this.combat.onDefeat = target => this.recordDefeat(target);
    this.director = new EnemyDirector();
    this.policeEncounter = new PoliceEncounter(this);
    this.director.manual = this.heatOverride ?? null;
    this.heat = this.director.level;
    // ENEMY_RULES' timings read as Easy; the lab starts a step harder (dev panel: Difficulty).
    this.enemies.setDifficulty('normal');
    this.enemyArtwork = new EnemyArtwork(this, this.enemies);
    // A sandbox, not a drill: no aim lines, lock rings or punch target brackets.
    this.enemyArtwork.warnings = false;
    this.combatArtwork.brackets = false;
    // In front of the buildings and street life, behind the hero's effects.
    this.policeGraphics = this.add.graphics().setDepth(11);
    this.ordnance = [];
    this.enemies.onOrdnance = (gun, rule) => rule.ordnance === 'boss-missile' ? this.policeEncounter.fireMissile(gun, rule)
      : rule.ordnance === 'mortar' ? this.policeEncounter.fireMortar(gun, rule)
        : rule.ordnance === 'walker-shell' ? this.policeEncounter.fireCannon(gun, rule) : this.fireShell(gun, rule);
    // Rhino's water cannon shoves the hero along the jet.
    this.enemies.onPushHero = (x, y) => { this.velocity.x += x; this.velocity.y += y; };
    this.enemies.onDeploySquad = truck => this.deploySquad(truck);
  }

  // A police car brings three officers, its transport van six; a SWAT van brings troopers.
  // Each team fans out so people do not stack.
  deployOfficers(x, car) {
    // The armoured truck and the tank carry no one: their guns are their crew.
    if (car?.kind === 'armoured' || car?.kind === 'tank' || car?.kind === 'policebike') return;
    if (car?.wreck) return;
    const swat = car?.kind === 'swat';
    const apc = car?.kind === 'apc';
    const count = RESPONSE_VEHICLES[car?.kind]?.crew ?? 3;
    for (let i = 0; i < count; i++) {
      const at = x + (i - (count - 1) / 2) * 6;
      const unit = apc ? SOLDIER : swat ? (i === 0 ? RIOT : TROOPER) : OFFICER;
      this.addUnit(unit, at, this.terrainAt(at) - unit.radius, 0.4 + i * 0.25, { casualtyIdentity: car?.occupants?.[i], spread: (this.deployed % (apc ? 5 : swat ? 4 : 3)) * 30 });
    }
  }

  // Adds a unit of the given kind at world (x, y), waking after `wake` s. Riot shields get their guard.
  addUnit(unit, x, y, wake, extra = {}) {
    const officer = this.combat.addEnemy({ ...unit, x, y, response: true, lookSeed: this.deployed++ * 7 + 3, ...extra });
    officer.id = `response-${this.deployed}`;
    if (unit === RIOT) officer.guard = (direction, kind, knockback) => this.shieldGuard(officer, direction, kind, knockback);
    this.enemies.prepare(officer, wake);
    return officer;
  }

  // The riot shield soaks a hit from the front while it is up: true if it did (CombatArena.damage).
  shieldGuard(officer, direction, kind, knockback) {
    if (officer.shieldDown > 0 || officer.lifted || officer.dazed > 0 || (kind !== 'punch' && kind !== 'ram' && kind !== 'laser')) return false;
    // Front: pushed back against the way it faces. From above: driven down.
    if (direction.x * (officer.facing ?? -1) > -0.3 || direction.y > 0.6) return false;
    if (kind === 'laser') return true;
    officer.shieldDown = SHIELD.down;
    officer.vx += direction.x * knockback * SHIELD.soak;
    officer.stagger = Math.max(officer.stagger ?? 0, SHIELD.stagger);
    return true;
  }

  // Sends patrol cars and, from Police level 2, six-officer vans while officers are short.
  stepResponse(dt) {
    if (!this.evilMode || this.inMilitaryBase() || this.heat < 1 || (this.response -= dt) > 0) return;
    const target = this.director.officerTarget;
    const standing = this.combat.enemies.filter(o => o.enemyType === 'police' && o.health > 0).length;
    const cars = this.responseCars('police');
    const vans = this.responseCars('policevan');
    const incoming = cars.filter(car => !car.deployed).length * RESPONSE_VEHICLES.police.crew
      + vans.filter(car => !car.deployed).length * RESPONSE_VEHICLES.policevan.crew;
    this.response = RESPONSE.retry;
    if (standing + incoming >= target) return;
    // Parked cars remain punchable scenery; they must not permanently block replacement officers.
    // Vans and cars take turns. A van still on its way counts against the van target, parked
    // ones do not, so vans keep coming all fight long.
    const carFree = cars.length < this.director.carTarget;
    const vanDue = vans.filter(car => !car.deployed).length < this.director.policeVanTarget
      && target - standing - incoming >= 4 && !(this.lastPoliceVan && carFree);
    const van = vanDue && this.sendCar('policevan');
    const sent = van || (carFree && this.sendCar()) || this.sendFootSquad('police');
    if (sent) this.lastPoliceVan = van;
    if (sent) this.response = RESPONSE.every * this.director.arrivalScale;
  }

  // Heat 2: a SWAT van while the troopers are short, alongside the police response.
  stepVans(dt) {
    if (!this.evilMode || this.inMilitaryBase() || this.heat < 2 || (this.vanTimer -= dt) > 0) return;
    const standing = this.combat.enemies.filter(o => ['swat', 'riot'].includes(o.enemyType) && o.health > 0).length;
    const vans = this.responseCars('swat');
    const incoming = vans.filter(car => !car.deployed).length * VANS.team;
    this.vanTimer = standing + incoming < this.director.swatTarget
      && ((vans.filter(car => !car.deployed).length < this.director.swatVans && this.sendCar('swat')) || this.sendFootSquad('swat'))
      ? this.director.swatVanEvery * this.director.arrivalScale : VANS.retry;
  }

  // Heat 3: an armoured truck, one at a time. Heat 4: APCs while soldiers are short, and a tank,
  // one at a time.
  stepTrucks(dt) {
    if (!this.evilMode || this.inMilitaryBase()) return;
    const busy = kind => this.responseCars(kind).length;
    if (this.heat >= 3 && this.director.allows('swat') && (this.truckTimer -= dt) <= 0) {
      this.truckTimer = !busy('armoured') && this.sendVehicle('armoured') ? TRUCKS.every : TRUCKS.retry;
    }
    if (this.heat >= 4 && (this.apcTimer -= dt) <= 0) {
      const standing = this.combat.enemies.filter(o => o.enemyType === SOLDIER.enemyType && o.health > 0).length;
      const incoming = this.responseCars('apc').filter(car => !car.deployed).length * APCS.team;
      this.apcTimer = standing + incoming < this.director.soldierTarget
        && ((busy('apc') < this.director.apcMax && this.sendVehicle('apc')) || this.sendFootSquad('apc'))
        ? this.director.apcEvery * this.director.arrivalScale : APCS.retry;
    }
    if (this.heat >= 4 && (this.tankTimer -= dt) <= 0) {
      this.tankTimer = busy('tank') < this.director.tankMax && this.sendVehicle('tank') ? TANKS.every * this.director.arrivalScale : TANKS.retry;
    }
  }

  // An armoured truck, APC or tank drives in with its roof gun. False off every town's road.
  sendVehicle(kind) {
    if (!this.sendCar(kind)) return false;
    const life = this.dispatchLife;
    const gun = { armoured: TRUCK_GUN, apc: AUTOCANNON, tank: TANK_GUN }[kind];
    this.mountGun(this.addUnit(gun, this.position.x, this.position.y, 1, { rider: life.cars.at(-1), riderLife: life }));
    return true;
  }

  // Keeps a roof gun on its vehicle's roof; it is lost with it (wrecked, launched, lifted).
  mountGun(gun) {
    const truck = gun.rider;
    const life = gun.riderLife ?? this.cityLife;
    if (!life.cars.includes(truck) || truck.wreck || truck.fall) {
      Object.assign(gun, { health: 0, detonated: true });
      return;
    }
    const box = life.box(truck, this.streetAt);
    Object.assign(gun, { x: box.x, y: box.y - box.height / 2 - 2, homeX: box.x, homeY: box.y });
  }

  // A police car (or kind 'swat': a SWAT van) races in from off screen on a random side, along
  // whichever town's road the stop is on; false off every road.
  sendCar(kind = 'police') {
    if (this.inMilitaryBase()) return false;
    const spec = RESPONSE_VEHICLES[kind];
    const seats = (spec?.crew ?? 0) + (spec?.mounted ? 1 : 0);
    if (!this.canRespond(seats)) return false;
    const side = Math.random() < 0.5 ? -1 : 1;
    const [near, far] = RESPONSE.stop;
    const from = this.offscreen(side);
    const to = this.position.x + side * (near + Math.random() * (far - near));
    if (this.inMilitaryBase(to) || this.inMilitaryBase(from)) return false;
    // Never onto open water: the sea's life spans no road a car can stop on.
    if (isWater(wrapX(to))) return false;
    this.dispatchLife = (this.lives ?? [this.cityLife]).find(life => life.dispatch?.(from, to, kind));
    if (this.dispatchLife) this.director.dispatched();
    return !!this.dispatchLife;
  }

  // Live (not wrecked or falling) response vehicles of a kind, across every town's road.
  responseCars(kind) {
    const cars = [];
    for (const life of this.lives ?? [this.cityLife]) {
      for (const car of life.cars ?? []) if (car.kind === kind && car.dispatch !== undefined && !car.wreck && !car.fall) cars.push(car);
    }
    return cars;
  }

  canRespond(seats = 1) { return this.devSpawning || this.director.canDispatch(this, seats); }

  inMilitaryBase(x = this.position?.x) {
    const at = wrapX(x);
    return at >= EMBER_BASE_ZONE.from && at <= EMBER_BASE_ZONE.to;
  }

  // Away from Green City's traffic, squads approach on foot from dry land beyond the view.
  // Open water stays an aerial encounter; never materialize people on the sea surface.
  sendFootSquad(kind) {
    const count = { police: 3, swat: 4, apc: 6 }[kind];
    if (!count || isWater(wrapX(this.position.x)) || !this.canRespond(count)) return false;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = this.offscreen(side);
    for (let i = 0; i < count; i++) if (isWater(wrapX(x + side * i * 12))) return false;
    for (let i = 0; i < count; i++) {
      const at = x + side * i * 12;
      const unit = kind === 'apc' ? SOLDIER : kind === 'swat' ? (i === 0 ? RIOT : TROOPER) : OFFICER;
      this.addUnit(unit, at, this.terrainAt(at) - unit.radius, 0.5 + i * 0.15, { spread: i * 20 });
    }
    this.director.dispatched();
    return true;
  }

  // Build a visible flight of up to three helicopters, with prompt replacement after losses.
  stepHeli(dt) {
    if (!this.evilMode || this.inMilitaryBase()) return;
    const flight = this.airLife.crafts.filter(c => HELIS[c.kind] && !c.down && !c.lost && !c.gone);
    const limit = this.director.heliTarget;
    // The Police phase flies only police helicopters, so it may send all of its flight as them.
    const perKind = this.heat < HELIS.policeheli.heat ? limit : 1;
    for (const [kind, spec] of Object.entries(HELIS)) {
      if (this.heat < spec.heat && !(kind === 'policeheli' && limit > 0)) continue;
      if (kind === 'policeheli' && this.director.noPolice) continue;
      if (!this.director.allows({ policeheli: 'police', gunheli: 'swat', attackheli: 'armyAir' }[kind])) continue;
      this.heliTimers[kind] -= dt;
      if (flight.length >= limit || flight.filter(c => c.kind === kind).length >= perKind || this.heliTimers[kind] > 0) continue;
      if (this.sendHeli(kind) === false) this.heliTimers[kind] = 0.5;
      else { this.heliTimers[kind] = HELI.every; flight.push(this.airLife.crafts.at(-1)); }
    }
  }

  // The flying helicopter of that kind, if any.
  flyingHeli(kind) {
    return this.airLife.crafts.find(craft => craft.kind === kind && !craft.down && !craft.lost && !craft.gone);
  }

  // Flies in from past the view's edge with its door gunner aboard.
  sendHeli(kind, sniper = false) {
    if (this.inMilitaryBase()) return false;
    if (!this.canRespond(2)) return false;
    this.director.dispatched();
    const craft = this.airLife.spawn(this.offscreen(-1), this.offscreen(1), kind);
    craft.response = true;
    craft.formation = Object.keys(HELIS).indexOf(kind);
    craft.y = this.position.y - HELI.rise;
    // A strafer's first run already ends past the hero; the others hold on the side they came from.
    craft.side = HELIS[kind].strafe ? -craft.dir : craft.dir;
    if (HELIS[kind].light) craft.light = { x: this.position.x, y: this.position.y };
    const snipers = this.combat.enemies.filter(e => e.enemyType === 'police-heli-sniper' && e.health > 0 && e.rider).length;
    const policeSniper = kind === 'policeheli' && (sniper || this.director.phase === 1 && this.director.stars >= 3
      && snipers < (this.director.stars >= LEVELS ? 2 : 1));
    const unit = policeSniper ? { ...GUNNER, enemyType: 'police-heli-sniper', maxHealth: 60 } : HELIS[kind].gunner;
    const gunner = this.addUnit(unit, craft.x, craft.y, 1, { rider: craft });
    this.flyHeli(craft, gunner, 0);
  }

  // Ordnance in flight (this.ordnance): grenades arc and bounce, then blow on their fuse; shells and
  // rockets fly straight and blow on the hero, masonry, the ground, or at the end of their life.
  stepOrdnance(dt) {
    const hand = this.rig.punch.canHit ? this.lastPunchSample : null;
    for (const shot of this.ordnance) {
      if (!shot.age) sound.launch(shot.kind);
      shot.age += dt;
      if (shot.kind === 'missile') this.steerMissile(shot, hand, dt);
      shot.vy += (shot.gravity ?? 0) * dt;
      const x = shot.x;
      const y = shot.y;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (this.policeEncounter?.reflectedHit(shot, x, y)) continue;
      const ground = this.groundAt(shot.x);
      const onHero = Math.hypot(this.position.x - shot.x, this.position.y - shot.y) < HERO_DAMAGE.radius + 2;
      if (shot.kind === 'grenade') {
        if (shot.y >= ground - 1) {
          shot.y = ground - 1;
          shot.vy = Math.abs(shot.vy) > 40 ? -shot.vy * 0.3 : 0;
          shot.vx *= 0.5;
        }
        // Off a wall it bounces back, and lies against it.
        if (this.destruction?.solidAt(shot.x, shot.y)) {
          shot.x = x;
          shot.vx *= -0.3;
        }
        if (onHero || shot.age >= shot.fuse) this.explode(shot);
      } else if (shot.reflected && this.airLife.strike(shot, shot, 4, 2, shot.vx * 0.1)) {
        this.explode(shot);
      } else if ((onHero && !shot.reflected) || shot.y >= ground || shot.age > shot.life
        // Buildings stop a shot only once it has missed the hero (moving away from it), or was punched back.
        // A lobbed shell (gravity) is only live against buildings on its way down.
        || ((shot.reflected || ((this.position.x - shot.x) * shot.vx + (this.position.y - shot.y) * shot.vy < 0
          && !(shot.gravity && shot.vy < 0))) && this.destruction?.solidAt(shot.x, shot.y, 1))) {
        this.explode(shot);
      }
    }
    this.ordnance = this.ordnance.filter(shot => !shot.done);
  }

  // A blast where the shot is: it carves and knocks what is near (FreeRoam.streetBlast), and hurts the
  // hero inside its radius.
  explode(shot) {
    shot.done = true;
    this.streetBlast(shot.x, shot.power, shot.y, shot.radius);
    if (!shot.reflected && Math.hypot(this.position.x - shot.x, this.position.y - shot.y) <= shot.radius + HERO_DAMAGE.radius) this.enemies.damageHero(shot.damage);
    this.enemies.impacts.push({ x: shot.x, y: shot.y, age: 0, kind: 'explosion', duration: 0.45, radius: shot.radius });
    sound.blast(shot.power);
  }

  // Ordnance damage at the current difficulty.
  hurt(damage) { return damage * DIFFICULTY[this.enemies.difficulty].power; }

  // A missile homes on the hero, turning at MISSILE.turn rad/s. A punch landing on it sends it back
  // along the punch, faster, and it no longer homes.
  steerMissile(shot, hand, dt) {
    if (shot.reflected) return;
    if (hand && Math.hypot(hand.x - shot.x, hand.y - shot.y) < MISSILE.punch) {
      const speed = Math.hypot(shot.vx, shot.vy) * MISSILE.reflect;
      const angle = this.rig.punch.angle;
      Object.assign(shot, { reflected: true, age: 0, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
      sound.punchImpact();
      return;
    }
    const heading = Math.atan2(shot.vy, shot.vx);
    let turn = Math.atan2(this.position.y - shot.y, this.position.x - shot.x) - heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const turnRate = shot.turn ?? MISSILE.turn;
    const angle = heading + Math.max(-turnRate * dt, Math.min(turnRate * dt, turn));
    shot.vx = Math.cos(angle) * (shot.speed ?? MISSILE.speed);
    shot.vy = Math.sin(angle) * (shot.speed ?? MISSILE.speed);
  }

  // Jets (JETS): each kind one at a time, while the heat has it.
  stepJets(dt) {
    if (!this.evilMode) return;
    const spotted = this.combat.enemies.some(o => o.enemyType === RECON.enemyType && o.health > 0);
    for (const [kind, spec] of Object.entries(JETS)) {
      if (this.heat < spec.heat || this.flyingHeli(kind) || !this.director.allows(kind === 'vtol' ? 'vtol' : 'armyAir')) continue;
      if ((this.jetTimers[kind] -= dt * (kind === 'strikejet' && spotted ? 2 : 1)) > 0) continue;
      this.jetTimers[kind] = this.sendJet(kind) === false ? 1.5 : spec.every;
    }
    for (const craft of this.airLife.crafts) {
      if (!craft.steered || craft.down || craft.held || craft.gone) continue;
      craft.scale = this.heroSize();
      if (this.enemies.retreat) this.leave(craft, dt);
      else if (craft.kind === 'fighter') this.flyFighter(craft, dt);
      else if (craft.kind === 'vtol') this.flyVtol(craft, dt);
      else this.flyStrike(craft, dt);
    }
  }

  // A jet flies in from past the view's edge.
  sendJet(kind) {
    if (this.inMilitaryBase()) return false;
    if (!this.canRespond()) return false;
    this.director.dispatched();
    const craft = this.airLife.spawn(this.offscreen(-1), this.offscreen(1), kind);
    craft.response = true;
    craft.gunPhase = (++this.gunDeployments * 0.61803398875) % 1;
    craft.gunRestPace = 0.9 + craft.gunPhase * 0.2;
    const ground = this.terrainAt(this.position.x);
    Object.assign(craft, { steered: true, vy: 0, scale: this.heroSize() });
    if (kind === 'fighter') {
      Object.assign(craft, { y: Math.min(this.position.y - FIGHTER.above, ground - FIGHTER.low), missiles: 2,
        gun: Math.PI / 2, gunTime: 0, round: 0 });
      this.newPass(craft);
    } else if (kind === 'vtol') {
      Object.assign(craft, { y: Math.min(ground - VTOL.low, this.position.y - VTOL.rise), vx: craft.dir * VTOL.speed,
        nozzle: 0, gun: Math.PI / 2, gunTime: 0, round: 0 });
    } else {
      Object.assign(craft, { y: Math.min(ground - STRIKE.rise, this.position.y - STRIKE.above), missiles: STRIKE.salvo,
        vx: craft.dir * STRIKE.speed });
    }
  }

  // A VTOL jet: in fast, braking into a hover at its station beside the hero, nozzles swinging
  // down; it holds there, level, facing the hero, its belly gun swivelling after the hero. It only
  // moves to a new station once the hero is out of its gun's reach, so it never shadows the hero.
  flyVtol(craft, dt) {
    const station = craft.station;
    if (!station || Math.hypot(this.position.x - craft.x, this.position.y - craft.y) > VTOL.range) {
      const side = Math.sign(craft.x - this.position.x) || 1;
      craft.station = { side,
        x: this.position.x + side * VTOL.beside, y: this.position.y - VTOL.rise };
    }
    const { x: tx, side } = craft.station;
    const ty = Math.min(craft.station.y, this.terrainAt(craft.x) - VTOL.low);
    craft.vx = this.approach(craft.vx, tx - craft.x, VTOL.speed, VTOL.accel, dt);
    craft.vy = this.approach(craft.vy, ty - craft.y, VTOL.speed / 3, VTOL.accel / 2, dt);
    const slow = 1 - Math.min(1, Math.abs(craft.vx) / (VTOL.speed * 0.6));
    craft.nozzle += (slow - craft.nozzle) * (1 - Math.exp(-4 * dt));
    if (slow > 0.6) craft.dir = -side;
    else if (Math.abs(craft.vx) > 1) craft.dir = Math.sign(craft.vx);
    this.swivelGun(craft, dt, craft.nozzle >= 0.6);
  }

  // A velocity toward a point `gap` px off: at most `max`, slow enough to brake in time, and
  // changed by at most `accel` px/s² so the craft has weight.
  approach(v, gap, max, accel, dt) {
    const want = Math.sign(gap) * Math.min(max, Math.abs(gap) * VTOL.ease, Math.sqrt(2 * accel * Math.abs(gap)));
    return v + Math.max(-accel * dt, Math.min(accel * dt, want - v));
  }

  // The belly machine gun (VTOL_GUN), pivoted 1 m along and 1.1 m down as drawn (air-life.js
  // swivelGun): it swivels after the hero at a limited rate (craft.gun, a world angle) and, while
  // `firing`, runs its glow-burst-rest cycle.
  swivelGun(craft, dt, firing) {
    const gun = craft.kind === 'fighter' ? FIGHTER_GUN : VTOL_GUN;
    const metre = HELI_METRE * craft.scale;
    const pod = { x: craft.x + craft.dir * metre, y: craft.y + 1.1 * metre };
    const want = Math.atan2(this.position.y - pod.y, this.position.x - pod.x);
    let turn = want - craft.gun;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    craft.gun += Math.max(-gun.turn * dt, Math.min(gun.turn * dt, turn));
    craft.gunCharge = 0;
    if (!firing) return;
    const pace = DIFFICULTY[this.enemies.difficulty].pace;
    if (craft.gunFireDuration == null) this.planGunCycle(craft, gun);
    craft.gunTime += dt;
    const end = gun.warn * pace + craft.gunFireDuration * (craft.kind === 'fighter' ? pace : 1);
    const reload = Math.max(gun.reloadFloor * (1 + craft.gunReloadPace - 0.75), craft.gunReloadDuration * pace);
    if (craft.gunTime >= end + reload) {
      craft.gunTime -= end + reload;
      craft.round = 0;
      this.planGunCycle(craft, gun);
      // Begin the new warning on the next step; never fire a stale magazine on wraparound.
      return;
    }
    if (craft.gunTime >= end) { craft.round = 0; return; }
    if (craft.gunTime < gun.warn * pace) {
      craft.gunCharge = craft.gunTime / (gun.warn * pace);
      return;
    }
    if ((craft.round -= dt) > 0) return;
    craft.round += gun.gap;
    craft.muzzle = craft.phase;
    const barrel = 1.4 * metre;
    this.ordnance.push({ kind: 'round', type: craft.kind, x: pod.x + Math.cos(craft.gun) * barrel, y: pod.y + Math.sin(craft.gun) * barrel,
      vx: Math.cos(craft.gun) * gun.speed, vy: Math.sin(craft.gun) * gun.speed, age: 0, life: gun.life, length: gun.length,
      radius: gun.radius, power: gun.power, damage: this.hurt(gun.damage) });
  }

  planGunCycle(craft, gun) {
    craft.gunCycle = (craft.gunCycle ?? 0) + 1;
    const phase = ((craft.gunPhase ?? 0) + craft.gunCycle * 0.61803398875) % 1;
    craft.gunFireDuration = gun.duration + (phase - 0.5) * gun.variation;
    craft.gunReloadPace = 0.75 + ((phase + 0.37) % 1) * 0.5;
    craft.gunReloadDuration = gun.off * (craft.gunRestPace ?? 1) * craft.gunReloadPace;
  }

  // A strike jet's one pass at a steady speed: it locks on as it comes into view and fires its
  // salvo.
  flyStrike(craft, dt) {
    const ahead = (this.position.x - craft.x) * craft.dir;
    craft.vx = craft.dir * STRIKE.speed;
    if (craft.salvo > 0) {
      if ((craft.salvoTimer -= dt) > 0) return;
      craft.salvo--;
      craft.salvoTimer = STRIKE.gap;
      this.fireMissile(craft);
      return;
    }
    if (craft.missiles > 0 && this.lockOn(craft, dt, ahead)) Object.assign(craft, { salvo: craft.missiles, salvoTimer: 0 });
  }

  // While the jet is in view: a lock tone, the seeker blinking (craft.lock), and true once the
  // lock is made. Out of view, the lock drops.
  lockOn(craft, dt, ahead) {
    const camera = this.cameras.main;
    if (Math.abs(ahead) >= camera.width / camera.zoom / 2 - MISSILE.edge) {
      craft.lock = 0;
      return false;
    }
    if (!craft.lock) sound.lockTone();
    craft.lock = (craft.lock ?? 0) + dt;
    if (craft.lock < MISSILE.lock * DIFFICULTY[this.enemies.difficulty].pace) return false;
    craft.lock = 0;
    return true;
  }

  // A heat-seeking missile leaves the rail straight at the hero, then homes (steerMissile).
  fireMissile(craft) {
    craft.missiles--;
    const y = craft.y + 6;
    const far = Math.hypot(this.position.x - craft.x, this.position.y - y) || 1;
    this.ordnance.push({ kind: 'missile', x: craft.x, y,
      vx: (this.position.x - craft.x) / far * MISSILE.speed, vy: (this.position.y - y) / far * MISSILE.speed, age: 0,
      life: MISSILE.life, radius: MISSILE.radius, power: MISSILE.power, damage: this.hurt(MISSILE.damage) });
  }

  // A fighter's pass: fast out wide, slow by the hero, high over the hero (never too low). Past
  // the view's edge it turns for the next pass. Its gun swivels after the hero while it is in
  // view; its missile fires once a pass.
  flyFighter(craft, dt) {
    const ahead = (this.position.x - craft.x) * craft.dir;
    const camera = this.cameras.main;
    const view = camera.width / camera.zoom / 2;
    if (-ahead > view + FIGHTER.turn) {
      craft.dir = -craft.dir;
      craft.vx = craft.dir * FIGHTER.slow;
      this.newPass(craft);
      // Out of view, it takes the new pass's height at once, so every pass in view is level.
      Object.assign(craft, { y: craft.passY, vy: 0, angle: 0 });
      return;
    }
    const want = Math.abs(ahead) < FIGHTER.near ? FIGHTER.slow : FIGHTER.dash;
    craft.vx += (craft.dir * want - craft.vx) * (1 - Math.exp(-FIGHTER.ease * dt));
    const ty = Math.min(craft.passY ?? craft.y, this.terrainAt(craft.x) - FIGHTER.low);
    const climb = Math.max(-FIGHTER.maxClimb, Math.min(FIGHTER.maxClimb, (ty - craft.y) * FIGHTER.climb));
    craft.vy += (climb - craft.vy) * (1 - Math.exp(-FIGHTER.climb * dt));
    this.swivelGun(craft, dt, Math.abs(ahead) < view);
    if (craft.missiles > 0 && !craft.launched && this.lockOn(craft, dt, ahead)) {
      craft.launched = true;
      this.fireMissile(craft);
    }
  }

  // A new pass at a height set now, over the hero as it is: it holds that line through the pass.
  newPass(craft) {
    const passY = Math.min(this.position.y - FIGHTER.above, this.terrainAt(this.position.x) - FIGHTER.low);
    Object.assign(craft, { launched: false, lock: 0, passY });
  }

  // Rhino's rear doors: a riot shield and two troopers jump out behind it.
  deploySquad(truck) {
    for (let i = 0; i < 3; i++) {
      const unit = i === 0 ? RIOT : TROOPER;
      const x = truck.x - truck.facing * (ENEMY_RULES.rhino.halfLength + 8 + i * 14);
      this.addUnit(unit, x, this.terrainAt(x) - unit.radius, 0.3 + i * 0.15, { squadOf: truck.id, spread: i * 20 });
    }
  }

  // A shell from the tank's gun, along its locked aim (EnemySystem.onOrdnance).
  fireShell(gun, rule) {
    const muzzle = tankMuzzle(gun);
    if (gun.emplacement) {
      const scale = (this.heroSize?.() ?? 1) * BASE.scale;
      muzzle.x = gun.x + (muzzle.x - gun.x) * scale;
      muzzle.y = gun.y + 3 + (muzzle.y - gun.y - 3) * scale;
    }
    gun.muzzleFlash = 0.08;
    const speed = gun.emplacement ? BASE.shellSpeed : SHELL.speed;
    this.ordnance.push({ kind: 'shell', x: muzzle.x, y: muzzle.y,
      vx: gun.aim.x * speed, vy: gun.aim.y * speed, age: 0, life: SHELL.life,
      radius: SHELL.radius, power: SHELL.power, damage: rule.damage });
  }

  // A soldier lobs a grenade onto where the hero is, when its clock is up and the hero is in throw.
  throwGrenade(soldier, dt) {
    if ((soldier.grenade = (soldier.grenade ?? GRENADE.every * (0.4 + Math.random())) - dt) > 0) return;
    const dx = this.position.x - soldier.x;
    const dy = this.position.y - soldier.y;
    const far = Math.hypot(dx, dy);
    if (soldier.health <= 0 || soldier.carried || soldier.dazed > 0 || far < GRENADE.near || far > GRENADE.far
      || !['approach', 'recover'].includes(soldier.state)) return;
    soldier.grenade = GRENADE.every;
    soldier.thrown = this.elapsed;
    const t = GRENADE.flight;
    this.ordnance.push({ kind: 'grenade', x: soldier.x, y: soldier.y - 6, vx: dx / t, vy: dy / t - GRENADE.gravity * t / 2,
      gravity: GRENADE.gravity, age: 0, fuse: GRENADE.fuse, radius: GRENADE.radius, power: GRENADE.power, damage: this.hurt(GRENADE.damage) });
  }

  // The attack chopper's rocket pod: it glows through the charge, then fires its salvo.
  stepRockets(craft, dt) {
    const pod = this.heliPoint(craft, 1.25, 1);
    const far = Math.hypot(this.position.x - pod.x, this.position.y - pod.y);
    if (craft.salvo > 0) {
      if ((craft.salvoTimer -= dt) > 0) return;
      craft.salvo--;
      craft.salvoTimer = ROCKETS.gap;
      const angle = Math.atan2(this.position.y - pod.y, this.position.x - pod.x) + (Math.random() - 0.5) * 2 * ROCKETS.spread;
      this.ordnance.push({ kind: 'rocket', x: pod.x, y: pod.y, vx: Math.cos(angle) * ROCKETS.speed, vy: Math.sin(angle) * ROCKETS.speed,
        age: 0, life: ROCKETS.life, radius: ROCKETS.radius, power: ROCKETS.power, damage: this.hurt(ROCKETS.damage) });
      return;
    }
    craft.rockets = (craft.rockets ?? ROCKETS.every) - dt;
    craft.charge = far <= ROCKETS.range ? Math.max(0, 1 - craft.rockets / ROCKETS.charge) : 0;
    if (craft.rockets > 0) return;
    craft.rockets = ROCKETS.every;
    craft.charge = 0;
    if (far <= ROCKETS.range) Object.assign(craft, { salvo: ROCKETS.count, salvoTimer: 0 });
  }

  // Holds the helicopter over the hero, off to the side it came from, facing the hero (a strafing
  // one flies past and back, nose first), and keeps its gunner in the door (on the skid) and the
  // searchlight on the hero.
  flyHeli(craft, gunner, dt) {
    const strafe = HELIS[craft.kind].strafe;
    if (this.enemies.retreat && !craft.held) this.leave(craft, dt);
    else if (!craft.held) {
      // A strafing run ends `strafe` px past the hero; then it turns for the next.
      if (strafe && Math.abs(this.position.x - craft.side * strafe - craft.x) < 20) craft.side *= -1;
      const tx = this.position.x - craft.side * ((strafe ?? HELIS[craft.kind].beside ?? HELI.beside) + (craft.formation ?? 0) * 35);
      const ty = Math.min(this.position.y - ((HELIS[craft.kind].rise ?? HELI.rise) + (craft.formation ?? 0) * 25), this.terrainAt(craft.x) - HELI.low);
      const speed = craft.spec.speed[1];
      // AirLife moves it by vx and holds it in its hover (spot under it).
      craft.vx = Math.max(-speed, Math.min(speed, (tx - craft.x) * HELI.ease));
      craft.y += Math.max(-speed, Math.min(speed, (ty - craft.y) * HELI.ease)) * dt;
      craft.spot = craft.x;
      craft.hover = 1;
      if (strafe) craft.dir = -craft.side;
      else if (Math.abs(this.position.x - craft.x) > 8) craft.dir = Math.sign(this.position.x - craft.x);
    }
    // Drawn at the hero's size (heroSize, times the kind's size), so the gunner's door scales with it.
    craft.scale = this.heroSize() * (HELIS[craft.kind].size ?? 1);
    craft.stretch = HELIS[craft.kind].stretch;
    // The gunner is drawn by the helicopter's art (air-life.js crewman); here it is placed at the
    // shoulder, where the shots come from, and its pose handed over.
    const shoulder = this.heliPoint(craft, ...(HELIS[craft.kind].gun ?? [1.4, -0.2]));
    Object.assign(gunner, { x: shoulder.x, y: shoulder.y, homeX: shoulder.x, homeY: shoulder.y });
    craft.crew = { aim: gunner.aim, aiming: ['aim', 'locked', 'burst'].includes(gunner.state),
      firing: gunner.state === 'burst' && gunner.stateTime < 0.06, flash: gunner.flash > 0,
      swat: gunner.enemyType === 'heli-rifle', sniper: gunner.enemyType === 'police-heli-sniper', skin: SKINS[gunner.lookSeed % SKINS.length] };
    if (!craft.light) return;
    const follow = 1 - Math.exp(-SPOT.follow * dt);
    craft.light.x += (this.position.x - craft.light.x) * follow;
    craft.light.y += (this.position.y - craft.light.y) * follow;
  }

  // World point on a helicopter as drawn (air-life.js: its bob, HELI_METRE and craft.scale), from
  // metres along its nose (x) and down (y) in its own art (helicopter(), policeCabin()).
  heliPoint(craft, x, y) {
    const metre = HELI_METRE * (craft.scale ?? 1);
    const bob = craft.held || craft.down ? 0 : Math.sin(craft.phase * 1.3) * 3;
    return { x: craft.x + craft.dir * metre * x, y: craft.y + bob + metre * (craft.stretch ?? 1) * y };
  }

  // Half the view's width plus a margin: past this from the hero, a fleeing enemy has left.
  viewReach() {
    const camera = this.cameras?.main;
    return (camera ? camera.width / camera.zoom / 2 : 800) + RESPONSE.offscreen + 60;
  }

  // The boss is down: an aircraft turns away from the hero and climbs out of view, then is gone.
  leave(craft, dt) {
    const away = Math.sign(craft.x - this.position.x) || craft.dir || 1;
    craft.dir = away;
    craft.vx = away * (craft.spec?.speed?.[1] ?? 200);
    craft.y -= 60 * dt;
    craft.spot = craft.x;
    if (Math.abs(craft.x - this.position.x) > this.viewReach()) craft.gone = true;
  }

  // World x just off screen on the given side of the hero.
  offscreen(side) {
    const camera = this.cameras.main;
    return this.position.x + side * (camera.width / camera.zoom / 2 + RESPONSE.offscreen);
  }

  // Sends a drone in from off screen, on a random side, while fewer than DRONES.max fly.
  stepDrones(dt) {
    if (!this.evilMode || this.heat < 1 || (this.droneTimer -= dt) > 0) return;
    this.droneTimer = RESPONSE.retry;
    if (this.combat.enemies.filter(o => o.enemyType === DRONE.enemyType && o.health > 0).length >= Math.min(DRONES.max, this.director?.droneTarget ?? this.heat * 2)) return;
    if (this.sendDrone(this.offscreen(Math.random() < 0.5 ? -1 : 1))) this.droneTimer = DRONES.every;
  }

  // Ember Base: while the hero is near, man every gun mount that is not knocked out, and send soldiers
  // out of the nearest barracks. The base fights at any heat: it is a military zone.
  stepBase(dt) {
    if (!this.evilMode) return;
    const hx = wrapX(this.position.x);
    if (hx < EMBER_BASE_ZONE.from - BASE.reach || hx > EMBER_BASE_ZONE.to + BASE.reach) return;
    this.baseDown ??= new Map();
    // Register losses before checking replacements; otherwise a destroyed gun is replaced in the
    // same frame, before holdEmplacement has had a chance to start its cooldown.
    for (const gun of this.combat.enemies) {
      if (gun.emplacement && gun.health <= 0 && !gun.downMarked) this.holdEmplacement(gun, dt);
    }
    for (const mount of EMBER_GUN_MOUNTS) {
      if ((this.baseDown.get(mount) ?? 0) > this.elapsed) continue;
      if (this.combat.enemies.some(o => o.emplacement === mount && !o.detonated && o.health > 0)) continue;
      const unit = mount.kind === 'tank' ? TANK_GUN : AUTOCANNON;
      const x = this.nearestCopy(mount.x);
      this.addUnit(unit, x, this.groundAt(x) + 3 - mount.height, 0.3, { emplacement: mount,
        baseWeapon: `base-${mount.kind === 'tank' ? 'cannon' : mount.kind}`,
        radius: unit.radius * BASE.scale, maxHealth: unit.maxHealth * BASE.health, health: unit.maxHealth * BASE.health });
    }
    if (!this.baseGarrison) {
      this.baseGarrison = true;
      for (let i = 0; i < 18; i++) {
        const x = this.nearestCopy(EMBER_BASE_ZONE.from + 100 + i * 120);
        this.addUnit(SOLDIER, x, this.terrainAt(x) - SOLDIER.radius, 0.3 + i * 0.06,
          { baseGuard: true, spread: i % 5 * 24 });
      }
    }
    if ((this.baseSoldiers = (this.baseSoldiers ?? 0) - dt) > 0) return;
    this.baseSoldiers = BASE.every;
    const guards = this.combat.enemies.filter(o => o.baseGuard && o.health > 0).length;
    if (guards >= BASE.soldiers) return;
    const door = this.nearestCopy(EMBER_BARRACKS.reduce((a, b) => Math.abs(b - hx) < Math.abs(a - hx) ? b : a));
    for (let i = 0; i < Math.min(BASE.squad, BASE.soldiers - guards); i++) {
      const x = door + (i - 1) * 18;
      this.addUnit(SOLDIER, x, this.terrainAt(x) - SOLDIER.radius, 0.3 + i * 0.12,
        { baseGuard: true, spread: (this.deployed % 5) * 24 });
    }
  }

  // The copy of a planet x nearest the hero, so base units stand where the hero sees the base.
  nearestCopy(x) {
    return x + Math.round((this.position.x - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
  }

  // An emplaced gun stays on its mount and its cannon turns onto the hero. Knocked out, its mount is
  // down for BASE.respawn s; if its building is smashed from under it, it goes with it.
  holdEmplacement(gun, dt) {
    const mount = gun.emplacement;
    gun.muzzleFlash = Math.max(0, (gun.muzzleFlash ?? 0) - dt);
    if (gun.health <= 0) {
      if (!gun.downMarked) this.baseDown.set(mount, this.elapsed + BASE.respawn);
      gun.downMarked = true;
      return;
    }
    const x = this.nearestCopy(mount.x);
    const y = this.groundAt(x) + 3 - mount.height;
    const supportX = this.nearestCopy(mount.supportX ?? mount.x);
    if (this.destruction && this.roofUnder(supportX, y + 4, 12) == null) {
      Object.assign(gun, { health: 0, detonated: true, downMarked: true });
      this.baseDown.set(mount, this.elapsed + BASE.respawn);
      return;
    }
    Object.assign(gun, { x, y, homeX: x, homeY: y });
    // Fixed artillery can depress onto the street from the roof as well as elevate into the sky.
    // Vehicle turret elevation/traverse limits leave a roof gun unable to aim down at the hero.
    // The shared AI aims these guns and freezes their direction for the final lock and shot.
  }

  // A rider's helicopter and its gunner go down together. A truck's roof gun is lost with the truck.
  stepRider(gunner) {
    if (gunner.riderLife && gunner.rider?.kind === 'policebike') {
      this.policeEncounter.stepBike(gunner);
      return;
    }
    if (MOUNTED.has(gunner.enemyType)) {
      this.mountGun(gunner);
      if (gunner.enemyType === TANK_GUN.enemyType) this.turnTurret(gunner, this.riderDt);
      return;
    }
    const craft = gunner.rider;
    // Gone with it: dropped from the sky when the view jumps (AirLife.step).
    if (craft.gone || !this.airLife.crafts.includes(craft)) {
      Object.assign(gunner, { health: 0, detonated: true });
      return;
    }
    // Shot out of the door: the helicopter goes down.
    if (gunner.health <= 0) this.airLife.hit(craft, Infinity);
    // Brought down or grabbed: the gunner falls out of the door, and fights on the street if the
    // fall leaves them alive (as a patrol officer or a trooper).
    if ((craft.down || craft.held) && HELIS[craft.kind].crewless) {
      craft.crew = null;
      Object.assign(gunner, { health: 0, detonated: true });
      return;
    }
    if (craft.down || craft.held) {
      craft.crew = null;
      Object.assign(gunner, { rider: null, enemyType: gunner.enemyType === 'heli-rifle' ? 'swat'
        : gunner.enemyType === 'police-heli-sniper' ? 'police-sniper' : 'police', grounded: true,
        lifted: 'falling', carried: true, doomed: false, fallSpeed: 0, drift: craft.vx * 0.5, angle: 0,
        tumble: (craft.dir || 1) * BODY.tumble / 2, state: 'idle' });
      return;
    }
    this.flyHeli(craft, gunner, this.riderDt);
    if (craft.kind === 'attackheli') this.stepRockets(craft, this.riderDt);
  }

  // The tank's turret turns onto the hero at TANKS.turn rad/s, and its aim is where the barrel
  // points, so the slow turn is the telegraph. Locked and firing, it holds.
  turnTurret(gun, dt) {
    gun.side ??= Math.sign(gun.aim.x) || -1;
    gun.elevation ??= 0;
    const dx = this.position.x - gun.x;
    const free = gun.state !== 'locked' && gun.state !== 'burst';
    if (gun.traverse > 0) {
      // Swinging round to face the other way: the windup waits for it.
      gun.traverse = Math.max(0, gun.traverse - dt / TANKS.traverse);
      if (gun.traverse === 0) gun.side = -gun.side;
      if (gun.state === 'aim') gun.stateTime = 0;
    } else if (free && dx * gun.side < -TANKS.behind) {
      gun.traverse = 1;
    } else if (free) {
      const want = Math.max(TANKS.elevation[0], Math.min(TANKS.elevation[1], Math.atan2(gun.y - this.position.y, Math.abs(dx))));
      gun.elevation += Math.max(-TANKS.turn * dt, Math.min(TANKS.turn * dt, want - gun.elevation));
    }
    // Mid-swing the turret is seen turning toward the viewer: its length (and the gun's) foreshortens.
    gun.swing = gun.traverse > 0 ? Math.cos(Math.PI * (1 - gun.traverse)) : 1;
    gun.aim = { x: gun.side * gun.swing * Math.cos(gun.elevation), y: -Math.sin(gun.elevation) };
  }

  // Heat 4: a recon drone, one at a time.
  stepRecon(dt) {
    if (!this.evilMode || this.inMilitaryBase() || this.heat < 4 || (this.reconTimer -= dt) > 0) return;
    this.reconTimer = RESPONSE.retry;
    if (this.combat.enemies.some(o => o.enemyType === RECON.enemyType && o.health > 0)) return;
    if (this.sendDrone(this.offscreen(Math.random() < 0.5 ? -1 : 1), RECON)) this.reconTimer = RECONS.every;
  }

  sendDrone(x, unit = DRONE) {
    if (!this.canRespond()) return false;
    this.director.dispatched();
    const occupied = new Set(this.combat.enemies.filter(o => o.enemyType === unit.enemyType && o.health > 0).map(o => o.responseSlot));
    let slot = 0;
    while (occupied.has(slot)) slot++;
    this.addUnit(unit, x, this.position.y - DRONES.rise - slot % 3 * 18, 0,
      { responseSlot: slot, spread: slot * 12 });
    return true;
  }

  stepSwarm(dt) {
    const packs = this.director.swarmPacks;
    if (!packs || (this.swarmTimer -= dt) > 0) return;
    const count = this.heat >= 5 ? 8 : 6;
    if (!this.director.canDispatch(this, count)) return;
    const flying = new Set(this.combat.enemies.filter(o => o.enemyType === 'swarm' && o.health > 0).map(o => o.swarmGroup)).size;
    if (flying >= packs) return;
    // Short of packs, the next follows close behind; with all up, the usual wait.
    this.swarmTimer = flying + 1 < packs ? 1.5 : this.director.swarmEvery || Math.max(16, 30 - this.heat * 2);
    this.director.dispatched();
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = this.offscreen(side);
    const group = `response-${this.deployed}`;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      this.addUnit({ radius: 6, maxHealth: 36, enemyType: 'swarm', customArt: true, laserDamageMultiplier: 3, laserHitPadding: 3 },
        x + Math.cos(angle) * 30, this.position.y - 50 + Math.sin(angle) * 30, 0.6, { swarmGroup: group, swarmSlot: i });
    }
  }

  // Police heat level 3 on posts police snipers, late SWAT its marksmen, up to sniperTarget: on
  // roofs near the hero (up to ROOF.max), the rest on the street at range.
  stepMarksmen(dt) {
    if (!this.evilMode || (this.marksmanTimer -= dt) > 0) return;
    this.marksmanTimer = RESPONSE.retry;
    const unit = this.director.phase === 1 ? POLICE_SNIPER : MARKSMAN;
    const up = this.combat.enemies.filter(o => o.enemyType === unit.enemyType && o.health > 0 && !o.rider).length;
    if (up >= this.director.sniperTarget) return;
    if (this.placeRoofOfficer(false, unit) || this.placeStreetSniper(unit)) this.marksmanTimer = ROOF.every;
  }

  // A sniper takes a spot on the street `near`–`far` px from the hero, off screen when it can, on dry land.
  placeStreetSniper(unit) {
    if (!this.canRespond()) return false;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = this.position.x + side * Math.min(ROOF.far, Math.max(ROOF.near, Math.abs(this.offscreen(side) - this.position.x)));
    if (isWater(wrapX(x))) return false;
    this.addUnit(unit, x, this.terrainAt(x) - unit.radius, 0.5, { spread: 0 });
    this.director.dispatched();
    return true;
  }

  // Puts an officer on a flat roof near the hero, off screen when one is, if fewer than ROOF.max are
  // up. True if one went up.
  // dev (the dev panel): any number, from right beside the hero out to twice as far, on screen when one is.
  // unit: who goes up (an officer, or at heat 3 a marksman).
  placeRoofOfficer(dev = false, unit = OFFICER) {
    const perched = this.combat.enemies.filter(o => o.perched && o.health > 0);
    if (!this.destruction || (!dev && perched.length >= ROOF.max) || !this.canRespond()) return false;
    const camera = this.cameras.main;
    const view = camera.width / camera.zoom / 2;
    const spots = [];
    for (const { prop, building } of this.destruction.bodies) {
      const distance = Math.abs(building.x - this.position.x);
      if (!prop || prop.health <= 0 || !building.roof || distance < (dev ? 0 : ROOF.near) || distance > ROOF.far * (dev ? 2 : 1)
        || perched.some(o => Math.abs(o.x - building.x) < building.width / 2)) continue;
      const top = this.roofUnder(building.x, prop.y - prop.height / 2, prop.height);
      if (top === null || this.terrainAt(building.x) - top < ROOF.high
        || [-ROOF.flat, ROOF.flat].some(dx => this.roofUnder(building.x + dx, top - 2, 4) === null)) continue;
      spots.push({ x: building.x, top, hidden: distance > view });
    }
    const hidden = spots.filter(spot => spot.hidden !== dev);
    const pool = hidden.length ? hidden : spots;
    if (!pool.length) return false;
    const { x, top } = pool[Math.floor(Math.random() * pool.length)];
    this.addUnit(unit, x, top - unit.radius, 0.5, { perched: true });
    this.director.dispatched();
    return true;
  }

  // The top of standing masonry at x within `depth` px below y, or null.
  roofUnder(x, y, depth) {
    for (let at = Math.round(y); at <= y + depth; at++) if (this.destruction.solidAt(x, at, 0.5)) return at;
    return null;
  }

  // A perched officer stands on the roof while there is roof under the feet, else falls from there.
  perch(officer) {
    const feet = officer.y + officer.radius;
    const top = this.destruction && this.roofUnder(officer.x, feet - 4, 6);
    if (top === null || top === undefined) {
      Object.assign(officer, { lifted: 'falling', carried: true, doomed: false, fallSpeed: Math.max(0, officer.vy),
        angle: 0, tumble: (Math.sign(officer.vx) || 1) * BODY.tumble / 2 });
      return;
    }
    officer.y = top - officer.radius;
    officer.vy = 0;
  }

  // Compact ordnance silhouettes at world positions; bullets retain readable screen dimensions.
  drawOrdnance(g, shot) {
    const speed = Math.hypot(shot.vx, shot.vy) || 1;
    const ux = shot.vx / speed;
    const uy = shot.vy / speed;
    if (shot.kind === 'grenade') {
      g.fillStyle(0x3c4530);
      g.fillRect(Math.round(shot.x) - 1, Math.round(shot.y) - 2, 3, 3);
      const left = shot.fuse - shot.age;
      if (Math.floor(shot.age * (left < 0.6 ? 16 : 6)) % 2) {
        g.fillStyle(0xff4a3a);
        g.fillRect(Math.round(shot.x), Math.round(shot.y) - 3, 1, 1);
      }
      return;
    }
    if (shot.kind === 'missile') {
      // A heat-seeking missile: a long white smoke trail, a bright motor, a white body with a red
      // seeker head and dark fins, outlined, so it reads against the sky.
      for (let i = 1; i <= 9; i++) {
        g.fillStyle(0xf2f2ee, 0.55 * (1 - i / 10));
        g.fillCircle(shot.x - ux * (5 + i * 5), shot.y - uy * (5 + i * 5), 1.5 + i * 0.7);
      }
      g.fillStyle(0xff8a3c);
      g.fillCircle(shot.x - ux * 6, shot.y - uy * 6, 2.6);
      g.fillStyle(0xffe08a);
      g.fillCircle(shot.x - ux * 6, shot.y - uy * 6, 1.4);
      g.lineStyle(4, 0x1c2018, 1);
      g.lineBetween(shot.x - ux * 6, shot.y - uy * 6, shot.x + ux * 5, shot.y + uy * 5);
      g.lineStyle(2, 0xf4f4f0, 1);
      g.lineBetween(shot.x - ux * 5, shot.y - uy * 5, shot.x + ux * 4, shot.y + uy * 4);
      g.lineStyle(4, 0x2c3340, 1);
      g.lineBetween(shot.x - ux * 5 - uy * 2, shot.y - uy * 5 + ux * 2, shot.x - ux * 5 + uy * 2, shot.y - uy * 5 - ux * 2);
      g.fillStyle(0xe0503c);
      g.fillCircle(shot.x + ux * 4, shot.y + uy * 4, 1.3);
      return;
    }
    if (shot.kind === 'round') {
      const fade = Math.max(0, Math.min(1, (shot.life - shot.age) / 0.15));
      drawGunRound(g, shot.x, shot.y, ux, uy, fade, shot.length ?? 10, enemyShotColor(shot.type ?? 'vtol'), bulletScreenZoom(this));
      return;
    }
    if (shot.kind === 'shell') {
      drawGunRound(g, shot.x, shot.y, ux, uy, 1, 12, enemyShotColor('tank-gun'), bulletScreenZoom(this));
      return;
    }
    for (let i = 1; i <= 5; i++) {
      g.fillStyle(0x8a8580, 0.35 * (1 - i / 6));
      g.fillCircle(shot.x - ux * i * 5, shot.y - uy * i * 5, 1 + i * 0.6);
    }
    g.fillStyle(0xffb84a);
    g.fillCircle(shot.x - ux * 3, shot.y - uy * 3, 1.5);
    g.lineStyle(2, 0x2c3322, 1);
    g.lineBetween(shot.x - ux * 2, shot.y - uy * 2, shot.x + ux * 3, shot.y + uy * 3);
  }

  // The searchlight: from the lamp under the nose, a soft cone (layers narrowing to a bright core)
  // widening to an oval pool on the hero, a glare at the lamp.
  drawSearchlight(g, craft) {
    const lamp = this.heliPoint(craft, 4.35, 1.9);
    const { x, y } = craft.light;
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    const length = Math.hypot(dx, dy) || 1;
    const size = craft.scale ?? 1;
    const radius = SPOT.radius * size;
    // Across the beam, unit length.
    const nx = -dy / length;
    const ny = dx / length;
    for (const [width, alpha] of SPOT.layers) {
      const r = radius * width;
      const start = 1.2 * size * width;
      g.fillStyle(0xfff4c8, alpha);
      g.fillTriangle(lamp.x + nx * start, lamp.y + ny * start, lamp.x - nx * start, lamp.y - ny * start, x - nx * r, y - ny * r);
      g.fillTriangle(lamp.x + nx * start, lamp.y + ny * start, x - nx * r, y - ny * r, x + nx * r, y + ny * r);
      g.fillEllipse(x, y, r * 2.2, r * 1.5);
    }
    g.fillStyle(0xfffbe6, 0.5);
    g.fillCircle(lamp.x, lamp.y, 2 * size);
  }

  // The marksman's laser line from the rifle's muzzle. Aiming, it rides the hero as drawn this
  // frame; locked, it holds the frozen aim (the shot's line), out to the hero's distance.
  drawSightLine(g, officer) {
    if (officer.health <= 0 || (officer.state !== 'aim' && officer.state !== 'locked')) return;
    const locked = officer.state === 'locked';
    const muzzle = { x: officer.x + officer.aim.x * 8, y: officer.y - 4 + officer.aim.y * 8 };
    const hero = this.rig.image;
    const length = Math.hypot(hero.x - muzzle.x, hero.y - muzzle.y);
    const to = locked ? { x: muzzle.x + officer.aim.x * length, y: muzzle.y + officer.aim.y * length } : hero;
    // A quiet, subpixel sight laser at any camera zoom: no dark outline or full-line strobe.
    const size = 1 / Math.max(0.05, bulletScreenZoom(this));
    g.lineStyle(0.75 * size, 0xff3b3b, locked ? 0.55 : 0.28);
    g.lineBetween(muzzle.x, muzzle.y, to.x, to.y);
    g.fillStyle(0xff3b3b, locked ? 0.7 : 0.4);
    g.fillCircle(to.x, to.y, 0.75 * size);
  }

  // Enemies are drawn at the hero's own size, which grows as the camera zooms out
  // (FreeRoam.updateCamera). Hit boxes stay life size, as the hero's does.
  heroSize() { return this.rig.size ?? 1; }

  // A throw's blast took out an enemy.
  onThrowKill() { if (this.evilMode && this.feats) this.feats.throwKills++; }

  // A person (civilian or people-sized unit: their bodies thud) was thrown.
  onThrow({ enemy }) { if (this.evilMode && this.feats && enemy.thud) this.feats.peopleThrown++; }

  // Slow motion while the boss falls (police-encounter.js SLOW_MO).
  get simSpeed() { return this.policeEncounter?.dying && !this.policeWon ? SLOW_MO.scale : 1; }

  liftSources() { return [...super.liftSources(), this.policeLift]; }

  // Hero mode is heat 0: no one comes. Evil mode (and R) starts the response over.
  setEvilMode(on) {
    super.setEvilMode(on);
    // Run feats the objectives read beside the chaos stats.
    this.feats = { throwKills: 0, peopleThrown: 0, gems: 0 };
    // A new run: bank the last one's totals and records.
    this.records?.commit();
    this.records?.start();
    this.recordBanner?.clear();
    this.enemies.reset();
    this.chaos.reset();
    this.gems?.reset();
    this.wireChaosStats();
    this.director.reset();
    if (this.level?.phase) this.director.startPhase(this.level.phase);
    this.director.manual = this.heatOverride ?? null;
    this.heat = this.director.level;
    for (const life of this.lives ?? [this.cityLife]) if (life.cars) life.cars = life.cars.filter(car => !SENT.includes(car.kind));
    this.airLife.crafts = this.airLife.crafts.filter(craft => !craft.response);
    this.ordnance = [];
    this.restartResponse();
  }

  recordDefeat(target) {
    this.policeEncounter?.onDefeat(target);
    if (DRONE_TYPES.has(target.enemyType) || target.enemyType === 'rhino' || target.enemyType === 'goliath') this.recordVehicleLoss(target, true, target.enemyType);
    else if (!MOUNTED.has(target.enemyType) && target.enemyType !== 'chin-gun' && target.enemyType) {
      this.recordCasualty(target.casualtyIdentity ?? target, casualtyKind(target.enemyType), target);
    }
  }

  recordVehicleLoss(vehicle, enemy, kind, occupants = []) {
    if (this.chaos.recordVehicle(vehicle, enemy, kind, occupants)) this.dropGem('vehicle', vehicle);
  }

  recordCasualty(person, kind, at = person) {
    if (this.chaos.recordPerson(person, kind) && kind !== 'civilians') this.dropGem('enemy', at);
  }

  // Villainium gems drop (by chance) where an enemy, vehicle or building was lost.
  // No y (a building): `lift` above the ground.
  dropGem(kind, { x, y } = {}, lift = 20) {
    if (!this.evilMode || !this.gems || !Number.isFinite(x)) return;
    x += Math.round((this.position.x - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
    this.gems.spawn(rollDrop(kind), x, Number.isFinite(y) ? y : this.groundAt(x) - lift);
  }

  wireChaosStats() {
    const onHeroHit = (target, kind) => this.combat.combo.hit(target, kind,
      Boolean(target.response || RESPONSE_VEHICLES[target.kind]));
    for (const life of this.lives ?? [this.cityLife]) {
      life.onHeroHit = onHeroHit;
      life.onDeploy = (x, car) => this.deployOfficers(x, car);
      life.onKill = person => this.recordCasualty(person, 'civilians');
      life.onWreck = car => {
        const enemy = SENT.includes(car.kind);
        const occupants = !car.deployed ? (car.occupants ?? []).map(person => ({ person,
          kind: car.kind === 'apc' ? 'soldiers' : car.kind === 'swat' ? 'swat' : 'police' })) : [];
        this.recordVehicleLoss(car, enemy, car.kind, occupants);
      };
      life.onBoatLost = boat => this.recordVehicleLoss(boat, false, boat.kind);
    }
    this.airLife.onHeroHit = onHeroHit;
    this.airLife.onDown = craft => {
      if (craft.kind !== 'geese') this.recordVehicleLoss(craft, !!craft.response, craft.kind);
    };
    if (this.destruction) {
      this.destruction.onDestroyed = body => {
        if (body.building.countsAsBuilding !== false && this.chaos.recordBuilding(body.building.id, body.grid.total)) {
          this.dropGem('building', { x: body.building.x }, 40);
        }
      };
      this.destruction.onShipLost = body => this.recordVehicleLoss(body.building.vehicle ?? body.building,
        false, body.building.vehicleKind ?? 'cruise-liner');
    }
  }

  restartResponse() {
    this.policeEncounter?.reset();
    this.gunDeployments = 0;
    this.baseDown = new Map();
    this.baseSoldiers = 0;
    this.baseGarrison = false;
    this.swarmTimer = 8;
    this.marksmanTimer = 4;
    this.response = RESPONSE.first;
    this.droneTimer = DRONES.first;
    this.vanTimer = VANS.first;
    this.truckTimer = TRUCKS.first;
    this.apcTimer = APCS.first;
    this.tankTimer = TANKS.first;
    this.reconTimer = RECONS.first;
    this.jetTimers = Object.fromEntries(Object.entries(JETS).map(([kind, spec]) => [kind, spec.first]));
    this.heliTimers = Object.fromEntries(Object.entries(HELIS).map(([kind, spec]) => [kind, spec.first]));
  }

  create() {
    const query = new URLSearchParams(window.location.search);
    // The level map greets every launch (with the dev panel under ?debug); region and encounter review
    // links (?x=, ?police=) go straight to Free Roam.
    this.levelMapOnLaunch = !query.has('x') && !query.has('police');
    this.deferTutorial = this.levelMapOnLaunch;
    super.create();
    const stage = document.querySelector('.stage-wrap') ?? document.body;
    this.policeEncounter.createHud(stage);
    this.records = new Records();
    this.recordBanner = new RecordBanner(stage);
    this.statsPanel = new StatsPanel(stage, CAMPAIGN, () => this.levelMap.show());
    this.winPanel = new WinPanel(stage, heading => this.showLevelMap(heading));
    this.levelMap = new LevelMap(stage, { onPick: level => this.afterBreak(() => this.startLevel(level)),
      onFreeRoam: () => this.afterBreak(() => this.startFreeRoam()),
      onStats: () => { this.levelMap.hide(); this.statsPanel.show(this.records.data); },
      onShop: () => { this.levelMap.hide(); this.shopPanel.show(); } });
    this.shopPanel = new ShopPanel(stage, () => this.levelMap.show());
    // Closing the tab mid-run still banks its totals.
    const bank = () => { if (document.visibilityState === 'hidden') this.records.commit(); };
    document.addEventListener('visibilitychange', bank);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', bank);
      this.records.commit();
      this.recordBanner.destroy();
      this.statsPanel.destroy();
      this.shopPanel.destroy();
      this.winPanel.destroy();
    });
    // The portal hears when play runs and stops (level map, pause, world map, defeat, victory).
    const syncPlaying = () => {
      const menu = Boolean(this.levelMapOpen || this.pauseMenu?.open || this.mapDialog?.open);
      sound.setMusicMenu(menu);
      poki.setPlaying(!menu && !this.enemies?.defeated && !this.policeWon && !this.controlsSuspended && this.scene.isActive());
    };
    this.game.events.on('poststep', syncPlaying);
    this.events.once('shutdown', () => { this.game.events.off('poststep', syncPlaying); sound.setMusicMenu(false); poki.setPlaying(false); });
    this.events.once('shutdown', () => this.levelMap?.destroy());
    if (this.levelMapOnLaunch) this.showLevelMap();
    this.responseHud = new HeatHud(document.getElementById('status-hud') ?? document.querySelector('.stage-wrap'));
    this.objectives = new Objectives(document.getElementById('tutorial'), document.getElementById('status-hud'));
    this.gems = new VillainiumGems(this.add.graphics().setDepth(11.5));
    this.events.once('shutdown', () => { this.responseHud?.remove(); this.policeEncounter?.destroy(); this.objectives?.destroy(); });
    if (query.has('debug') && query.has('police')) this.startPoliceTest(query.get('police'));
  }

  syncCombatHud() {
    super.syncCombatHud();
    if (!this.responseHud || !this.director) return;
    this.responseHud.sync(this.director, this.evilMode, this.policeEncounter?.bossName ?? '', this.combat.combo);
    if (this.evilMode && !this.policeWon && this.records) {
      const beaten = this.records.observe(this.chaos, this.combat.combo.count);
      for (const key of beaten ?? []) this.recordBanner.show(STATS.find(stat => stat.key === key), this.records.run[key]);
    }
    // Level 1 only: heat level 3 without finishing the tutorial skips it; heat level 5 after a skip
    // also hides the key guide.
    if (this.evilMode && this.level?.id === 1 && this.director.phase === 1) {
      const stars = this.director.stars;
      if (stars >= 3 && !this.tutorial.done) this.tutorial.complete();
      if (stars >= 5 && this.tutorial.skipped) this.tutorial.hideKeyGuide();
    }
    if (this.objectives && this.evilMode) {
      const phase = this.level?.phase ?? 0;
      const heat = this.director.phase === phase ? this.director.stars : this.director.phase > phase ? LEVELS : 0;
      this.objectives.step(this.chaos, { heat, combo: this.combat.combo.count, ...this.feats });
    }
    this.policeEncounter?.syncHud();
  }

  // The level map (campaign.js), as a modal: on launch, from the pause menu in a level, after a boss.
  // Mid-level the world pauses behind it.
  showLevelMap(heading) {
    this.levelMapOpen = true;
    this.handleControlBlur();
    this.input.keyboard.resetKeys();
    if (this.level && !this.policeWon && this.scene.isActive()) this.scene.pause();
    this.levelMap.show(heading);
  }

  hideLevelMap() {
    this.levelMapOpen = false;
    this.levelMap.hide();
    if (this.scene.isPaused()) this.scene.resume();
    this.handleControlFocus();
    this.game.canvas.focus({ preventScroll: true });
  }

  // Between levels (not before the first one this session) a midgame ad may play, then `start`.
  // While one is pending, further picks are ignored.
  afterBreak(start) {
    if (this.adPending) return;
    if (!this.playedLevel) { start(); return; }
    this.adPending = true;
    poki.midgame(() => { this.adPending = false; start(); });
  }

  // A campaign level: the hero at its city, evil mode at its heat phase, ending in its boss.
  startLevel(level) {
    this.playedLevel = true;
    this.level = level;
    this.spawnX = level.x;
    this.heatOverride = null;
    this.evilMode = true;
    this.hideLevelMap();
    this.setLiftSize(upgradeValue('grab'));
    this.resetCombat();
    this.tutorial.setObjective(level.objective);
    this.objectives?.start(level);
    if (this.deferTutorial) {
      this.deferTutorial = false;
      this.tutorial.start(this);
    }
  }

  startFreeRoam() {
    this.playedLevel = true;
    this.level = null;
    this.spawnX = CAMPAIGN[0].x;
    this.hideLevelMap();
    this.setLiftSize(upgradeValue('grab'));
    this.resetCombat();
    this.tutorial.setObjective('Free Roam: cause chaos, beat the Police');
    this.objectives?.start(null);
    if (this.deferTutorial) {
      this.deferTutorial = false;
      this.tutorial.start(this);
    }
  }

  // Dev panel: during a run, the boss (spawned if not out yet) falls to one blow, so the real
  // ending plays: slow motion, boss bar break, records and the win panel. With no run going (the
  // level map up), the next open level is cleared straight away.
  winLevel() {
    const encounter = this.policeEncounter;
    if (this.evilMode && !this.levelMapOpen && encounter && !this.policeWon) {
      if (!encounter.dying) {
        encounter.spawnBoss();
        const boss = encounter.boss;
        if (boss) this.combat.damage(boss, boss.health, { x: 1, y: 0 }, 0, 'punch');
      }
      return;
    }
    const level = this.level ?? CAMPAIGN.find(next => levelState(next) === 'open');
    if (!level) return;
    markCleared(level.id);
    if (this.levelMap) this.showLevelMap(BOSSES[level.phase]?.cleared ?? `${level.name} Defeated`);
  }

  // A boss fell and the slow motion ended: save the level and records, then the win panel.
  onBossCleared(heading) {
    this.objectives?.report({ boss: 1 });
    if (this.level) markCleared(this.level.id);
    if (!this.records) return;
    this.recordBanner.clear();
    this.winPanel.show(heading, this.records.win(this.level?.id ?? 'free'));
  }

  // Review links and the dev panel use the real automatic progression, not a second encounter.
  startPoliceTest(level) {
    if (!['1', '2', '3', '4', '5', 'boss', 'victory'].includes(String(level))) return;
    this.heatOverride = null;
    this.setEvilMode(true);
    this.director.manual = null;
    this.director.score = HEAT_PHASES[0].levels[level === 'boss' || level === 'victory' ? LEVELS : Number(level) - 1];
    this.chaos.points = this.chaos.heatPoints = this.director.score;
    this.chaos.revision++;
    this.director.chaosSeen = this.chaos.heat;
    this.heat = this.director.level;
    this.response = this.droneTimer = this.marksmanTimer = 0;
    if (this.heatSelect) this.heatSelect.value = 'auto';
    if (this.difficultySelect) this.difficultySelect.disabled = true;
    this.policeEncounter.step(0);
    if (level === 'victory') {
      const boss = this.policeEncounter.boss;
      this.combat.damage(boss, boss.health, { x: 1, y: 0 }, 0, 'punch');
      this.policeEncounter.won = true; // Explicit screen preview skips the live crash animation.
      this.policeEncounter.finish();
    }
    this.syncCombatHud();
  }

  // The enemy lab's dev panel also sets the heat level and spawns enemies beside the hero.
  createDevPanel() {
    super.createDevPanel();
    const objectives = document.createElement('button');
    objectives.type = 'button';
    objectives.textContent = 'Complete shown optional objectives';
    objectives.title = 'Marks the optional objectives on show done (no reward), so the next ones appear. Play a level first.';
    objectives.addEventListener('click', () => { this.objectives?.completeShown(); objectives.blur(); });
    const heat = document.createElement('label');
    heat.htmlFor = 'dev-heat';
    heat.textContent = 'Heat ';
    const level = document.createElement('select');
    level.id = 'dev-heat';
    this.heatSelect = level;
    level.append(new Option('Auto · destruction', 'auto', false, this.director.manual === null));
    level.append(...HEAT_LEVELS.map((name, n) => Object.assign(new Option(`${n} · ${name}`, n, false, n === this.director.manual),
      { disabled: n > HEAT_BUILT })));
    level.addEventListener('change', () => {
      // A new level starts its response over.
      this.heatOverride = level.value === 'auto' ? null : Number(level.value);
      this.director.manual = this.heatOverride;
      this.heat = this.director.level;
      this.difficultySelect.disabled = this.director.manual === null;
      this.restartResponse();
      level.blur();
    });
    heat.append(level);
    const difficulty = document.createElement('label');
    difficulty.htmlFor = 'dev-difficulty';
    difficulty.textContent = 'Difficulty ';
    const pace = document.createElement('select');
    pace.id = 'dev-difficulty';
    this.difficultySelect = pace;
    pace.disabled = this.director.manual === null;
    pace.title = 'Automatic heat sets difficulty. Choose a fixed heat level to set it yourself.';
    pace.append(...Object.entries(DIFFICULTY).map(([key, { label }]) =>
      new Option(label, key, false, key === this.enemies.difficulty)));
    pace.addEventListener('change', () => {
      this.enemies.setDifficulty(pace.value);
      pace.blur();
    });
    difficulty.append(pace);
    const enemy = document.createElement('label');
    enemy.htmlFor = 'dev-enemy';
    enemy.textContent = 'Enemy ';
    // Picking one spawns it; Go spawns another of the same, without picking again.
    const row = document.createElement('span');
    row.className = 'dev-spawn';
    const pick = document.createElement('select');
    pick.id = 'dev-enemy';
    pick.append(...Object.entries(ENEMY_SPAWNS).map(([name, what]) => new Option(name, what)));
    const go = document.createElement('button');
    go.type = 'button';
    go.textContent = 'Go';
    const spawn = control => {
      this.spawnEnemy(pick.value);
      control.blur();
    };
    pick.addEventListener('change', () => spawn(pick));
    go.addEventListener('click', () => spawn(go));
    row.append(pick, go);
    enemy.append(row);
    const unlimited = document.createElement('label');
    const keep = document.createElement('input');
    keep.type = 'checkbox';
    keep.id = 'dev-unlimited';
    keep.checked = this.enemies.unlimited;
    keep.addEventListener('change', () => {
      this.enemies.unlimited = keep.checked;
      if (keep.checked) this.enemies.hero.health = HERO_DAMAGE.maxHealth;
      keep.blur();
    });
    unlimited.append(keep, ' Unlimited health');
    const police = document.createElement('label');
    police.textContent = 'Police test ';
    const test = document.createElement('select');
    test.id = 'dev-police-test';
    test.setAttribute('aria-label', 'Police encounter test');
    test.append(new Option('Choose encounter…', ''), new Option('Police level 4', '4'),
      new Option('Police level 5', '5'), new Option('Bulwark boss', 'boss'), new Option('Victory screen preview', 'victory'));
    test.addEventListener('change', () => { this.startPoliceTest(test.value); test.value = ''; test.blur(); });
    police.append(test);
    // Win level: the boss falls to one blow and the real win plays (winLevel).
    const win = document.createElement('button');
    win.type = 'button';
    win.id = 'dev-win-level';
    win.textContent = 'Win level';
    win.addEventListener('click', () => { this.winLevel(); win.blur(); });
    this.devPanel.querySelector('.dev-panel-content').prepend(heat, police, difficulty, enemy, unlimited, win, objectives);
  }

  // Dev panel: an enemy beside the hero, whatever the heat. Police need evil mode (its destruction
  // gives the roofs; hero mode is heat 0).
  spawnEnemy(what) {
    if (!this.evilMode) this.setEvilMode(true);
    const previous = this.devSpawning;
    const wait = this.director.dispatchWait;
    this.devSpawning = true;
    try { return this.spawnRequestedEnemy(what); }
    finally { this.devSpawning = previous; this.director.dispatchWait = wait; }
  }

  // The tutorial's grab step: one patrol officer beside the hero, without turning the city evil.
  spawnTutorialTarget() {
    const previous = this.devSpawning;
    const wait = this.director.dispatchWait;
    this.devSpawning = true;
    try { this.spawnRequestedEnemy('officer'); }
    finally { this.devSpawning = previous; this.director.dispatchWait = wait; }
  }

  spawnRequestedEnemy(what) {
    const side = Math.random() < 0.5 ? -1 : 1;
    if (what === 'car') this.sendCar();
    else if (['pursuit', 'breacher', 'interceptor', 'marshal', 'boss', 'rhino', 'goliath'].includes(what)) this.policeEncounter.spawn(what, true);
    else if (what === 'sniperheli') this.sendHeli('policeheli', true);
    else if (what === 'van') this.sendCar('swat');
    else if (what === 'policevan') this.sendCar('policevan');
    else if (what === 'truck' || what === 'apc' || what === 'tank') this.sendVehicle(what === 'truck' ? 'armoured' : what);
    else if (what === 'recon') this.sendDrone(this.position.x + side * 60, RECON);
    else if (what in HELIS) this.sendHeli(what);
    else if (what in JETS) this.sendJet(what);
    else if (what === 'roof' || what === 'marksman' || what === 'police-sniper') {
      const unit = { roof: OFFICER, marksman: MARKSMAN, 'police-sniper': POLICE_SNIPER }[what];
      if (!this.placeRoofOfficer(true, unit) && what !== 'roof') this.placeStreetSniper(unit);
    }
    else if (what === 'drone') this.sendDrone(this.position.x + side * 60);
    else {
      const unit = { trooper: TROOPER, riot: RIOT, soldier: SOLDIER }[what] ?? OFFICER;
      const x = this.position.x + side * 60;
      this.addUnit(unit, x, this.terrainAt(x) - unit.radius, 0.4);
    }
  }

  // The nearest standing officer in reach, as the body EnemyThrow carries (see CityLife.liftable).
  liftableOfficer(hero, reach, size) {
    if (size < LIFT.person) return null;
    let best = null;
    let nearest = reach;
    for (const officer of this.combat.enemies) {
      if (officer.health <= 0 || officer.carried || officer.rider || officer.boss || officer.part) continue;
      const distance = Math.hypot(Math.max(0, Math.abs(hero.x - officer.x) - 3.5),
        Math.max(0, Math.abs(hero.y - officer.y) - OFFICER_HEIGHT / 2));
      if (distance > nearest) continue;
      nearest = distance;
      best = officer;
    }
    if (!best) return null;
    const officer = best;
    // Carried lying across the hands, so half its height is half its width.
    officer.body ??= {
      object: true, thud: true, soft: true, size: LIFT.person, radius: OFFICER_HEIGHT / 2, half: 3,
      width: 7, height: OFFICER_HEIGHT, maxHealth: BODY.maxHealth, spinRate: BODY.spinRate,
      grabbed: () => this.liftOfficer(officer),
      dropped: () => this.letGoOfficer(officer, false),
      burst: () => this.letGoOfficer(officer, true),
      // Thrown out of sight: gone for good.
      gone: () => Object.assign(officer, { lifted: null, carried: false, health: 0, detonated: true }),
    };
    // distance below any bystander's: an officer in reach is taken first, as bots are.
    Object.assign(officer.body, { x: officer.x, y: officer.y, distance: nearest - reach });
    return officer.body;
  }

  // Snatched off the street: out of the fight (carried) until they land, and the street panics.
  liftOfficer(officer) {
    // Off the roof for good: let go, they land on the street.
    Object.assign(officer, { perched: false, carried: true, lifted: 'held', state: 'grabbed', stagger: 0, vx: 0, vy: 0, dazed: 0,
      shieldDown: SHIELD.down });
    for (const life of this.lives) life.alarm?.(officer.x);
  }

  // Leaves the hands where the body is and falls from there, tumbling. Thrown (doomed), they die
  // where they land; let go, they lie dazed, then get up and fight on.
  letGoOfficer(officer, doomed) {
    if (officer.lifted !== 'held') return;
    // A drone out of the hands is wrecked: it drops like a stone.
    if (DRONE_TYPES.has(officer.enemyType)) doomed = true;
    const { body } = officer;
    Object.assign(officer, { lifted: 'falling', doomed, x: body.x, y: body.y, fallSpeed: 0,
      angle: (body.spin ?? 0) + Math.PI / 2, tumble: (Math.sign(body.spin ?? 0) || 1) * BODY.tumble });
  }

  step(dt) {
    if (this.policeWon) return;
    const before = this.elapsed;
    super.step(dt);
    // Only the time the world actually ran (none while paused or in hit-stop).
    dt = this.elapsed - before;
    if (!(dt > 0)) return;
    if (this.policeEncounter?.won) { this.policeEncounter.finish(); return; }
    if (!this.policeEncounter?.dying) this.records?.tick(dt);
    this.director.step(dt, this.chaos.heat);
    const collected = this.gems?.step(dt, this.position, this.heroSize(), x => this.groundAt(x));
    if (collected) {
      this.objectives.earn(collected);
      this.feats.gems += collected;
      sound.gem();
      if (this.feats.gems >= VILLAINIUM_TIP_AT && this.feats.gems - collected < VILLAINIUM_TIP_AT) this.tutorial?.villainiumTip(this);
    }
    this.chaos.multiplier = this.director.pointsMultiplier;
    if (this.director.manual === null) {
      const difficulty = this.director.difficulty;
      if (this.enemies.difficulty !== difficulty) {
        this.enemies.setDifficulty(difficulty);
        if (this.difficultySelect) this.difficultySelect.value = difficulty;
      }
    }
    this.heat = this.director.level;
    this.enemies.responseRecovery = this.director.recoveryScale;
    this.policeEncounter?.step(dt);
    if (!this.enemies.retreat) {
      this.stepSwarm(dt);
      this.stepMarksmen(dt);
      this.stepBase(dt);
    }
    this.stepResponse(dt);
    this.stepDrones(dt);
    this.stepVans(dt);
    this.stepTrucks(dt);
    this.stepHeli(dt);
    this.stepRecon(dt);
    this.stepJets(dt);
    this.stepOrdnance(dt);
    this.riderDt = dt;
    for (const officer of this.combat.enemies) {
      if (officer.emplacement) {
        if (!officer.detonated) this.holdEmplacement(officer, dt);
        continue;
      }
      if (officer.rider) {
        if (!officer.detonated) this.stepRider(officer);
        continue;
      }
      if (officer.shieldDown > 0) officer.shieldDown -= dt;
      if (officer.dazed > 0) {
        officer.dazed -= dt;
        // Back on their feet still shaken: the stagger runs on a little after they stand.
        if (officer.dazed <= 0) officer.stagger = 0.4;
      }
      if (officer.enemyType === SOLDIER.enemyType) this.throwGrenade(officer, dt);
      if (DRONE_TYPES.has(officer.enemyType)) {
        // Home is wherever the hero is, so a drone sent from off screen never turns back, and it
        // flies itself in until the hero is close enough for the AI to notice (enemy-system.js).
        officer.homeX = this.position.x;
        officer.homeY = this.position.y - (officer.enemyType === 'swarm' ? 0 : DRONES.rise);
        const dx = officer.homeX - officer.x;
        const dy = officer.homeY - officer.y;
        const far = Math.hypot(dx, dy);
        if (far > DRONES.notice && officer.health > 0 && !officer.lifted && !this.enemies.retreat) {
          const step = ENEMY_RULES[officer.enemyType].speed * DRONES.cruise * dt / far;
          officer.x += dx * step;
          officer.y += dy * step;
        }
        // Shot down: falls, spinning, and lies wrecked where it lands.
        if (officer.health <= 0 && !officer.wrecked && !officer.lifted) {
          Object.assign(officer, { wrecked: true, lifted: 'falling', carried: true, fallSpeed: Math.max(0, officer.vy), drift: officer.vx,
            angle: 0, tumble: (Math.sign(officer.vx) || 1) * BODY.tumble });
        }
      }
      if (officer.lifted === 'held') {
        // EnemyThrow moves the body, in the hands and in flight.
        officer.x = officer.body.x;
        officer.y = officer.body.y;
        officer.angle = (officer.body.spin ?? 0) + Math.PI / 2;
      } else if (officer.lifted === 'falling') this.fall(officer, dt);
      else if (officer.perched && !officer.detonated) this.perch(officer);
    }
    // Keep nearby bodies as aftermath; retire distant units and old corpses without touching held bodies.
    this.retireTimer = (this.retireTimer ?? 1) - dt;
    if (this.retireTimer <= 0) {
      this.retireTimer = 1;
      // Fleeing after the boss falls, units are gone once out of view.
      const reach = this.enemies.retreat ? this.viewReach() : 2200;
      const retired = new Set(this.combat.enemies.filter(o => !o.carried && !o.lifted
        && !(o.boss && o.health > 0) && ((o.health <= 0 && o.deathAge > 30) || Math.abs(o.x - this.position.x) > reach)));
      if (retired.size) {
        this.combat.enemies = this.combat.enemies.filter(o => !retired.has(o));
        this.combat.damageables = this.combat.damageables.filter(o => !retired.has(o));
      }
    }
  }

  // Falls to the street, or, off a roof, onto any masonry below. A hard landing kills.
  fall(officer, dt) {
    const feet = officer.y + officer.radius;
    officer.fallSpeed += BODY.gravity * dt;
    officer.y += officer.fallSpeed * dt;
    // drift: a shot-down drone carries the punch sideways as it falls.
    officer.x += (officer.drift ?? 0) * dt;
    officer.angle += officer.tumble * dt;
    const roof = officer.perched && this.destruction ? this.roofUnder(officer.x, feet, officer.fallSpeed * dt + 1) : null;
    const floor = (roof ?? this.groundAt(officer.x)) - officer.radius;
    if (officer.y < floor) return;
    Object.assign(officer, { y: floor, lifted: null, carried: false, angle: 0, vx: 0, vy: 0, perched: roof !== null,
      homeX: officer.x, homeY: floor, drift: officer.wrecked ? officer.drift : 0 });
    if (officer.eliteDeath && officer.health <= 0) {
      officer.deathLanded = true;
      officer.grounded = true;
      this.enemies.impacts.push({ x: officer.x, y: floor + officer.radius - 2, age: 0,
        kind: 'explosion', duration: officer.boss ? 0.4 : 0.2, radius: officer.boss ? 20 : 6 });
      sound.crunch(officer.boss ? 0.7 : 0.25);
      return;
    }
    if (officer.doomed || officer.fallSpeed > BODY.lethal) this.combat.damage(officer, officer.health, { x: 0, y: 1 }, 0, 'blast');
    else Object.assign(officer, { dazed: BODY.daze, stagger: BODY.daze + 0.4 });
  }

  update(time, delta) {
    super.update(time, delta);
    const g = this.policeGraphics;
    g.clear();
    // The police helicopter's searchlight: a pale cone from the nose to a pool that trails the hero.
    for (const craft of this.airLife.crafts) {
      if (!craft.light || craft.down || craft.gone || craft.held) continue;
      this.drawSearchlight(g, craft);
    }
    const size = this.heroSize();
    this.gems?.draw(size);
    for (const shot of this.ordnance) this.drawOrdnance(g, shot);
    for (const officer of this.combat.enemies) {
      if (officer.detonated) continue;
      if (officer.enemyType === MARKSMAN.enemyType || officer.enemyType === POLICE_SNIPER.enemyType
        || officer.enemyType === 'police-heli-sniper') this.drawSightLine(g, officer);
      const drone = DRONE_TYPES.has(officer.enemyType);
      const turret = MOUNTED.has(officer.enemyType);
      // A door gunner is drawn by its helicopter.
      if (officer.rider && !turret) continue;
      const elite = ELITE_TYPES.has(officer.enemyType) || officer.policeRider;
      const draw = () => (elite ? drawPoliceElite : turret ? drawTurret : drone ? drawDrone : drawOfficer)(g, officer, x => this.groundAt(x), this.elapsed);
      // Ember Base's emplaced guns are drawn bigger than the ones riding vehicles.
      const scale = officer.emplacement ? size * BASE.scale : size;
      if (scale === 1) {
        draw();
        continue;
      }
      // Scaled about the feet (the street, the roof, the skid), or the body's centre in the air.
      const ground = this.groundAt(officer.x);
      const py = elite ? officer.y : turret ? officer.y + 3 : drone ? (officer.health <= 0 && !officer.lifted ? ground : officer.y)
        : officer.lifted ? officer.y : Math.min(officer.y + officer.radius, ground);
      g.save();
      g.translateCanvas(officer.x, py);
      g.scaleCanvas(scale, scale);
      g.translateCanvas(-officer.x, -py);
      draw();
      g.restore();
    }
  }
};
