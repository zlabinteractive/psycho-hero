// Level sub-objectives and Villainium, the in-game currency (spent in the shop later).
// Each objective pays its reward once, ever; completion is saved per level. Villainium also
// drops by chance as gems when the hero defeats enemies and wrecks buildings and vehicles:
// they fall, hover near the ground, and are collected by flying through them (VillainiumGems).
import { save } from './save.js';

const WALLET_KEY = 'tiny-hero-villainium';
const DONE_KEY = 'tiny-hero-objectives-done';

// Tuning knobs: chance a loss drops Villainium, and how much.
export const DROPS = Object.freeze({
  enemy: { chance: 0.3, amount: 1 },
  vehicle: { chance: 0.4, amount: 2 },
  building: { chance: 0.5, amount: 3 },
});

// stat: what the scene reports (Objectives.step). optional: a side objective; the rest lead to the boss.
// The HUD shows every main objective and the first OPTIONAL_SHOWN optional ones not yet done, in order.
// An optional one only counts from when it comes on show; LIVE stats (the combo) count as they stand.
const LIVE = new Set(['combo']);
export const OPTIONAL_SHOWN = 5;
const main = (heats, boss) => [
  ...Array.from({ length: heats }, (_, i) => ({ id: `heat${i + 1}`, text: `Reach heat level ${i + 1}`, stat: 'heat', goal: i + 1, reward: (i + 1) * 10 })),
  { id: 'boss', text: `Defeat ${boss}`, stat: 'boss', goal: 1, reward: 100 },
];
const side = list => list.map(([id, text, stat, goal, reward]) => ({ id, text, stat, goal, reward, optional: true }));
export const LEVEL_OBJECTIVES = Object.freeze({
  1: [...main(5, 'Bulwark'), ...side([
    ['combo25', 'Reach a x25 combo', 'combo', 25, 50],
    ['drones25', 'Destroy 25 drones', 'drones', 25, 50],
    ['police50', 'Defeat 50 police officers', 'police', 50, 50],
    ['helis25', 'Destroy 25 helicopters', 'helis', 25, 75],
    ['civcars50', 'Destroy 50 civilian cars', 'civCars', 50, 50],
    ['buses10', 'Destroy 10 buses', 'buses', 10, 50],
    ['thrown10', 'Throw 10 people', 'peopleThrown', 10, 50],
    ['buildings25', 'Destroy 25 buildings', 'buildings', 25, 75],
    ['policecars15', 'Wreck 15 police cars or vans', 'policeCars', 15, 60],
    ['bikes5', 'Wreck 5 police interceptors', 'bikes', 5, 60],
    ['throwkills20', 'Defeat 20 enemies with throws', 'throwKills', 20, 75],
    ['combo50', 'Reach a x50 combo', 'combo', 50, 100],
    ['civilians100', 'Claim 100 civilian casualties', 'civilians', 100, 50],
    ['gems500', 'Collect 500 Villainium from drops', 'gems', 500, 100],
    ['chaos7m', 'Reach 7.5M chaos', 'chaos', 7_500_000, 100],
  ])],
  2: [...main(4, 'Rhino'), ...side([
    ['swat50', 'Defeat 50 SWAT troopers', 'swat', 50, 75],
    ['swatvans10', 'Wreck 10 SWAT vans', 'swatVans', 10, 75],
    ['combo40', 'Reach a x40 combo', 'combo', 40, 75],
    ['helis15', 'Destroy 15 helicopters', 'helis', 15, 75],
    ['thrown25', 'Throw 25 people', 'peopleThrown', 25, 75],
    ['armoured5', 'Wreck 5 armoured trucks', 'armoured', 5, 100],
    ['drones30', 'Destroy 30 drones', 'drones', 30, 75],
    ['civcars75', 'Destroy 75 civilian cars', 'civCars', 75, 75],
    ['buses15', 'Destroy 15 buses', 'buses', 15, 75],
    ['buildings20', 'Destroy 20 buildings', 'buildings', 20, 75],
    ['throwkills40', 'Defeat 40 enemies with throws', 'throwKills', 40, 100],
    ['enemies150', 'Defeat 150 enemies', 'enemies', 150, 100],
    ['combo75', 'Reach a x75 combo', 'combo', 75, 150],
    ['gems100', 'Collect 100 Villainium from drops', 'gems', 100, 100],
    ['chaos40m', 'Reach 40M chaos', 'chaos', 40_000_000, 150],
  ])],
  3: [...main(6, 'Goliath'), ...side([
    ['soldiers60', 'Defeat 60 soldiers', 'soldiers', 60, 100],
    ['apcs10', 'Wreck 10 APCs', 'apcs', 10, 100],
    ['combo50', 'Reach a x50 combo', 'combo', 50, 100],
    ['tanks5', 'Destroy 5 tanks', 'tanks', 5, 125],
    ['helis20', 'Destroy 20 helicopters', 'helis', 20, 100],
    ['jets5', 'Shoot down 5 military jets', 'jets', 5, 150],
    ['thrown40', 'Throw 40 people', 'peopleThrown', 40, 100],
    ['drones40', 'Destroy 40 drones', 'drones', 40, 100],
    ['civcars100', 'Destroy 100 civilian cars', 'civCars', 100, 100],
    ['buildings30', 'Destroy 30 buildings', 'buildings', 30, 100],
    ['throwkills60', 'Defeat 60 enemies with throws', 'throwKills', 60, 150],
    ['enemies250', 'Defeat 250 enemies', 'enemies', 250, 150],
    ['combo100', 'Reach a x100 combo', 'combo', 100, 200],
    ['gems150', 'Collect 150 Villainium from drops', 'gems', 150, 150],
    ['chaos150m', 'Reach 150M chaos', 'chaos', 150_000_000, 200],
  ])],
});

