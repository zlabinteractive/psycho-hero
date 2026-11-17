import { save } from './save.js';
// First-run guided tutorial: one prompt at a time, each cleared by doing it in play.
// Progress comes from the hero's real movement, so a gamepad stick clears it too.
const STORAGE_KEY = 'tiny-hero-tutorial-done';
const VILLAINIUM_TIP_KEY = 'tiny-hero-villainium-tip';
const LIFT_TIP_KEY = 'tiny-hero-lift-tip';
// Villainium collected in a run before its spotlight shows.
export const VILLAINIUM_TIP_AT = 10;
// Ms a cleared step stays ticked green before the next one slides in.
const CLEARED_HOLD = 750;

export const TUTORIAL_STEPS = [
  // touch: phone wording; null drops the step on phones.
  { keys: ['W', 'A', 'S', 'D'], text: 'Fly around', touch: 'Drag the stick to fly', stat: 'moved', amount: 1.5 },
  { keys: ['Space', 'Right mouse button'], text: 'Punch enemies and objects', touch: 'Tap Punch to hit enemies and objects', stat: 'punched', amount: 3 },
  { keys: ['F', 'Left mouse button'], title: 'Fire your laser', text: 'Hold left mouse button or F to fire your laser in the direction of travel or at your pointer', touch: 'Hold Laser and drag to aim', stat: 'lasered', amount: 1 },
  { keys: ['Shift'], text: 'Hold while flying to boost', touch: null, stat: 'boosted', amount: 1.2 },
  { keys: ['Q'], text: 'Hold to RAM through anything', touch: 'Hold RAM to smash through anything', stat: 'rammed', amount: 1 },
  { keys: ['E'], text: 'Grab anything, then throw it', touch: 'Tap Grab to grab anything and throw', stat: 'thrown', amount: 1 },
];

function touchPlay() {
  return typeof document !== 'undefined' && document.body?.classList.contains('touch-play');
}

// Desktop key guide: one chip per control, lit while its tutorial step is current.
const KEY_GUIDE = [
  ['move', [['WASD', 'Fly', 'moved'], ['Shift', 'Boost', 'boosted']]],
  ['powers', [['Space / RMB', 'Punch', 'punched'], ['F / LMB', 'Laser', 'lasered'], ['Q', 'RAM', 'rammed'], ['E', 'Grab / throw', 'thrown']]],
];

// First-run spotlight tour, before the first step. Targets are CSS selectors; several are framed together.
const COACH = {
  touch: [
    ['.touch-move', 'This is your <b>Movement</b> stick. Drag it to fly, push it to the rim to boost.'],
    ['.touch-punch,.touch-laser,.touch-grab,.touch-ram', 'These are your <b>Controls</b>: tap Punch, hold Laser and drag to aim, hold RAM, or tap Grab to grab and throw.'],
    ['#tutorial', 'This is your <b>Objective</b>. Use your controls to clear each step.'],
  ],
  desktop: [
    ['.key-guide-move', 'This is your <b>Movement</b>: WASD to fly, hold Shift to boost.'],
    ['.key-guide-powers', 'These are your <b>Controls</b>: Space or right mouse button to punch. F or left mouse button to fire your laser along your travel or at your pointer. Hold Q to RAM; E grabs or throws.'],
    ['#tutorial', 'This is your <b>Objective</b>. Press the lit keys to clear each step.'],
  ],
};

// selector: a CSS selector, or a screen rect { left, top, width, height } (something in the game).
function frame(selector) {
  if (typeof selector === 'object' && selector) return selector;
  const rects = [...document.querySelectorAll(selector)].map(el => el.getBoundingClientRect()).filter(r => r.width);
  if (!rects.length) return null;
  const pad = 8;
  const left = Math.min(...rects.map(r => r.left)) - pad, top = Math.min(...rects.map(r => r.top)) - pad;
  return { left, top, width: Math.max(...rects.map(r => r.right)) + pad - left, height: Math.max(...rects.map(r => r.bottom)) + pad - top };
}

