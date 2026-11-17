import { LEVELS } from './enemy-director.js';
import { COMBO_TIMEOUT } from './hero-combat.js';
const HEAT_ENTER_MS = 400;
const HEAT_HOLD_MS = 3000;
const HEAT_EXIT_MS = 200;
const HEAT_ANNOUNCEMENT_MS = HEAT_ENTER_MS + HEAT_HOLD_MS + HEAT_EXIT_MS;
// DOM is created once; run totals only touch it when an incident changes the model.
const VEHICLES = {
  sedan: 'Sedan', hatch: 'Hatchback', taxi: 'Taxi', bus: 'Bus', police: 'Police car', policevan: 'Police van', policebike: 'Police interceptor',
  swat: 'SWAT van', armoured: 'Armoured truck', apc: 'APC', tank: 'Tank',
  policeheli: 'Police helicopter', gunheli: 'Gun helicopter', attackheli: 'Attack helicopter',
  newsheli: 'News helicopter', tourheli: 'Tour helicopter', prop: 'Light aircraft',
  jet: 'Airliner', jumbo: 'Jumbo jet', beluga: 'Beluga freighter',
  'police-drone': 'Police drone', recon: 'Recon drone', swarm: 'Swarm drone',
  'cruise-liner': 'Cruise liner', vtol: 'VTOL', fighter: 'Fighter jet', bomber: 'Bomber',
};
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function row(list, label) {
  const name = element('dt', '', label), value = element('dd', '', '0');
  list.append(name, value);
  return value;
}
function setText(node, text) {
  const value = String(text);
  if (node.textContent !== value) node.textContent = value;
}

// These run only when a displayed stat changes. Reuse DOM and cancel the prior
// effect so a crowd hit or held laser cannot build an animation backlog.
function effect(node, frames, duration = 420, iterations = 1) {
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  return node.animate?.(frames, { duration, iterations, easing: 'cubic-bezier(.18,.8,.25,1)' });
}