// 2382800 → 2.4M, 7500000 → 7.5M; small counts stay as they are.
const short = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format;

export function villainium() {
  try { return Math.max(0, Math.floor(Number(save().getItem(WALLET_KEY)) || 0)); } catch { return 0; }
}

export function addVillainium(amount) {
  const total = villainium() + amount;
  try { save().setItem(WALLET_KEY, String(total)); } catch { /* private mode: this session only */ }
  return total;
}

function doneIds(levelId) {
  try { return new Set(JSON.parse(save().getItem(DONE_KEY) || '{}')[levelId] ?? []); } catch { return new Set(); }
}

function saveDone(levelId, ids) {
  try {
    const all = JSON.parse(save().getItem(DONE_KEY) || '{}');
    all[levelId] = [...ids];
    save().setItem(DONE_KEY, JSON.stringify(all));
  } catch { /* private mode */ }
}

// The Villainium a loss drops: its kind's amount, by its kind's chance; else 0.
export const rollDrop = (kind, random = Math.random) => random() < DROPS[kind].chance ? DROPS[kind].amount : 0;

const DRONES = ['police-drone', 'recon', 'swarm'];
const sum = (counts, kinds) => kinds.reduce((total, kind) => total + (counts[kind] ?? 0), 0);
const helis = counts => Object.entries(counts).reduce((total, [kind, n]) => total + (kind.includes('heli') ? n : 0), 0);

// What the objectives read from a run's chaos stats (chaos-stats.js).
export function chaosProgress(chaos) {
  const enemy = chaos.enemyVehicles, civilian = chaos.civilianVehicles;
  return {
    drones: sum(enemy, DRONES),
    police: chaos.police,
    swat: chaos.swat,
    soldiers: chaos.soldiers,
    civilians: chaos.civilians,
    buildings: chaos.buildings,
    chaos: chaos.score,
    enemies: chaos.police + chaos.swat + chaos.soldiers + chaos.otherEnemies + sum(enemy, Object.keys(enemy)),
    helis: helis(enemy) + helis(civilian),
    civCars: sum(civilian, ['sedan', 'hatch', 'taxi']),
    buses: sum(civilian, ['bus']),
    policeCars: sum(enemy, ['police', 'policevan']),
    bikes: sum(enemy, ['policebike']),
    swatVans: sum(enemy, ['swat']),
    armoured: sum(enemy, ['armoured']),
    apcs: sum(enemy, ['apc']),
    tanks: sum(enemy, ['tank']),
    jets: sum(enemy, ['vtol', 'fighter', 'bomber']),
  };
}

