import { RESPONSE_VEHICLES } from './response-vehicles.js';

// The heat chaos (ChaosStats.heat: chaos points weighted by HEAT_WEIGHT) sets the heat, with
// bounded arrivals and short reinforcement lulls. This clock advances only when the world runs,
// so menus and hit-stop cannot spend a lull.
export const RESPONSE_CAPS = Object.freeze([0, 52, 56, 64, 72, 80, 88]);
// Police has LEVELS heat levels, SWAT (campaign level 2) three: levels holds the chaos score that
// starts each heat level, then the phase's end. Heat stops at the end of the unlocked phase: beating that phase's boss is the
// only way on. titles: per heat level, earned on entry, at TITLE_AT[1] and TITLE_AT[2] of it.
// points multiplies new chaos. Phases after Police are placeholders until they are designed.
export const LEVELS = 5;
// Share of the usual reinforcement numbers that keeps coming during a boss fight.
export const BOSS_SHARE = 0.2;
export const TITLE_AT = Object.freeze([0, 0.4, 0.75]);
export const HEAT_PHASES = Object.freeze([
  { label: 'Police', levels: [1, 500_000, 1_000_000, 2_000_000, 3_500_000, 5_000_000], cap: [22, 52], points: 1,
    titles: [['Troublemaker', 'Vandal', 'Menace'], ['Wrecker', 'Public Enemy', 'Psycho'],
      ['Rampager', 'Supervillain', 'City Terror'], ['Most Wanted', 'Riot Starter', 'Destroyer'],
      ['Arch-villain', 'Doombringer', 'Police Nightmare']] },
  { label: 'SWAT', levels: [5_000_000, 10_000_000, 17_000_000, 25_000_000], cap: [56, 64], points: 3,
    titles: [['Hard Target', 'Breach Bait', 'Lockdown'], ['Tactical Threat', 'Siege Maker', 'Code Black'],
      ['SWAT Magnet', 'Riot Lord', 'Rhino Bait']] },
  { label: 'Army', levels: [25_000_000, 40_000_000, 55_000_000, 70_000_000, 85_000_000, 100_000_000], cap: [66, 72], points: 10,
    titles: [['Hostile', 'Warzone', 'Martial Law'], ['Air Target', 'Strafe Bait', 'No-Fly Zone'],
      ['Air Superior', 'Total War', 'Shock and Awe'], ['Joint Threat', 'All Forces', 'Iron Fist'],
      ['Public Enemy One', 'Nation\'s Nightmare', 'Goliath Bait']] },
  { label: 'Full arsenal', levels: [100_000_000, 140_000_000, 180_000_000, 220_000_000, 260_000_000, 300_000_000], cap: [74, 80], points: 30 },
  { label: 'Countermeasures', levels: [300_000_000, 440_000_000, 580_000_000, 720_000_000, 860_000_000, 1_000_000_000], cap: [82, 88], points: 100 },
]);
// Heat credits new chaos from a budget that refills at one phase per this many seconds, so
// no play fills a phase faster. Its burst lets a kill streak or a toppled skyscraper (dozens
// crushed at once) land at once without counting as a whole level.
export const FASTEST_PHASE_SECONDS = 60;
export const CHAOS_BURST = 100_000; // chaos points beyond the budget earn no heat
const MANUAL_PHASE = [0, 1, 2, 2, 3, 4, 5];
const span = spec => spec.levels.at(-1) - spec.levels[0];
// Heat levels in a phase (1-based phase).
export const levelCount = phase => (HEAT_PHASES[phase - 1]?.levels.length ?? LEVELS + 1) - 1;

export class EnemyDirector {
  constructor() { this.reset(); }

  reset() {
    this.score = 0;
    this.chaosSeen = 0;
    // One second of refill: enough to call the Police; a full burst would undercut the floor.
    this.budget = span(HEAT_PHASES[0]) / FASTEST_PHASE_SECONDS;
    this.time = 0;
    this.dispatchWait = 0;
    this.manual = null;
    this.unlockedPhase = 1;
    this.waiting = false;
  }

  // A campaign level starts calm at its phase's first heat level: the first chaos calls the response.
  startPhase(phase) {
    this.unlockedPhase = phase;
    this.score = HEAT_PHASES[phase - 1].levels[0];
    this.budget = span(HEAT_PHASES[phase - 1]) / FASTEST_PHASE_SECONDS;
    this.waiting = phase > 1;
  }

  get levels() { return levelCount(Math.max(1, this.waiting ? this.unlockedPhase : this.phase)); }

  get heatCeiling() { return HEAT_PHASES[this.unlockedPhase - 1].levels.at(-1); }
  // Top heat level full at the gate: the phase boss is due (manual heat never calls one).
  get bossDue() { return this.manual === null && this.score >= this.heatCeiling; }

  get phase() {
    if (this.manual !== null) return MANUAL_PHASE[this.manual] ?? 0;
    if (this.waiting) return 0;
    let phase = 0;
    while (phase < this.unlockedPhase && this.score >= HEAT_PHASES[phase].levels[0]) phase++;
    return phase;
  }