// Keep the measured card clear of the spotlight, including on short landscape screens.
export function coachPlacement(rect, cardWidth, cardHeight, width, height, avoid = []) {
  const clamp = (value, size, limit) => Math.max(16, Math.min(limit - size - 16, value));
  const clearControls = layout => {
    const obstacles = [rect, ...avoid];
    const clear = (left, top) => obstacles.every(r => left + cardWidth <= r.left
      || left >= r.left + r.width || top + cardHeight <= r.top || top >= r.top + r.height);
    if (clear(layout.cardLeft, layout.cardTop)) return layout;
    // Try the nearest clear space around both thumb zones, within the viewport.
    const xs = [layout.cardLeft, 16, width - cardWidth - 16,
      ...obstacles.flatMap(r => [r.left - cardWidth - 12, r.left + r.width + 12])].map(x => clamp(x, cardWidth, width));
    const ys = [layout.cardTop, 16, height - cardHeight - 16,
      ...obstacles.flatMap(r => [r.top - cardHeight - 12, r.top + r.height + 12])].map(y => clamp(y, cardHeight, height));
    let best = layout, distance = Infinity;
    for (const left of xs) for (const top of ys) {
      const shift = (left - layout.cardLeft) ** 2 + (top - layout.cardTop) ** 2;
      if (shift < distance && clear(left, top)) {
        best = { ...layout, cardLeft: left, cardTop: top };
        distance = shift;
      }
    }
    return best;
  };
  const right = rect.left + rect.width, bottom = rect.top + rect.height;
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const fitsRight = width - right >= cardWidth + 72;
  const fitsLeft = rect.left >= cardWidth + 72;
  const fitsAbove = rect.top >= cardHeight + 74;
  const fitsBelow = height - bottom >= cardHeight + 78;
  let side;
  if (rect.height > height * 0.45 && (fitsRight || fitsLeft)) side = fitsRight ? 'left' : 'right';
  else if (cy < height / 2 && fitsBelow) side = 'up';
  else if (fitsAbove) side = 'down';
  else if (fitsBelow) side = 'up';
  else if (fitsLeft) side = 'right';
  else if (fitsRight) side = 'left';
  else side = cy < height / 2 ? 'up' : 'down';
  if (side === 'left' || side === 'right') {
    const handLeft = side === 'left' ? right + 6 : rect.left - 46;
    return clearControls({ side, handLeft, handTop: clamp(cy - 20, 40, height),
      cardLeft: clamp(side === 'left' ? right + 56 : rect.left - cardWidth - 56, cardWidth, width),
      cardTop: clamp(cy - cardHeight / 2, cardHeight, height) });
  }
  return clearControls({ side, handLeft: clamp(cx - 20, 40, width),
    handTop: side === 'up' ? bottom + 6 : rect.top - 52,
    cardLeft: clamp(cx - cardWidth / 2, cardWidth, width),
    cardTop: clamp(side === 'up' ? bottom + 62 : rect.top - cardHeight - 58, cardHeight, height) });
}

// '1': played through; 'skipped': completed by reaching heat level 3 (Tutorial.complete).
function remembered() {
  try { return save().getItem(STORAGE_KEY); } catch { return null; }
}

// The tutorial is the first objective: a checklist of steps, then one collapsed free-roam line.
export class Tutorial {
  constructor(element, steps = TUTORIAL_STEPS) {
    this.element = element;
    this.steps = steps;
    const saved = remembered();
    this.skipped = saved === 'skipped';
    this.index = saved === '1' || this.skipped ? steps.length : 0;
    this.progress = 0;
    if (!element) return;
    this.prompt = element.querySelector('.tutorial-prompt');
    this.bar = element.querySelector('.tutorial-bar i');
    this.count = element.querySelector('.tutorial-count');
    this.name = element.querySelector('.objective-name');
    const list = element.querySelector('.objective-steps');
    this.items = steps.map(step => {
      const item = document.createElement('li');
      item.textContent = this.title(step);
      list?.append(item);
      return item;
    });
    if (this.done) this.collapse();
    else this.show();
  }

  // Runs once the touch controls exist, so phone wording and targets are known.
  start(scene) {
    if (!this.element) return;
    // Explicit encounter review links start in the fight without changing the player's saved
    // tutorial progress. Normal play still gets the full first-run introduction.
    const query = new URLSearchParams(globalThis.location?.search ?? '');
    const review = query.has('debug') && /^(?:[1-5]|boss|victory)$/.test(query.get('police') ?? '');
    // The desktop key guide stays up for good, tutorial or not.
    if (!touchPlay() && !review) this.createKeyGuide();
    if (this.done) return;
    if (review) {
      this.index = this.steps.length;
      this.collapse();
      return;
    }
    if (touchPlay()) {
      this.items.forEach((item, i) => { if (this.steps[i].touch === null) item.remove(); });
      this.items = this.items.filter((_, i) => this.steps[i].touch !== null);
      this.steps = this.steps.filter(step => step.touch !== null);
    }
    this.show();
    this.coach(scene, COACH[touchPlay() ? 'touch' : 'desktop']);
  }

