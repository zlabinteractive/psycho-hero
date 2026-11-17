// The Shop: hero upgrades bought with Villainium (objectives.js). Level 0 is the hero as tuned; each
// line has MAX_LEVEL steps up to its top value. Levels are saved and cached here, so the stat
// getters (HERO_DAMAGE, HERO_POWER, COMBAT) read them every frame without touching storage.
import { save } from './save.js';
import { addVillainium, villainium } from './objectives.js';
import { LIFT, LIFT_SIZES } from './enemy-throw.js';
import { element, modal } from './records.js';

const LEVELS_KEY = 'tiny-hero-upgrades';
export const MAX_LEVEL = 5;
// Cost of each next level, the same for every line. A run earns about 500 to 1000 Villainium, so the
// first run buys a few cheap levels and maxing everything takes about twenty runs.
export const PRICES = Object.freeze([100, 200, 400, 700, 1100]);

// value(level): the stat at that level. text(level): what the player sees.
const ramp = (from, to) => level => from + (to - from) * level / MAX_LEVEL;
const times = value => `${Number(value.toFixed(1))}x`;
export const UPGRADES = Object.freeze([
  { id: 'grab', name: 'Grab', hint: 'What the hero can lift and throw',
    value: level => LIFT.car + level, text: level => LIFT_SIZES[LIFT.car + level].name },
  { id: 'health', name: 'Max health', hint: 'More health per run', value: ramp(100, 200), text: level => ramp(100, 200)(level) },
  { id: 'power', name: 'Max hero power', hint: 'A bigger power meter', value: ramp(100, 200), text: level => ramp(100, 200)(level) },
  { id: 'laserDamage', name: 'Laser damage', hint: 'The beam burns harder', value: ramp(1, 3), text: level => times(ramp(1, 3)(level)) },
  { id: 'ramTime', name: 'RAM duration', hint: 'RAM drains power slower', value: ramp(1, 3), text: level => times(ramp(1, 3)(level)) },
  { id: 'landing', name: 'Hero landing', hint: 'A wider ground-pound blast', value: ramp(1, 3), text: level => times(ramp(1, 3)(level)) },
  { id: 'laserTime', name: 'Laser duration', hint: 'The beam drains power slower', value: ramp(1, 2), text: level => times(ramp(1, 2)(level)) },
]);
const byId = Object.fromEntries(UPGRADES.map(upgrade => [upgrade.id, upgrade]));

let levels = null;
function loaded() {
  if (!levels) {
    try { levels = JSON.parse(save().getItem(LEVELS_KEY) || '{}') ?? {}; } catch { levels = {}; }
  }
  return levels;
}

export const upgradeLevel = id => Math.max(0, Math.min(MAX_LEVEL, Math.floor(Number(loaded()[id]) || 0)));
export const upgradeValue = id => byId[id].value(upgradeLevel(id));
export const nextPrice = id => PRICES[upgradeLevel(id)];

// Spends the price and saves the new level; false when maxed or short of Villainium.
export function buyUpgrade(id) {
  const price = nextPrice(id);
  if (price === undefined || villainium() < price) return false;
  addVillainium(-price);
  loaded()[id] = upgradeLevel(id) + 1;
  try { save().setItem(LEVELS_KEY, JSON.stringify(levels)); } catch { /* private mode: this session only */ }
  return true;
}

// Dev panel's save wipe, and tests: forget the cache so the next read comes from storage.
export const reloadUpgrades = () => { levels = null; };

// The menu's Shop screen: a row per upgrade, its level pips, what the next level gives, and its price.
export class ShopPanel {
  constructor(parent, onClose, onBuy) {
    Object.assign(this, modal(parent, 'shop-title', 'HERO UPGRADES', () => { this.hide(); onClose(); }));
    this.title.textContent = 'Shop';
    this.wallet = element('p', 'shop-wallet');
    this.rows = element('ol', 'record-rows shop-rows');
    this.button.className = 'settings-close';
    this.button.textContent = '×';
    this.button.setAttribute('aria-label', 'Close shop');
    this.panel.classList.add('shop-panel');
    this.panel.append(this.button, this.wallet, this.rows);
    this.onBuy = onBuy;
  }

  show() {
    this.render();
    this.root.hidden = false;
    this.button.focus({ preventScroll: true });
  }

  render() {
    const wallet = villainium();
    this.wallet.innerHTML = `<i class="villainium-gem" aria-hidden="true"></i><b>${wallet.toLocaleString()}</b> Villainium`;
    this.rows.replaceChildren(...UPGRADES.map(upgrade => {
      const level = upgradeLevel(upgrade.id), price = PRICES[level];
      const item = element('li', 'record-row shop-row');
      const pips = element('span', 'shop-pips');
      pips.setAttribute('aria-label', `Level ${level} of ${MAX_LEVEL}`);
      pips.innerHTML = Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < level ? 'is-on' : ''}"></i>`).join('');
      const now = upgrade.text(level);
      const detail = price === undefined ? `${now} · maxed` : `${now} → ${upgrade.text(level + 1)}`;
      const unlock = upgrade.id === 'grab' && price !== undefined ? ` · lift ${LIFT_SIZES[upgrade.value(level + 1)].unlocks}` : '';
      const label = element('span', 'record-row-label', upgrade.name);
      label.append(pips);
      const buy = element('button', 'shop-buy');
      buy.type = 'button';
      buy.disabled = price === undefined || wallet < price;
      buy.innerHTML = price === undefined ? 'MAX' : `<i class="villainium-gem" aria-hidden="true"></i>${price}`;
      buy.setAttribute('aria-label', price === undefined ? `${upgrade.name} maxed` : `Buy ${upgrade.name} level ${level + 1} for ${price} Villainium`);
      buy.addEventListener('click', () => {
        if (!buyUpgrade(upgrade.id)) return;
        this.onBuy?.(upgrade.id);
        this.render();
        this.rows.querySelectorAll('.shop-buy')[UPGRADES.indexOf(upgrade)]?.focus({ preventScroll: true });
      });
      item.append(label, buy, element('small', 'record-row-best', `${upgrade.hint} · ${detail}${unlock}`));
      return item;
    }));
  }

  hide() { this.root.hidden = true; }
  destroy() { this.root.remove(); }
}
