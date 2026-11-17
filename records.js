// Personal records and all-time totals, kept across sessions (save.js), plus their screens:
// the mid-run NEW RECORD banner, the win panel after a boss, and the Stats screen in the menu.
import { save } from './save.js';

const KEY = 'psycho-hero-records';
// Per-run stats. Higher is better; each also has an all-time total except the combo. `announce`:
// the smallest record the mid-run banner calls out, so early short runs don't spam it.
export const STATS = Object.freeze([
  { key: 'chaos', label: 'Chaos score', total: 'Total chaos', announce: 500_000 },
  { key: 'combo', label: 'Max combo', unit: ' hits', announce: 20 },
  { key: 'enemies', label: 'Enemies defeated', total: 'Enemies defeated', announce: 25 },
  { key: 'buildings', label: 'Buildings destroyed', total: 'Buildings destroyed', announce: 10 },
]);
const ANNOUNCE = Object.fromEntries(STATS.map(stat => [stat.key, stat.announce]));

export const formatTime = seconds => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const formatValue = (stat, value) => `${Math.round(value).toLocaleString()}${stat.unit ?? ''}`;

// Every enemy taken out this run: troops and enemy vehicles (drones and bosses included).
export function enemiesDefeated(chaos) {
  let count = chaos.police + chaos.swat + chaos.soldiers + chaos.otherEnemies;
  for (const kind in chaos.enemyVehicles) count += chaos.enemyVehicles[kind];
  return count;
}

export class Records {
  constructor(store = save) {
    this.store = store;
    this.data = { best: {}, total: {}, times: {} };
    try {
      const saved = JSON.parse(this.store().getItem(KEY));
      if (saved) for (const part in this.data) Object.assign(this.data[part], saved[part]);
    } catch { /* no save yet, or unreadable: start fresh */ }
    this.start();
  }

  persist() {
    try { this.store().setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode: records last the session */ }
  }

  // A new run: bests to beat are the ones saved before it began.
  start() {
    this.run = { chaos: 0, combo: 0, enemies: 0, buildings: 0 };
    this.saved = { ...this.run };
    this.time = 0;
    this.savedTime = 0;
    this.before = { ...this.data.best };
    this.announced = new Set();
  }

  tick(dt) { this.time += dt; }

  // Keys whose saved best this run just passed (each once per run), else null. A stat with no
  // saved best yet isn't announced (a first run would beat everything at once), nor one below
  // its `announce` floor; such a record still counts once it passes the floor later in the run.
  observe(chaos, combo) {
    let beaten = null;
    if (chaos.revision !== this.revision) {
      this.revision = chaos.revision;
      beaten = this.see('chaos', chaos.score, beaten);
      beaten = this.see('enemies', enemiesDefeated(chaos), beaten);
      beaten = this.see('buildings', chaos.buildings, beaten);
    }
    return this.see('combo', combo, beaten);
  }

  see(key, value, beaten) {
    if (!(value > this.run[key])) return beaten;
    this.run[key] = value;
    const best = this.before[key] ?? 0;
    if (best <= 0 || value <= best || value < ANNOUNCE[key] || this.announced.has(key)) return beaten;
    this.announced.add(key);
    return [...(beaten ?? []), key];
  }

  // Bank this run so far into the totals and bests. Safe to call repeatedly.
  commit() {
    const { total, best } = this.data;
    for (const { key } of STATS) {
      if (key !== 'combo') total[key] = (total[key] ?? 0) + this.run[key] - this.saved[key];
      best[key] = Math.max(best[key] ?? 0, this.run[key]);
    }
    total.playTime = (total.playTime ?? 0) + this.time - this.savedTime;
    this.saved = { ...this.run };
    this.savedTime = this.time;
    this.persist();
  }

  // A level won (level: its id, or 'free'). Returns the win panel's rows.
  win(level) {
    const prevTime = this.data.times[level];
    const fastest = !(prevTime <= this.time);
    if (fastest) this.data.times[level] = this.time;
    this.data.total.wins = (this.data.total.wins ?? 0) + 1;
    this.commit();
    return {
      stats: STATS.map(stat => ({ stat, value: this.run[stat.key], best: this.before[stat.key] ?? 0,
        isNew: this.run[stat.key] > (this.before[stat.key] ?? 0) })),
      time: { value: this.time, best: prevTime, isNew: fastest },
    };
  }
}

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const calm = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const play = (node, frames, options) => (calm() ? null : node.animate?.(frames,
  { easing: 'cubic-bezier(.18,.8,.25,1)', fill: 'both', ...options }));