// Heat sits under the title and chaos score in the top-right status panel.
export class HeatHud {
  constructor(parent) {
    this.root = element('div', 'response-hud');
    const heading = element('div', 'heat-heading');
    this.phase = element('span', 'heat-phase');
    this.stars = element('div', 'heat-stars');
    this.stars.setAttribute('role', 'img');
    this.pips = Array.from({ length: LEVELS }, (_, i) => {
      const pip = element('i');
      pip.style.setProperty('--flame-delay', `${-i * 0.23}s`);
      return this.stars.appendChild(pip);
    });
    heading.append(element('strong', '', 'HEAT'), this.stars);
    const embers = element('span', 'heat-embers');
    embers.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 7; i++) {
      const spark = element('i');
      spark.style.setProperty('--ember-x', `${12 + i * 13}%`);
      spark.style.setProperty('--ember-delay', `${-i * 0.37}s`);
      embers.append(spark);
    }
    heading.append(embers);
    this.bar = element('progress', 'heat-progress');
    this.bar.max = 100;
    this.bar.value = 0;
    this.caption = element('span', 'heat-caption');
    this.combo = element('div', 'combo-counter');
    this.combo.setAttribute('aria-label', 'Consecutive enemy hits');
    this.combo.title = 'Consecutive enemy hits. Resets after 5 seconds without a hit.';
    const comboHeading = element('div', 'combo-heading');
    const comboLabel = element('div', 'combo-label');
    this.comboTag = element('span', 'combo-tag', 'LAND A HIT');
    comboLabel.append(element('strong', '', 'COMBO'), this.comboTag);
    const comboReadout = element('div', 'combo-readout');
    this.comboAura = element('span', 'combo-aura');
    this.comboFloat = element('span', 'combo-float');
    this.comboAura.setAttribute('aria-hidden', 'true');
    this.comboFloat.setAttribute('aria-hidden', 'true');
    this.comboCount = element('span', 'combo-count', '0');
    comboReadout.append(this.comboAura, this.comboFloat, this.comboCount, element('span', 'combo-units', 'HITS'));
    comboHeading.append(comboLabel, comboReadout);
    this.comboBar = element('progress', 'combo-progress');
    this.comboBar.max = 100;
    this.comboBar.value = 0;
    this.comboBar.setAttribute('aria-label', 'Combo time remaining');
    this.combo.append(comboHeading, this.comboBar);
    this.root.append(heading, this.bar, this.caption, this.phase, this.combo);
    // One reusable banner announces response escalation without capturing input.
    this.heatAnnouncement = element('div', 'heat-announcement');
    this.heatAnnouncement.setAttribute('role', 'status');
    this.heatAnnouncement.setAttribute('aria-atomic', 'true');
    this.heatBurst = element('i', 'heat-burst');
    this.heatBurst.setAttribute('aria-hidden', 'true');
    this.heatBeacon = element('span', 'heat-beacon', '🚨');
    this.heatBeacon.setAttribute('aria-hidden', 'true');
    this.heatBeams = ['red', 'blue'].map(color => element('i', `heat-beacon-beam heat-beacon-${color}`));
    this.heatBeacon.append(...this.heatBeams);
    this.heatFlames = ['left', 'right'].map(side => {
      const flame = element('span', `heat-flame heat-flame-${side}`, '🔥');
      flame.setAttribute('aria-hidden', 'true');
      return flame;
    });
    const plate = element('div', 'heat-announcement-plate');
    this.heatShine = element('i', 'heat-shine');
    this.heatShine.setAttribute('aria-hidden', 'true');
    this.announcedHeat = element('strong', 'heat-announcement-title');
    this.announcedLevel = element('span', 'heat-announcement-level');
    plate.append(element('span', 'heat-announcement-kicker', 'HEAT LEVEL INCREASED'), this.announcedHeat, this.announcedLevel, this.heatShine);
    this.heatAnnouncement.append(this.heatBurst, this.heatBeacon, plate, ...this.heatFlames);
    parent.append(this.root, this.heatAnnouncement);
    this.lit = -1;
  }
  // boss: the live boss's name, or ''.
  sync(director, visible, boss = '', combo = null) {
    this.root.hidden = !visible;
    this.heatAnnouncement.hidden = !visible;
    if (!visible) {
      for (const animation of this.announcementEffects ?? []) animation?.cancel();
      this.heatPhase = undefined;
      return;
    }
    const stars = director.stars;
    const phase = director.phase;
    setText(this.phase, director.phaseLabel);
    const count = director.levels;
    if (this.lit !== stars || this.count !== count || this.heatPhase !== phase) {
      const increased = this.heatPhase !== undefined && stars > 0 && !(this.lit === 0 && stars === 1)
        && (phase > this.heatPhase || phase === this.heatPhase && stars > this.lit);
      if (!increased) for (const animation of this.announcementEffects ?? []) animation?.cancel();
      if (increased) {
        this.announceHeat(director);
        this.heatEffect?.cancel();
        this.heatEffect = effect(this.root, [
          { transform: 'translateX(0)', borderColor: '#fff3bb', boxShadow: '0 0 26px #ff983a99' },
          { transform: 'translateX(-4px)', offset: 0.18 },
          { transform: 'translateX(2px)', offset: 0.35 },
          { transform: 'translateX(0)', borderColor: '#6b4939', boxShadow: '0 0 0 #ff983a00' },
        ], 700);
      }
      this.lit = stars;
      this.count = count;
      this.heatPhase = phase;
      this.root.classList.toggle('has-heat', stars > 0);
      this.pips.forEach((pip, i) => {
        pip.classList.toggle('is-lit', i < stars);
        pip.classList.toggle('is-current', i === stars - 1);
        pip.hidden = i >= count;
      });
    }
    const label = `${director.phaseLabel}, heat ${stars} of ${count}`;
    if (this.stars.getAttribute('aria-label') !== label) this.stars.setAttribute('aria-label', label);
    const fill = Math.min(100, Math.floor(director.fill * 100));
    if (this.bar.value !== fill) this.bar.value = fill;
    const caption = !stars ? 'Cause havoc to raise heat' : director.phase === 5 && stars === count
      ? (fill === 100 ? 'Maximum response' : 'Building to maximum response')
      : boss ? `Defeat ${boss}` : director.bossDue ? 'Boss incoming' : stars === count ? 'Building to the boss' : 'Next heat level';
    if (this.bar.getAttribute('aria-label') !== caption) this.bar.setAttribute('aria-label', caption);
    setText(this.caption, director.lull && !boss ? 'Reinforcements regrouping' : caption);
    const hits = combo?.count ?? 0;
    if (this.comboHits !== hits) {
      const gained = hits - (this.comboHits ?? 0);
      this.comboHits = hits;
      setText(this.comboCount, hits);
      this.combo.classList.toggle('is-active', hits > 0);
      const tier = hits >= 100 ? 5 : hits >= 50 ? 4 : hits >= 25 ? 3 : hits >= 10 ? 2 : hits >= 5 ? 1 : 0;
      this.combo.dataset.tier = String(tier);
      setText(this.comboTag, !hits ? 'LAND A HIT' : ['KEEP IT GOING', 'ON A ROLL', 'RAMPAGE', 'UNSTOPPABLE', 'MAYHEM', 'LEGENDARY'][tier]);
      for (const animation of this.comboEffects ?? []) animation?.cancel();
      this.comboEffects = [];
      if (gained > 0) {
        setText(this.comboFloat, `+${gained}`);
        this.comboEffects = [
          effect(this.comboCount, [
            { transform: 'scale(1.6) rotate(-10deg)', color: '#fff' },
            { transform: 'scale(.94) rotate(3deg)', offset: 0.65 },
            { transform: 'scale(1) rotate(0)' },
          ], 360),
          effect(this.comboFloat, [
            { transform: 'translate(-5px, 0) scale(.8)', opacity: 1 },
            { transform: 'translate(-16px, -35px) scale(1.25)', opacity: 0 },
          ], 550),
          effect(this.comboAura, [
            { transform: 'scale(.65)', opacity: .9 },
            { transform: 'scale(1.65)', opacity: 0 },
          ], 440),
        ];
      }
    }
    const remaining = Math.ceil((combo?.remaining ?? 0) / COMBO_TIMEOUT * 100);
    if (this.comboBar.value !== remaining) this.comboBar.value = remaining;
    const expiring = hits > 0 && remaining <= 25;
    if (this.expiring !== expiring) {
      this.expiring = expiring;
      this.combo.classList.toggle('is-expiring', expiring);
    }
  }
  announceHeat(director) {
    for (const animation of this.announcementEffects ?? []) animation?.cancel();
    setText(this.announcedHeat, director.phaseLabel);
    setText(this.announcedLevel, `HEAT ${director.stars} / ${director.levels}`);
    this.announcementEffects = [
      effect(this.heatAnnouncement, [
        { transform: 'translateY(-32px) scale(.6) rotate(-6deg)', opacity: 0 },
        { transform: 'translateY(3px) scale(1.12) rotate(2deg)', opacity: 1, offset: .04 },
        { transform: 'translateY(0) scale(.97) rotate(-1deg)', opacity: 1, offset: .075 },
        { transform: 'translateY(0) scale(1) rotate(0)', opacity: 1, offset: HEAT_ENTER_MS / HEAT_ANNOUNCEMENT_MS },
        { transform: 'translateY(0) scale(1) rotate(0)', opacity: 1, offset: (HEAT_ENTER_MS + HEAT_HOLD_MS) / HEAT_ANNOUNCEMENT_MS },
        { transform: 'translateY(-18px) scale(.94) rotate(0)', opacity: 0 },
      ], HEAT_ANNOUNCEMENT_MS),
      effect(this.heatBurst, [
        { transform: 'scale(.35) rotate(-12deg)', opacity: 0 },
        { transform: 'scale(1) rotate(0)', opacity: .85, offset: .2 },
        { transform: 'scale(1.3) rotate(8deg)', opacity: 0 },
      ], 1000),
      effect(this.heatShine, [
        { transform: 'translateX(-180%) skewX(-20deg)', opacity: 0 },
        { transform: 'translateX(-180%) skewX(-20deg)', opacity: .85, offset: .25 },
        { transform: 'translateX(500%) skewX(-20deg)', opacity: 0 },
      ], 1200),
      effect(this.heatBeacon, [
        { transform: 'rotate(-7deg) scale(1)' },
        { transform: 'rotate(7deg) scale(1.08)', offset: .5 },
        { transform: 'rotate(-7deg) scale(1)' },
      ], 600, HEAT_ANNOUNCEMENT_MS / 600),
    ];
    this.heatBeams.forEach((beam, i) => this.announcementEffects.push(effect(beam, [
      { opacity: i ? .15 : .85 },
      { opacity: i ? .85 : .15, offset: .5 },
      { opacity: i ? .15 : .85 },
    ], 900, HEAT_ANNOUNCEMENT_MS / 900)));
    this.heatFlames.forEach((flame, i) => this.announcementEffects.push(effect(flame, [
      { transform: `translateY(2px) scale(.9) rotate(${i ? 8 : -8}deg)` },
      { transform: `translateY(-7px) scale(1.12,1.2) rotate(${i ? -5 : 5}deg)`, offset: .5 },
      { transform: `translateY(2px) scale(.9) rotate(${i ? 8 : -8}deg)` },
    ], i ? 600 : 450, HEAT_ANNOUNCEMENT_MS / (i ? 600 : 450))));
  }
  remove() {
    this.heatEffect?.cancel();
    for (const animation of this.announcementEffects ?? []) animation?.cancel();
    this.heatAnnouncement.remove();
    for (const animation of this.comboEffects ?? []) animation?.cancel();
    this.root.remove();
  }
}

