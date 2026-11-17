// Run totals: the chaos score weights each loss in points, multiplied by the heat phase
// (multiplier). The heat follows the score; titles come from the heat (EnemyDirector.title).
export const MAX_CHAOS = 1_000_000_000;
export const PERSON_POINTS = Object.freeze({
  civilians: 1000, police: 2500, swat: 5000, soldiers: 10_000, otherEnemies: 10_000 });
// Unlisted vehicles score VEHICLE_POINTS.default.
export const VEHICLE_POINTS = Object.freeze({
  default: 10_000, sedan: 5000, hatch: 5000, taxi: 5000, bus: 10_000,
  police: 25_000, policevan: 25_000, policebike: 10_000, swat: 25_000, armoured: 50_000, apc: 50_000, tank: 100_000, rhino: 500_000, goliath: 1_000_000,
  'police-drone': 5000, recon: 5000, swarm: 2500,
  policeheli: 50_000, newsheli: 50_000, tourheli: 50_000, gunheli: 75_000, attackheli: 100_000,
  prop: 50_000, jet: 250_000, jumbo: 500_000, beluga: 500_000, vtol: 150_000, fighter: 200_000, bomber: 300_000,
  dinghy: 2500, yacht: 25_000, trawler: 25_000, tug: 25_000, cutter: 25_000,
  freighter: 250_000, tanker: 250_000, 'cruise-liner': 1_000_000,
});
// Buildings score by their original masonry: a house ~10k, a street tower ~55k, a skyscraper the cap.
export const BUILDING_POINTS = Object.freeze({ perCell: 40, max: 100_000 });

// Heat weights each loss apart from the score: harming the city draws less heat than
// fighting its defenders. 1 is the chaos score's own weight.
export const HEAT_WEIGHT = Object.freeze({ city: 0.5, enemy: 1.2 });

const PEOPLE = ['civilians', 'police', 'swat', 'soldiers', 'otherEnemies'];

export class ChaosStats {
  constructor() { this.revision = 0; this.reset(); }

  reset() {
    this.buildings = 0;
    for (const kind of PEOPLE) this[kind] = 0;
    this.civilianVehicles = Object.create(null);
    this.enemyVehicles = Object.create(null);
    this.vehicles = 0;
    this.buildingIds = new Set();
    // Entities may despawn; keeping a full run of corpses alive would waste memory.
    this.peopleSeen = new WeakSet();
    this.vehiclesSeen = new WeakSet();
    this.points = 0;
    this.heatPoints = 0;
    this.multiplier = this.multiplier ?? 1;
    this.revision++;
  }

  get score() { return Math.min(MAX_CHAOS, Math.round(this.points)); }
  // Heat chaos: what the EnemyDirector reads.
  get heat() { return Math.min(MAX_CHAOS, Math.round(this.heatPoints)); }
  add(points, heatWeight = 1) {
    this.points += points * this.multiplier;
    this.heatPoints += points * this.multiplier * heatWeight;
  }

  get count() {
    return this.buildings + this.vehicles + this.civilians + this.police
      + this.swat + this.soldiers + this.otherEnemies;
  }

  recordBuilding(id, cells = 0) {
    if (id === undefined || id === null || this.buildingIds.has(id)) return false;
    this.buildingIds.add(id);
    this.buildings++;
    this.add(Math.min(BUILDING_POINTS.max, cells * BUILDING_POINTS.perCell), HEAT_WEIGHT.city);
    this.revision++;
    return true;
  }

  recordPerson(person, kind = 'civilians') {
    if (!PEOPLE.includes(kind)) throw new Error(`Unknown casualty category: ${kind}`);
    if (this.peopleSeen.has(person)) return false;
    this.peopleSeen.add(person);
    this[kind]++;
    this.add(PERSON_POINTS[kind], kind === 'civilians' ? HEAT_WEIGHT.city : HEAT_WEIGHT.enemy);
    this.revision++;
    return true;
  }

  // Occupants are the people still aboard at destruction, never already-deployed troops.
  // Caller supplies their entity references so later death hooks cannot count them again.
  recordVehicle(vehicle, enemy, kind, occupants = []) {
    if (this.vehiclesSeen.has(vehicle)) return false;
    this.vehiclesSeen.add(vehicle);
    const counts = enemy ? this.enemyVehicles : this.civilianVehicles;
    counts[kind] = (counts[kind] ?? 0) + 1;
    this.vehicles++;
    this.add(VEHICLE_POINTS[kind] ?? VEHICLE_POINTS.default, enemy ? HEAT_WEIGHT.enemy : HEAT_WEIGHT.city);
    for (const occupant of occupants) this.recordPerson(occupant.person, occupant.kind);
    this.revision++;
    return true;
  }
}

// Mounted weapons belong to their vehicle; callers exclude them before classifying crew.
export function casualtyKind(type) {
  if (['police', 'police-heli', 'police-sniper', 'police-heli-sniper', 'police-pursuit', 'police-breacher', 'police-rider'].includes(type)) return 'police';
  if (['swat', 'riot', 'sniper', 'heli-rifle'].includes(type)) return 'swat';
  if (type === 'soldier') return 'soldiers';
  return 'otherEnemies';
}
