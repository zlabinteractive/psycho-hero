// The campaign: three levels, then Free Roam. Each level is a heat phase ending in its boss,
// started at its own city (x: the hero's spawn). Clearing a level opens the next; Free Roam opens
// once all are cleared. Progress is saved (save.js).
import { save, wipeSave } from './save.js';
import { sound } from './sound.js';

export const CAMPAIGN = Object.freeze([
  { id: 1, name: 'Police Response', city: 'Green City', phase: 1, x: 1950, objective: 'Defeat the Police Response and the boss' },
  { id: 2, name: 'SWAT Response', city: 'Snow City', phase: 2, x: 56200, objective: 'Defeat the SWAT Response and Rhino' },
  { id: 3, name: 'Army Response', city: 'Redrock', phase: 3, x: 31900, objective: 'Defeat the Army and Goliath' },
]);
const STORAGE_KEY = 'tiny-hero-levels-cleared';

export function clearedLevels() {
  try { return Math.max(0, Math.min(CAMPAIGN.length, Number(save().getItem(STORAGE_KEY)) || 0)); } catch { return 0; }
}

export function markCleared(id) {
  if (id <= clearedLevels()) return;
  try { save().setItem(STORAGE_KEY, String(id)); } catch { /* private mode: progress lasts the session only */ }
}

// 'cleared', 'open' (next to play), 'soon' (not designed yet) or 'locked'.
export function levelState(level, cleared = clearedLevels()) {
  if (!level.phase) return 'soon';
  if (level.id <= cleared) return 'cleared';
  return level.id === cleared + 1 ? 'open' : 'locked';
}

export const freeRoamOpen = (cleared = clearedLevels()) => cleared >= CAMPAIGN.length;

// Daily challenges (placeholders for now): the first opens the day the Police level is first
// cleared, then one more each local calendar day, up to DAILY_COUNT.
export const DAILY_COUNT = 5;
const DAILY_START_KEY = 'tiny-hero-daily-start';
export const localDay = (now = new Date()) => Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);

export function dailiesOpen(startDay, today = localDay()) {
  if (startDay == null) return 0;
  return Math.max(0, Math.min(DAILY_COUNT, today - startDay + 1));
}

// The day dailies started, set the first time it's read after the Police level is cleared.
export function dailyStartDay(cleared = clearedLevels()) {
  if (cleared < 1) return null;
  try {
    const stored = save().getItem(DAILY_START_KEY);
    if (stored != null && stored !== '') return Number(stored);
    const today = localDay();
    save().setItem(DAILY_START_KEY, String(today));
    return today;
  } catch { return localDay(); }
}

const svg = path => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const ICONS = {
  lock: svg('M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z'),
  stats: svg('M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z'),
  gear: svg('M10.3 2h3.4l.5 2.6 1.8.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.8 2.6.5v3.4l-2.6.5-.8 1.8 1.5 2.2-2.4 2.4-2.2-1.5-1.8.8-.5 2.6h-3.4l-.5-2.6-1.8-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.8L2 13.7v-3.4l2.6-.5.8-1.8-1.5-2.2 2.4-2.4 2.2 1.5 1.8-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'),
  shop: svg('M6 8V7a6 6 0 0 1 12 0v1h3l-1.5 13h-15L3 8zm2 0h8V7a4 4 0 0 0-8 0z'),
};

function section(text) {
  const heading = document.createElement('h3');
  heading.className = 'level-map-heading';
  heading.textContent = text;
  return heading;
}

// onClick: an open tile; without one, locked.
function menuTile(icon, name, hint, onClick) {
  const tile = document.createElement(onClick ? 'button' : 'div');
  tile.className = `menu-tile ${onClick ? 'is-open' : 'is-locked'}`;
  tile.innerHTML = `<span class="menu-tile-icon">${icon}</span><span><b>${name}</b><small>${hint}</small></span>${onClick ? '' : `<span class="menu-tile-lock">${ICONS.lock}</span>`}`;
  if (onClick) {
    tile.type = 'button';
    tile.addEventListener('click', onClick);
  }
  return tile;
}