export class Objectives {
  // panel: the objectives HUD (#tutorial); hudParent: where the Villainium counter goes.
  constructor(panel, hudParent) {
    this.list = [];
    this.shown = new Set();
    this.done = new Set();
    this.progress = Object.create(null);
    this.wallet = villainium();
    if (panel) {
      this.element = document.createElement('ol');
      this.element.className = 'level-objectives';
      // Phones show one line; the toggle opens the list under it.
      this.toggle = document.createElement('button');
      this.toggle.type = 'button';
      this.toggle.className = 'objective-toggle';
      this.toggle.addEventListener('click', () => {
        const open = panel.classList.toggle('is-expanded');
        this.toggle.setAttribute('aria-expanded', String(open));
      });
      this.toggle.setAttribute('aria-expanded', 'false');
      panel.append(this.toggle, this.element);
    }
    if (hudParent) {
      this.counter = document.createElement('div');
      this.counter.className = 'villainium-hud';
      this.counter.title = 'Villainium: earned from objectives and drops. Spend it in the shop.';
      this.counter.innerHTML = '<i class="villainium-gem" aria-hidden="true"></i><b>0</b><span>VILLAINIUM</span>';
      this.amount = this.counter.querySelector('b');
      hudParent.append(this.counter);
      this.syncWallet();
    }
  }

  // level: the campaign level being played, or null (Free Roam: drops only).
  start(level) {
    this.levelId = level?.id ?? null;
    this.list = LEVEL_OBJECTIVES[this.levelId] ?? [];
    this.done = this.levelId ? doneIds(this.levelId) : new Set();
    this.progress = Object.create(null);
    this.base = Object.create(null);
    // The shop may have spent some since.
    this.wallet = villainium();
    this.syncWallet();
    this.render();
  }

  // Called every frame with the run's chaos stats and live values; DOM only changes with progress.
  // Chaos counts are only re-read when the stats change.
  step(chaos, values) {
    if (this.chaosRevision !== chaos.revision || this.chaosProgress === undefined) {
      this.chaosRevision = chaos.revision;
      this.chaosProgress = chaosProgress(chaos);
    }
    this.report({ ...this.chaosProgress, ...values });
  }

  // Dev panel: mark the optional objectives on show done (no reward), revealing the next ones.
  completeShown() {
    if (!this.levelId) return;
    for (const objective of this.shownOptional()) this.done.add(objective.id);
    saveDone(this.levelId, this.done);
    this.render();
  }

  shownOptional() {
    return this.list.filter(o => o.optional && !this.done.has(o.id)).slice(0, OPTIONAL_SHOWN);
  }

  // stats: { heat, combo, boss, throwKills, peopleThrown, gems, ...chaosProgress }. Best this attempt counts.
  // A retry starts the run's counts over, so a count below its baseline restarts it from 0.
  report(stats) {
    let changed = false;
    for (const objective of this.list) {
      // Optional objectives only count while on show.
      if (objective.optional && !this.shown.has(objective)) continue;
      let stat = stats[objective.stat] ?? 0;
      if (objective.optional && !LIVE.has(objective.stat)) {
        if (!(this.base[objective.id] <= stat)) this.base[objective.id] = stat;
        stat -= this.base[objective.id];
      }
      const value = Math.min(objective.goal, Math.max(this.progress[objective.id] ?? 0, stat));
      if (value !== this.progress[objective.id]) { this.progress[objective.id] = value; changed = true; }
      if (value >= objective.goal && !this.done.has(objective.id)) {
        this.done.add(objective.id);
        saveDone(this.levelId, this.done);
        this.earn(objective.reward);
        changed = true;
      }
    }
    if (changed) this.render();
  }

  earn(amount) {
    this.wallet = addVillainium(amount);
    this.syncWallet(amount);
  }

  syncWallet(gained = 0) {
    if (!this.amount) return;
    this.amount.textContent = this.wallet.toLocaleString();
    if (gained > 0 && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.counter.animate?.([{ transform: 'scale(1.18)', filter: 'brightness(1.6)' }, { transform: 'scale(1)' }],
        { duration: 320, easing: 'cubic-bezier(.18,.8,.25,1)' });
    }
  }