  createKeyGuide() {
    this.guide = document.createElement('div');
    this.guide.className = 'key-guide';
    this.guide.setAttribute('aria-hidden', 'true');
    this.guide.innerHTML = KEY_GUIDE.map(([group, keys]) => `<div class="hud-panel key-guide-${group}">${
      keys.map(([key, label, stats]) => `<span data-stats="${stats}"><span class="key">${key}</span>${label}</span>`).join('')}</div>`).join('');
    document.body.append(this.guide);
  }

  // Controls stay off while the spotlight is up; any tap, click or key moves to the next card.
  // delay: ms before input can dismiss a card, so a mid-fight key press doesn't skip it.
  coach(scene, cards, last = 'start', delay = 0) {
    scene.handleControlBlur?.();
    const root = document.createElement('div');
    root.className = 'coach';
    root.setAttribute('role', 'dialog');
    root.innerHTML = '<div class="coach-hole"></div><div class="coach-hand" aria-hidden="true"></div><div class="hud-panel coach-card"><p></p><small></small></div>';
    const [hole, hand, card] = root.children;
    document.body.append(root);
    let index = 0;
    const place = () => {
      const [selector, text] = cards[index];
      const rect = frame(selector) ?? { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
      Object.assign(hole.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      const width = Math.min(280, innerWidth - 32);
      card.firstChild.innerHTML = text;
      const count = cards.length > 1 ? `${index + 1}/${cards.length} · ` : '';
      card.lastChild.textContent = `${count}${touchPlay() ? 'Tap' : 'Click or press any key'} to ${index + 1 < cards.length ? 'continue' : last}`;
      card.style.width = `${width}px`;
      const controls = [...document.querySelectorAll('.touch-pad')].map(el => el.getBoundingClientRect()).filter(r => r.width);
      const layout = coachPlacement(rect, width, card.getBoundingClientRect().height, innerWidth, innerHeight, controls);
      hand.textContent = { left: '👈', right: '👉', up: '👆', down: '👇' }[layout.side];
      hand.className = `coach-hand is-${layout.side}`;
      Object.assign(hand.style, { left: `${layout.handLeft}px`, top: `${layout.handTop}px` });
      Object.assign(card.style, { left: `${layout.cardLeft}px`, top: `${layout.cardTop}px`, bottom: '' });
    };
    const readyAt = performance.now() + delay;
    const next = event => {
      event.preventDefault();
      if (event.repeat || performance.now() < readyAt) return;
      index += 1;
      if (index < cards.length) return place();
      root.remove();
      removeEventListener('keydown', next, true);
      removeEventListener('resize', place);
      scene.handleControlFocus?.();
    };
    root.addEventListener('pointerdown', next);
    addEventListener('keydown', next, true);
    addEventListener('resize', place);
    place();
  }

  // One-time spotlight on the Villainium counter, once the player has picked some up.
  villainiumTip(scene) {
    try {
      if (save().getItem(VILLAINIUM_TIP_KEY)) return;
      save().setItem(VILLAINIUM_TIP_KEY, '1');
    } catch { return; }
    this.coach(scene, [['.villainium-hud', 'Defeated enemies drop <b>Villainium</b>. After you clear the level, spend it in the <b>Shop</b> on the main menu to upgrade your hero\'s stats and abilities: lift heavier objects, fire your laser and RAM for longer, and more.']], 'continue', 500);
  }

  get liftTipSeen() {
    try { return Boolean(save().getItem(LIFT_TIP_KEY)); } catch { return false; }
  }

  // One-time card when the player tries to grab something too heavy (marked orange).
  // rect: where the heavy thing is on screen (CSS px).
  liftTip(scene, rect) {
    if (this.liftTipSeen) return;
    try { save().setItem(LIFT_TIP_KEY, '1'); } catch { /* private mode: show again next time */ }
    this.coach(scene, [[rect, 'Too heavy to lift yet. Upgrade your hero\'s <b>Grab</b> in the <b>Shop</b> on the main menu to lift heavier things like buses and aircraft, then throw them.']], 'continue', 500);
  }

  get done() { return this.index >= this.steps.length; }
  get current() { return this.steps[this.index] ?? null; }

  // Called every hero step with the movement state the hero actually used.
  track(dt, moving, boosting, ramming) {
    if (ramming) this.did('rammed', dt);
    else if (boosting) this.did('boosted', dt);
    else if (moving) this.did('moved', dt);
  }

  // Seconds of moving/boosting, or a count of actions such as punches thrown.
  did(stat, amount = 1) {
    if (this.done) return;
    const step = this.steps[this.index];
    // Boosting and RAM are flying too, so they also clear the move step.
    if (stat !== step.stat && !(step.stat === 'moved' && (stat === 'boosted' || stat === 'rammed'))) return;
    this.progress += amount;
    if (this.bar) this.bar.style.transform = `scaleX(${Math.min(1, this.progress / step.amount)})`;
    if (this.progress < step.amount) return;
    this.index += 1;
    this.progress = 0;
    if (this.done) return this.celebrate(() => this.finish());
    // Game hooks start the next step at once; only the panel waits for the tick.
    this.onStep?.(this.current);
    this.celebrate(() => this.render());
  }

  label(step) {
    return touchPlay() ? step.touch ?? step.text : step.text;
  }

  title(step) {
    return touchPlay() ? this.label(step) : `${step.keys.join(' / ')} · ${step.title ?? step.text}`;
  }

  // Tick the cleared step green, hold a beat, then slide the next one in.
  celebrate(next) {
    if (!this.element) return next();
    const text = this.label(this.steps[this.index - 1]);
    this.items[this.index - 1]?.classList.replace('is-current', 'is-done');
    this.prompt.innerHTML = `<span class="tutorial-check" aria-hidden="true"></span><span>${text}</span>`;
    this.element.dataset.step = `\u2713 ${text}`;
    this.element.classList.remove('is-entering');
    this.element.classList.add('is-cleared');
    clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => {
      this.element.classList.remove('is-cleared');
      next();
      void this.element.offsetWidth; // restart the slide-in
      this.element.classList.add('is-entering');
    }, CLEARED_HOLD);
  }

  show() {
    this.onStep?.(this.current);
    this.render();
  }

  render() {
    if (!this.element) return;
    const step = this.current;
    const text = this.label(step);
    const keys = step.keys.map(key => `<span class="key">${key}</span>`).join('');
    this.prompt.innerHTML = `<span class="tutorial-keys">${keys}</span><span>${text}</span>`;
    this.element.dataset.step = text;
    this.count.textContent = `${this.index}/${this.steps.length}`;
    this.items.forEach((item, i) => {
      item.textContent = this.title(this.steps[i]);
      item.classList.toggle('is-done', i < this.index);
      item.classList.toggle('is-current', i === this.index);
    });
    this.bar.style.transform = `scaleX(${Math.min(1, this.progress / step.amount)})`;
    this.guide?.querySelectorAll('[data-stats]').forEach(chip =>
      chip.classList.toggle('is-current', chip.dataset.stats.split(' ').includes(step.stat)));
  }

  // Skip what's left (the player reached heat level 3 in level 1): the checklist completes as if played.
  complete() {
    if (this.done) return;
    this.skipped = true;
    clearTimeout(this.clearTimer);
    this.element?.classList.remove('is-cleared', 'is-entering');
    this.index = this.steps.length;
    this.progress = 0;
    this.finish();
  }

  finish() {
    try { save().setItem(STORAGE_KEY, this.skipped ? 'skipped' : '1'); } catch { /* private mode: show again next time */ }
    if (!this.element) return;
    this.guide?.querySelectorAll('.is-current').forEach(chip => chip.classList.remove('is-current'));
    this.items.forEach(item => item.classList.add('is-done'));
    this.count.textContent = `${this.steps.length}/${this.steps.length}`;
    this.prompt.innerHTML = '<span>Nice flying. The city is yours.</span>';
    this.element.classList.add('is-complete');
    setTimeout(() => this.collapse(), 2200);
  }

  // The desktop key guide goes for a player who skipped the tutorial and reached heat level 5.
  hideKeyGuide() {
    this.guide?.remove();
    this.guide = null;
  }

  // After the tutorial the panel shrinks to one line so play stays clear.
  collapse() {
    this.element.classList.remove('is-complete');
    this.element.classList.add('is-collapsed');
    this.name.textContent = this.objective ?? 'Defeat Police Response and the Boss';
    this.count.textContent = '';
  }

  // The collapsed line's objective (the campaign level being played).
  setObjective(text) {
    this.objective = text;
    if (this.element?.classList.contains('is-collapsed')) this.name.textContent = text;
  }
}