// NEW RECORD: a chrome-and-cyan plate that slams in sideways with a trophy and a spark burst.
// A record beaten within RECORD_GAP_MS of the previous one is skipped, not queued, so a burst of
// records shows only its first.
const RECORD_MS = 3500;
const RECORD_GAP_MS = 5000;

export class RecordBanner {
  constructor(parent) {
    this.root = element('div', 'record-banner');
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-atomic', 'true');
    const plate = element('div', 'record-plate');
    this.trophy = element('span', 'record-trophy', '🏆');
    this.trophy.setAttribute('aria-hidden', 'true');
    this.label = element('span', 'record-label');
    this.value = element('strong', 'record-value');
    this.shine = element('i', 'record-shine');
    plate.append(this.trophy, element('span', 'record-kicker', 'NEW RECORD!'), this.label, this.value, this.shine);
    this.sparks = Array.from({ length: 12 }, () => element('i', 'record-spark'));
    this.root.append(...this.sparks, plate);
    this.root.hidden = true;
    parent.append(this.root);
    this.shownAt = -Infinity;
  }

  show(stat, value, now = performance.now()) {
    const recent = now - this.shownAt < RECORD_GAP_MS;
    this.shownAt = now;
    if (recent) return;
    this.root.hidden = false;
    this.label.textContent = stat.label;
    this.value.textContent = formatValue(stat, value);
    this.cancel();
    const main = play(this.root, [
      { transform: 'translateX(110vw) skewX(-25deg)', opacity: 0 },
      { transform: 'translateX(-14px) skewX(8deg)', opacity: 1, offset: 80 / RECORD_MS },
      { transform: 'translateX(0) skewX(0)', opacity: 1, offset: 130 / RECORD_MS },
      { transform: 'translateX(0) scale(1)', opacity: 1, offset: 1 - 150 / RECORD_MS },
      { transform: 'translateX(-110vw) skewX(25deg)', opacity: 0 },
    ], { duration: RECORD_MS });
    this.effects = [main,
      play(this.trophy, [
        { transform: 'scale(0) rotate(-180deg)' },
        { transform: 'scale(1.5) rotate(15deg)', offset: 0.5 },
        { transform: 'scale(1) rotate(0)' },
      ], { duration: 450, delay: 100 }),
      play(this.shine, [
        { transform: 'translateX(-200%) skewX(-20deg)' },
        { transform: 'translateX(700%) skewX(-20deg)' },
      ], { duration: 500, delay: 200 }),
      play(this.value, [
        { transform: 'scale(2.4)', opacity: 0, filter: 'blur(4px)' },
        { transform: 'scale(.9)', opacity: 1, filter: 'blur(0)', offset: 0.6 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: 350, delay: 120 }),
      ...this.sparks.map((spark, i) => {
        const angle = i / this.sparks.length * Math.PI * 2;
        return play(spark, [
          { transform: 'translate(0,0) scale(1.4)', opacity: 1 },
          { transform: `translate(${Math.cos(angle) * 220}px,${Math.sin(angle) * 90}px) scale(0)`, opacity: 0 },
        ], { duration: 600, delay: 110 });
      })];
    const hide = () => { this.root.hidden = true; };
    if (main) main.onfinish = hide;
    else this.timer = setTimeout(hide, RECORD_MS);
  }

  cancel() {
    clearTimeout(this.timer);
    for (const effect of this.effects ?? []) effect?.cancel();
  }

  clear() {
    this.cancel();
    this.shownAt = -Infinity;
    this.root.hidden = true;
  }

  destroy() { this.clear(); this.root.remove(); }
}

export function modal(parent, id, kicker, onClose) {
  const root = element('section', 'level-map-modal records-modal');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', id);
  root.tabIndex = -1;
  root.hidden = true;
  const panel = element('div', 'pause-menu records-panel');
  const title = element('h2');
  title.id = id;
  const button = element('button', 'menu-start');
  button.type = 'button';
  button.addEventListener('click', onClose);
  root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } });
  panel.append(element('span', 'hud-title', kicker), title);
  root.append(panel);
  parent.append(root);
  return { root, panel, title, button };
}