  // The heat level within the phase, 1 to its level count.
  get stars() {
    if (!this.phase) return 0;
    const count = levelCount(this.phase);
    if (this.manual !== null) return count;
    const { levels } = HEAT_PHASES[this.phase - 1];
    let star = 1;
    while (star < count && this.score >= levels[star]) star++;
    return star;
  }

  // Progress through the current heat level, 0 to 1.
  get fill() {
    if (!this.phase) return 0;
    if (this.manual !== null) return 1;
    const { levels } = HEAT_PHASES[this.phase - 1];
    const star = this.stars;
    return Math.min(1, Math.max(0, (this.score - levels[star - 1]) / (levels[star] - levels[star - 1])));
  }

  get title() {
    const titles = HEAT_PHASES[this.phase - 1]?.titles?.[this.stars - 1];
    if (!titles) return this.phaseLabel;
    let index = 0;
    while (index < TITLE_AT.length - 1 && this.fill >= TITLE_AT[index + 1]) index++;
    return titles[index];
  }

  get pointsMultiplier() { return HEAT_PHASES[this.phase - 1]?.points ?? 1; }
  get phaseLabel() { return HEAT_PHASES[this.phase - 1]?.label ?? 'Calm'; }
  // Existing content gates remain roster levels: all of Police is roster 1. Late SWAT (3-5) is 3.
  get level() {
    if (this.manual !== null) return this.manual;
    // The SWAT level fields the full SWAT roster (trucks, gunship, marksmen, drone packs) from the start.
    // The Army level unlocks the whole army roster; allows() holds parts of it back by heat level.
    return this.phase === 2 ? 3 : this.phase === 3 ? 6 : this.phase > 3 ? this.phase + 1 : this.phase;
  }

  // The Army level (campaign level 3) adds forces by heat level: 1 army ground forces only, 2 the
  // attack chopper and jets, 3 the VTOL, 4 SWAT joins, 5 Police joins. Every other phase allows all.
  allows(group) {
    if (this.phase !== 3) return true;
    return this.stars >= { armyAir: 2, vtol: 3, swat: 4, police: 5 }[group];
  }

  get cap() {
    if (this.manual !== null) return RESPONSE_CAPS[this.manual];
    const spec = HEAT_PHASES[this.phase - 1];
    return spec ? Math.round(spec.cap[0] + (spec.cap[1] - spec.cap[0]) * (this.stars - 1) / (levelCount(this.phase) - 1))
      + (this.bossDue ? 1 : 0) : 0;
  }