export class ChaosHud {
  constructor(parent) {
    this.root = element('details', 'chaos-hud');
    this.root.setAttribute('aria-label', 'Run destruction statistics');
    const summary = element('summary');
    const heading = element('span', 'chaos-heading');
    const banner = element('span', 'rank-banner');
    this.rank = element('strong', 'title-ribbon', 'Troublemaker');
    this.rankSparks = Array.from({ length: 8 }, () => element('i', 'rank-spark'));
    for (const spark of this.rankSparks) spark.setAttribute('aria-hidden', 'true');
    banner.append(this.rank, ...this.rankSparks);
    this.score = element('span', 'chaos-score', '0');
    heading.append(banner, this.score, element('span', 'chaos-kicker', 'CHAOS'));
    summary.append(heading);
    const body = element('div', 'chaos-body');
    const list = element('dl', 'chaos-counts');
    this.counts = {};
    for (const [key, label] of Object.entries({ buildings: 'Buildings destroyed', civilians: 'Civilians killed',
      police: 'Police killed', swat: 'SWAT killed', soldiers: 'Soldiers killed', otherEnemies: 'Other enemies killed' })) {
      this.counts[key] = row(list, label);
    }
    this.counts.buildings.previousElementSibling.title = 'Counted once when 80% of the original standing masonry is gone. Trees and ships are excluded.';
    body.append(list);
    this.groups = {};
    for (const [key, label] of [['civilianVehicles', 'Civilian vehicles'], ['enemyVehicles', 'Enemy vehicles']]) {
      const group = element('section', 'chaos-vehicles');
      const total = element('h3', '', `${label} · 0`);
      const empty = element('p', 'chaos-empty', 'None destroyed');
      const vehicles = element('dl', 'chaos-counts');
      group.append(total, empty, vehicles);
      this.groups[key] = { label, total, empty, list: vehicles, rows: new Map() };
      body.append(group);
    }
    body.append(element('p', 'chaos-note', 'Chaos = every building, person and vehicle lost. Occupants still aboard count too. A world rebuild starts a new run.'));
    this.root.append(summary, body);
    parent.append(this.root);
    // Clicking the panel returns keyboard play to the canvas; no pause or input capture.
    summary.addEventListener('click', () => summary.blur());
    this.revision = -1;
  }
  sync(stats, title) {
    setText(this.rank, title);
    if (this.title !== undefined && this.title !== title) {
      for (const animation of this.rankEffects ?? []) animation?.cancel();
      this.rankEffects = [effect(this.rank, [
        { transform: 'translateX(24px) scale(.75) rotate(-5deg)', filter: 'brightness(2)' },
        { transform: 'translateX(-5px) scale(1.14) rotate(2deg)', filter: 'brightness(1.4)', offset: 0.45 },
        { transform: 'translateX(0) scale(1) rotate(0)', filter: 'brightness(1)' },
      ], 900)];
      this.rankSparks.forEach((spark, i) => {
        const angle = i * Math.PI / 4;
        this.rankEffects.push(effect(spark, [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${Math.cos(angle) * 85}px,${Math.sin(angle) * 42}px) scale(.2)`, opacity: 0 },
        ], 800));
      });
    }
    this.title = title;
    if (this.revision === stats.revision) return;
    this.revision = stats.revision;
    setText(this.score, stats.score.toLocaleString());
    for (const [key, value] of Object.entries(this.counts)) setText(value, stats[key]);
    for (const [key, group] of Object.entries(this.groups)) {
      const counts = stats[key];
      let total = 0;
      for (const [kind, count] of Object.entries(counts)) {
        total += count;
        if (!group.rows.has(kind)) group.rows.set(kind, row(group.list,
          VEHICLES[kind] ?? kind.replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase())));
        setText(group.rows.get(kind), count);
      }
      for (const [kind, value] of group.rows) {
        const hidden = !counts[kind];
        value.hidden = hidden;
        value.previousElementSibling.hidden = hidden;
      }
      group.empty.hidden = total > 0;
      setText(group.total, `${group.label} · ${total}`);
    }
  }
  remove() {
    for (const animation of this.rankEffects ?? []) animation?.cancel();
    this.root.remove();
  }
}