function statRow(label, text, best, isNew) {
  const item = element('li', isNew ? 'record-row is-new' : 'record-row');
  const name = element('span', 'record-row-label', label);
  const value = element('b', 'record-row-value', text);
  const note = element('small', 'record-row-best', best);
  item.append(name, value, note);
  if (isNew) item.append(element('em', 'record-stamp', 'NEW BEST'));
  return item;
}

// After a boss: the run's stats, NEW BEST stamped on each record, then Continue.
export class WinPanel {
  constructor(parent, onContinue) {
    Object.assign(this, modal(parent, 'win-title', 'LEVEL CLEARED', () => { this.hide(); onContinue(this.heading); }));
    this.root.classList.add('win-modal');
    this.list = element('ol', 'record-rows');
    this.button.innerHTML = '<b>Continue</b><small>Level map</small>';
    this.panel.append(this.list, this.button);
  }

  get open() { return !this.root.hidden; }

  show(heading, result) {
    this.heading = heading;
    this.title.textContent = heading;
    const rows = result.stats.map(({ stat, value, best, isNew }) => statRow(stat.label, formatValue(stat, value),
      best > 0 ? `Best ${formatValue(stat, best)}` : 'First record', isNew && value > 0));
    const { time } = result;
    rows.push(statRow('Time taken', formatTime(time.value),
      time.best ? `Fastest ${formatTime(time.best)}` : 'First clear', time.isNew));
    this.list.replaceChildren(...rows);
    this.root.hidden = false;
    this.button.focus({ preventScroll: true });
    this.effects?.forEach(effect => effect?.cancel());
    this.effects = [play(this.panel, [
      { transform: 'scale(.7) translateY(30px)', opacity: 0 },
      { transform: 'scale(1.04)', opacity: 1, offset: 0.7 },
      { transform: 'scale(1)', opacity: 1 },
    ], { duration: 500 })];
    rows.forEach((row, i) => {
      const delay = 350 + i * 180;
      this.effects.push(play(row, [
        { transform: 'translateX(-40px)', opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ], { duration: 320, delay }));
      const stamp = row.querySelector('.record-stamp');
      if (stamp) this.effects.push(play(stamp, [
        { transform: 'scale(3) rotate(-30deg)', opacity: 0 },
        { transform: 'scale(.9) rotate(-8deg)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1) rotate(-8deg)', opacity: 1 },
      ], { duration: 380, delay: delay + 260 }));
    });
  }

  hide() { this.root.hidden = true; }
  destroy() { this.root.remove(); }
}

// The menu's Stats screen: personal records, fastest clears and all-time totals.
export class StatsPanel {
  constructor(parent, levels, onClose) {
    Object.assign(this, modal(parent, 'stats-title', 'RUNS AND RECORDS', () => { this.hide(); onClose(); }));
    this.title.textContent = 'Stats';
    this.levels = levels;
    this.records = element('ol', 'record-rows');
    this.totals = element('ol', 'record-rows');
    this.button.innerHTML = '<b>Back</b><small>Main menu</small>';
    const heading = text => element('h3', 'level-map-heading', text);
    this.panel.append(heading('High scores'), this.records, heading('All time'), this.totals, this.button);
  }

  show(data) {
    const { best, total, times } = data;
    this.records.replaceChildren(
      ...STATS.map(stat => statRow(stat.label, best[stat.key] ? formatValue(stat, best[stat.key]) : '—', 'Best run')),
      ...this.levels.map(level => statRow(level.name, times[level.id] ? formatTime(times[level.id]) : '—', 'Fastest clear')));
    this.totals.replaceChildren(
      ...STATS.filter(stat => stat.total).map(stat => statRow(stat.total, formatValue(stat, total[stat.key] ?? 0), 'All runs')),
      statRow('Levels won', String(total.wins ?? 0), 'All runs'),
      statRow('Time in action', formatTime(total.playTime ?? 0), 'All runs'));
    this.root.hidden = false;
    this.button.focus({ preventScroll: true });
  }

  hide() { this.root.hidden = true; }
  destroy() { this.root.remove(); }
}