// The level map: a modal over the city, on launch, from the pause menu, and after a boss falls.
// onPick(level) starts a level; onFreeRoam() starts Free Roam; onStats() and onShop() open those screens.
export class LevelMap {
  constructor(parent, { onPick, onFreeRoam, onStats, onShop }) {
    this.root = document.createElement('section');
    this.root.className = 'level-map-modal';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'level-map-title');
    this.root.tabIndex = -1;
    this.root.hidden = true;
    this.panel = document.createElement('div');
    this.panel.className = 'pause-menu level-map-panel';
    this.kicker = document.createElement('span');
    this.kicker.className = 'hud-title';
    this.title = document.createElement('h2');
    this.title.id = 'level-map-title';
    this.list = document.createElement('ol');
    this.list.className = 'level-map';
    this.dailies = document.createElement('ol');
    this.dailies.className = 'level-map daily-map';
    // Stats opens once level 1 is cleared (show() rebuilds it); Shop is always open.
    this.extras = document.createElement('div');
    this.extras.className = 'menu-tiles';
    this.onStats = onStats;
    this.onShop = onShop;
    // Title left, Stats and Shop in the header's empty top-right corner.
    const heading = document.createElement('div');
    heading.append(this.kicker, this.title);
    const header = document.createElement('header');
    header.className = 'level-map-header';
    header.append(heading, this.extras);
    // Start: one big obvious button that plays the next open level.
    this.start = document.createElement('button');
    this.start.type = 'button';
    this.start.className = 'menu-start';
    this.start.addEventListener('click', () => this.list.querySelector('.is-open button, button')?.click());
    // Settings, bottom-left: sound, and at its foot wiping progress behind two confirmations.
    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'menu-settings';
    settings.innerHTML = `${ICONS.gear}<span>Settings</span>`;
    settings.addEventListener('click', () => this.openSettings());
    this.settingsDialog = this.buildSettings();
    this.wipeDialog = document.createElement('dialog');
    this.wipeDialog.className = 'pause-menu wipe-confirm';
    this.panel.append(header, section('Campaign'), this.list, section('Daily Challenges'), this.dailies, this.start, settings);
    this.root.append(this.panel, this.settingsDialog, this.wipeDialog);
    parent.append(this.root);
    this.onPick = onPick;
    this.onFreeRoam = onFreeRoam;
  }

  get open() { return !this.root.hidden; }

  // heading: e.g. 'SWAT Response Defeated' after a boss; omitted, the plain level map.
  show(heading) {
    this.kicker.textContent = heading ? 'LEVEL CLEARED' : 'MAIN MENU';
    this.title.textContent = heading ?? 'Psycho Hero';
    const cleared = clearedLevels();
    this.extras.replaceChildren(cleared > 0 ? menuTile(ICONS.stats, 'Stats', 'Runs and records', this.onStats)
      : menuTile(ICONS.stats, 'Stats', 'Beat level 1'), menuTile(ICONS.shop, 'Shop', 'Hero upgrades', this.onShop));
    const nodes = CAMPAIGN.map(level => this.node(level.id, level.name, level.city, levelState(level, cleared),
      () => this.onPick(level)));
    nodes.push(this.node('★', 'Free Roam', 'The whole world', freeRoamOpen(cleared) ? 'open' : 'locked', () => this.onFreeRoam(),
      `Clear all ${CAMPAIGN.length} levels`));
    this.list.replaceChildren(...nodes);
    const opened = dailiesOpen(dailyStartDay(cleared));
    this.dailies.replaceChildren(...Array.from({ length: DAILY_COUNT }, (_, i) => this.node(i + 1, `Day ${i + 1}`, '',
      i < opened ? 'ready' : 'locked', null, i === 0 ? 'Beat level 1' : 'Next day')));
    this.root.hidden = false;
    const next = this.list.querySelector('.is-open button') ?? this.list.querySelector('button');
    this.start.hidden = !next;
    if (next) this.start.innerHTML = `<b>Start</b><small>${next.querySelector('b').textContent}</small>`;
    (next ? this.start : this.root).focus({ preventScroll: true });
  }

  hide() { this.wipeDialog.close(); this.settingsDialog.close(); this.root.hidden = true; }

  get dialogOpen() { return this.settingsDialog.open || this.wipeDialog.open; }

  buildSettings() {
    const dialog = document.createElement('dialog');
    dialog.className = 'pause-menu settings-panel';
    dialog.setAttribute('aria-label', 'Settings');
    dialog.innerHTML = `<span class="hud-title">SETTINGS</span>
      <button type="button" class="settings-close" aria-label="Close settings">×</button>
      <fieldset class="pause-audio"><legend>Sound</legend>
        <label>Music <output></output></label><input type="range" min="0" max="100" step="1">
        <label>Sound effects <output></output></label><input type="range" min="0" max="100" step="1">
        <button type="button" class="settings-mute"></button></fieldset>
      <button type="button" class="settings-wipe">Wipe progress</button>`;
    const [music, sfx] = dialog.querySelectorAll('input');
    const [musicOut, sfxOut] = dialog.querySelectorAll('output');
    const mute = dialog.querySelector('.settings-mute');
    this.syncSettings = () => {
      music.value = Math.round(sound.musicVolume * 100);
      sfx.value = Math.round(sound.sfxVolume * 100);
      musicOut.textContent = `${music.value}%`;
      sfxOut.textContent = `${sfx.value}%`;
      mute.textContent = sound.muted ? 'Unmute all' : 'Mute all';
      mute.setAttribute('aria-pressed', String(sound.muted));
    };
    music.addEventListener('input', () => { sound.setMusicVolume(Number(music.value) / 100); this.syncSettings(); });
    sfx.addEventListener('input', () => { sound.setSfxVolume(Number(sfx.value) / 100); this.syncSettings(); });
    mute.addEventListener('click', () => { sound.setMuted(!sound.muted); this.syncSettings(); });
    dialog.querySelector('.settings-close').addEventListener('click', () => dialog.close());
    dialog.querySelector('.settings-wipe').addEventListener('click', () => this.confirmWipe(0));
    return dialog;
  }

  openSettings() {
    this.syncSettings();
    this.settingsDialog.showModal();
    this.settingsDialog.querySelector('.settings-close').focus();
  }

  // step 0: first ask; step 1: last chance; then erase every save and restart fresh.
  confirmWipe(step) {
    const [title, text, yes] = [
      ['Wipe progress?', 'Levels, records, coins and upgrades will all be erased.', 'Wipe'],
      ['Are you sure?', 'This cannot be undone.', 'Wipe everything'],
    ][step];
    const no = document.createElement('button');
    no.type = 'button';
    no.textContent = 'Keep progress';
    no.addEventListener('click', () => this.wipeDialog.close());
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'wipe-yes';
    go.textContent = yes;
    go.addEventListener('click', () => {
      if (step === 0) { this.confirmWipe(1); return; }
      wipeSave();
      window.location.reload();
    });
    const heading = document.createElement('h2');
    heading.textContent = title;
    const warning = document.createElement('p');
    warning.className = 'pause-warning';
    warning.textContent = text;
    this.wipeDialog.replaceChildren(heading, warning, no, go);
    if (!this.wipeDialog.open) this.wipeDialog.showModal();
    no.focus();
  }

  node(number, name, place, state, pick, lockedText = 'Locked') {
    const item = document.createElement('li');
    item.className = `level-node is-${state}`;
    const badge = { cleared: 'Cleared · replay', open: 'Play', soon: 'Coming soon', ready: 'Unlocked · soon', locked: lockedText }[state];
    const body = `<span class="level-number">${state === 'locked' ? ICONS.lock : number}</span><b>${name}</b><small>${place ? `${place} · ` : ''}${badge}</small>`;
    if (state === 'open' || state === 'cleared') {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = body;
      button.addEventListener('click', pick);
      item.append(button);
    } else item.innerHTML = `<div>${body}</div>`;
    return item;
  }

  destroy() { this.root.remove(); }
}