  render() {
    this.shown = new Set(this.shownOptional());
    if (!this.element) return;
    this.element.hidden = this.toggle.hidden = !this.list.length;
    this.toggle.textContent = `${this.list.filter(o => this.done.has(o.id)).length}/${this.list.length} objectives`;
    const item = objective => {
      const li = document.createElement('li');
      const done = this.done.has(objective.id);
      li.className = done ? 'is-done' : '';
      const count = objective.goal > 1 && objective.stat !== 'heat' && !done ? ` ${short(this.progress[objective.id] ?? 0)}/${short(objective.goal)}` : '';
      li.innerHTML = `<span>${objective.text}${count}</span><small><i class="villainium-gem"></i>${objective.reward}</small>`;
      return li;
    };
    const main = this.list.filter(o => !o.optional).map(item);
    const optional = [...this.shown].map(item);
    const heading = document.createElement('li');
    heading.className = 'objective-group';
    heading.textContent = 'Optional';
    this.element.replaceChildren(...main, ...(optional.length ? [heading, ...optional] : []));
  }

  destroy() {
    this.toggle?.remove();
    this.element?.remove();
    this.counter?.remove();
  }
}

// Gems in the world. Coordinates are the scene's (y down); gems fall to HOVER above the ground,
// bob there, drift to the hero inside MAGNET and are collected inside REACH (both scale with hero size).
export const GEMS = Object.freeze({ max: 60, hover: 16, gravity: 420, magnet: 70, reach: 14, pull: 900, life: 25, blink: 4 });

export class VillainiumGems {
  constructor(graphics) {
    this.graphics = graphics;
    this.gems = [];
    this.time = 0;
  }

  reset() { this.gems = []; }

  spawn(amount, x, y) {
    if (!(amount > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.gems.length >= GEMS.max) this.gems.shift();
    this.gems.push({ amount, x, y, vx: (Math.random() - 0.5) * 80, vy: -90 - Math.random() * 60, age: 0,
      phase: Math.random() * Math.PI * 2, pulled: false });
  }

  // Returns the Villainium collected this step.
  step(dt, hero, size, groundAt) {
    this.time += dt;
    let collected = 0;
    const magnet = GEMS.magnet * size, reach = GEMS.reach * size;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gem = this.gems[i];
      gem.age += dt;
      const dx = hero.x - gem.x, dy = hero.y - gem.y, distance = Math.hypot(dx, dy);
      if (distance < reach) {
        collected += gem.amount;
        this.gems.splice(i, 1);
        continue;
      }
      if (gem.age > GEMS.life) { this.gems.splice(i, 1); continue; }
      if (distance < magnet) gem.pulled = true;
      if (gem.pulled) {
        // Homes in faster than the hero flies, so a pass-by still collects.
        const speed = Math.min(GEMS.pull, 260 + gem.age * 400);
        gem.x += dx / distance * speed * dt;
        gem.y += dy / distance * speed * dt;
        continue;
      }
      const hover = groundAt(gem.x) - GEMS.hover * size;
      if (gem.y < hover || gem.vy < 0) {
        gem.vy += GEMS.gravity * dt;
        gem.x += gem.vx * dt;
        gem.y += gem.vy * dt;
        gem.vx *= Math.exp(-2 * dt);
        if (gem.y >= hover && gem.vy > 0) { gem.y = hover; gem.vy = 0; gem.vx = 0; }
      } else gem.y = hover;
    }
    return collected;
  }

  draw(size) {
    const g = this.graphics;
    g.clear();
    for (const gem of this.gems) {
      if (gem.age > GEMS.life - GEMS.blink && Math.floor(gem.age * 8) % 2) continue;
      const bob = gem.vy === 0 && !gem.pulled ? Math.sin(this.time * 3 + gem.phase) * 2.5 * size : 0;
      const scale = size * 0.8; // drawn size only; pickup reach is GEMS.reach
      const r = (3 + Math.min(3, gem.amount)) * scale;
      const x = gem.x, y = gem.y + bob;
      g.fillStyle(0xb25cff, 0.25).fillCircle(x, y, r * 1.9);
      hexagon(g.fillStyle(0x0b1020, 1), x, y, r + scale);
      hexagon(g.fillStyle(0x8a3df0, 1), x, y, r);
      g.fillStyle(0xe7c4ff, 1).fillTriangle(x, y - r, x - r * 0.85, y - r * 0.5, x, y);
    }
  }
}

// A path, not a points array, so drawing allocates nothing per frame.
function hexagon(g, x, y, r) {
  const w = r * 0.85, h = r * 0.5;
  g.beginPath();
  g.moveTo(x, y - r).lineTo(x + w, y - h).lineTo(x + w, y + h).lineTo(x, y + r).lineTo(x - w, y + h).lineTo(x - w, y - h);
  g.closePath();
  g.fillPath();
}