  // Police heat level 1 ramps from its first arrivals to the full patrol; levels 2 and 3 add
  // helicopters, snipers and melee drones; levels 4 and 5 also introduce specialist police units.
  // Later phases keep the full Police numbers.
  get policeRamp() { return this.phase === 1 && this.stars === 1 ? this.fill : 1; }
  get policeExtra() { return this.phase === 1 ? Math.max(0, this.stars - 3) : 0; }
  // The SWAT level opens SWAT only; from its heat level 2 a thin police presence joins the mix.
  get swatOnly() { return this.phase === 2 && this.stars < 2; }
  // No police at all: the SWAT level's opening, the Army level before its heat level 5.
  get noPolice() { return this.swatOnly || !this.allows('police'); }
  // The SWAT and Army levels keep police thin.
  get thinPolice() { return this.phase === 2 || this.phase === 3; }
  get officerTarget() { return this.noPolice ? 0 : this.thinPolice ? 8 : this.phase > 1 ? 18 : Math.round(3 + 7 * this.policeRamp) + 4 * this.policeExtra; }
  get carTarget() { return this.noPolice ? 0 : this.thinPolice ? 2 : this.phase > 1 ? 5 : 1 + Math.round(2 * this.policeRamp) + this.policeExtra; }
  // Police vans en route at once: from level 2, one more per level.
  get policeVanTarget() { return this.noPolice ? 0 : this.thinPolice ? 1 : this.phase > 1 ? 2 : this.stars < 2 ? 0 : this.stars - 1; }
  // Interceptor bikes on the road at once: from level 2, one more per level.
  get bikeTarget() { return this.phase === 1 && this.stars >= 2 ? this.stars - 1 : 0; }
  get droneTarget() { return this.noPolice ? 0 : this.thinPolice ? 8 : this.phase > 1 ? 14 : Math.round(3 + 7 * this.policeRamp) + 2 * this.policeExtra; }
  get heliTarget() {
    if (this.swatOnly) return 1; // the SWAT gunship only (enemy-response.js stepHeli)
    // Army: the attack chopper from heat level 2, SWAT's gunship at 4, a police helicopter at 5.
    if (this.phase === 3) return ['armyAir', 'swat', 'police'].filter(group => this.allows(group)).length;
    if (this.phase > 1) return Math.min(3, Math.max(1, this.level - 1));
    return this.stars < 2 ? 0 : this.stars === 2 ? 1 + Math.round(2 * this.fill) : this.stars < 5 ? 3 : 4;
  }
  // Marksmen and melee drone packs: Police heat level 3 on, and late SWAT on.
  get eliteSupport() { return this.allows('swat') && (this.level >= 3 || (this.phase === 1 && this.stars >= 3)); }
  get sniperTarget() { return !this.eliteSupport ? 0 : this.phase === 1 ? this.stars - 1 : 2; }
  // Police levels 4 and 5 raise the difficulty (DIFFICULTY in enemy-system.js); roster 4+ is hard.
  get difficulty() {
    if (this.phase === 1) return this.stars >= 5 ? 'brutal' : this.stars >= 4 ? 'hard' : 'normal';
    if (this.phase === 2) return this.stars >= 3 ? 'hard' : 'normal';
    if (this.phase === 3) return this.stars >= 5 ? 'brutal' : 'hard';
    return this.level >= 4 ? 'hard' : 'normal';
  }
  get swatTarget() { return !this.allows('swat') ? 0 : this.phase === 3 ? 8 : this.phase > 2 ? 12 : this.phase === 2 ? 14 + (this.stars - 1) * 3 : 4 + (this.stars - 1) * 2; }
  // SWAT vans on the road at once, and seconds between them: the SWAT level runs a heavier convoy.
  get swatVans() { return this.phase === 2 ? 4 : 2; }
  get swatVanEvery() { return this.phase === 2 ? 3 : 6; }
  // The Army level opens strong (it is not a tutorial) and grows each heat level.
  get soldierTarget() { return this.phase > 3 ? 18 : this.phase === 3 ? 24 + (this.stars - 1) * 3 : 6 + (this.stars - 1) * 3; }
  get apcEvery() { return this.phase === 3 ? 6 : 20; }
  // Army vehicles on the road at once: the Army level runs a heavy column.
  get apcMax() { return this.phase === 3 ? 4 : 2; }
  get tankMax() { return this.phase === 3 ? 2 : 1; }
  // Hunter drone packs flying at once, and seconds between them: the Army level fields them from its
  // first heat level, two packs at a time; elsewhere one, with elite support.
  get swarmPacks() { return this.phase === 3 ? 2 : this.eliteSupport ? 1 : 0; }
  get swarmEvery() { return this.phase === 3 ? 8 : 0; }
  // Only recovery scales here: lock time, burst aim, knockback and player controls stay intact.
  get recoveryScale() {
    let before = 0;
    for (let p = 1; p < Math.max(1, this.phase); p++) before += levelCount(p);
    return Math.max(0.65, 1 - (before + Math.max(0, this.stars - 1)) * 0.014);
  }
  get arrivalScale() { return this.recoveryScale; }

  get lull() { return this.level > 0 && this.time % 36 >= 33; }

  // Heat never cools. The first chaos calls the Police at once.
  step(dt, chaos = 0) {
    this.time += dt;
    this.dispatchWait = Math.max(0, this.dispatchWait - dt);
    const spec = HEAT_PHASES[Math.max(1, this.waiting ? this.unlockedPhase : this.phase) - 1];
    this.budget = Math.min(CHAOS_BURST * spec.points, this.budget + dt * span(spec) / FASTEST_PHASE_SECONDS);
    const take = Math.min(Math.max(0, chaos - this.chaosSeen), this.budget);
    this.chaosSeen = Math.max(this.chaosSeen, chaos);
    this.budget -= take;
    if (take > 0) this.waiting = false;
    // The meter shows credited chaos directly: still chaos, still heat. Heat stops at the gate.
    this.score = Math.min(this.heatCeiling, this.score + take);
  }

  population(scene) {
    let count = 0;
    for (const unit of scene.combat.enemies) if (unit.health > 0) count++;
    // Reserve seats before a van arrives, otherwise several vans can exceed the cap together.
    for (const life of scene.lives ?? [scene.cityLife]) for (const car of life.cars ?? []) {
      if (!car.deployed && !car.wreck && !car.fall && car.dispatch !== undefined) count += RESPONSE_VEHICLES[car.kind]?.crew ?? 0;
    }
    for (const craft of scene.airLife.crafts) {
      if (craft.steered && !craft.down && !craft.gone && !craft.held) count++;
    }
    return count;
  }

  // During the boss fight reinforcements keep coming at BOSS_SHARE of the usual numbers (the boss
  // holds its own reserved seat).
  canDispatch(scene, seats = 1) {
    const cap = scene.policeEncounter?.boss ? Math.ceil((this.cap - 1) * BOSS_SHARE) + 1 : this.cap;
    return scene.evilMode && !scene.enemies.defeated && this.level > 0 && !this.lull
      && !scene.policeWon && !scene.enemies.retreat && this.dispatchWait <= 0 && this.population(scene) + seats <= cap;
  }

  dispatched() { this.dispatchWait = Math.max(0.35, (1.2 - this.level * 0.15) * this.arrivalScale); }
}
