// DOM controls stay in CSS pixels, independent of the game's device-pixel renderer.
// Each pad owns one pointer so moving, aiming and powers can be held together.
export class TouchInput {
  constructor(onAction = () => {}, allowed = () => true) {
    this.onAction = onAction;
    this.allowed = allowed;
    this.x = this.y = this.reach = 0;
    this.throwAim = null;
    this.aim = { x: 1, y: 0 };
    this.aiming = false;
    this.punch = this.laser = this.ram = false;
    this.pointers = new Map();
  }

  press(kind, id, x, y) {
    if (!this.allowed() || this.pointers.has(kind)) return false;
    this.pointers.set(kind, { id, x, y });
    if (kind === 'move') this.move(kind, id, x, y);
    else {
      // Punch goes where you fly (the stick); only the laser is aimed by dragging its pad.
      if (kind === 'punch') this.punch = true;
      if (kind === 'laser') {
        this.laser = true;
        this.aiming = true;
        if (Math.hypot(this.x, this.y) > 0.1) {
          const length = Math.hypot(this.x, this.y);
          this.aim.x = this.x / length; this.aim.y = this.y / length;
        }
      }
      if (kind === 'ram') this.ram = true;
      if (kind === 'grab') this.throwAim = null;
      this.onAction(kind, true);
    }
    return true;
  }

  move(kind, id, x, y, radius = 48) {
    const pointer = this.pointers.get(kind);
    if (!pointer || pointer.id !== id) return;
    const dx = x - pointer.x, dy = y - pointer.y, length = Math.hypot(dx, dy);
    if (kind === 'move') {
      const strength = Math.max(0, Math.min(1, (length - 5) / (radius - 5)));
      this.x = length ? dx / length * strength : 0;
      this.y = length ? dy / length * strength : 0;
      // How far the thumb is dragged in stick radii; past 1 it is beyond the full-speed edge.
      this.reach = length / radius;
    } else if (kind === 'laser' && length > 9) {
      this.aim.x = dx / length; this.aim.y = dy / length;
      this.onAction('aim', true);
    } else if (kind === 'grab' && length > 9) {
      // Dragging Grab while carrying aims the throw that happens on release.
      this.throwAim = { x: dx / length, y: dy / length };
    }
  }

  release(kind, id) {
    if (this.pointers.get(kind)?.id !== id) return;
    this.pointers.delete(kind);
    if (kind === 'move') this.x = this.y = this.reach = 0;
    else {
      if (kind in this) this[kind] = false;
      this.aiming = this.laser;
      this.onAction(kind, false);
    }
  }

  reset() {
    for (const [kind, pointer] of this.pointers) this.release(kind, pointer.id);
    this.x = this.y = 0;
    this.aiming = this.punch = this.laser = this.ram = false;
  }
}

const TOUCH_ZOOM = 1.3225;
const DESKTOP_ZOOM = 1.1;
// Boost needs 25% less drag than the original 1.3 radii; the knob turns gold to show it.
export const BOOST_REACH = 0.975;

export function altitudeZoomLimit(minZoom, touch = false) {
  // Reduce the original zoom-out range by 10% on mobile and 25% on desktop.
  return 1 - (1 - minZoom) * (touch ? 0.9 : 0.75);
}

export function viewZoom(width, height, viewHeight, touch = false) {
  // A phone frames the short edge, rather than squeezing an entire desktop width
  // into portrait. Use device dimensions on both sides so DPR never changes framing.
  // Phones sit 32.25% closer than the short edge alone gives, so the hero reads on a small screen.
  return touch ? TOUCH_ZOOM * Math.min(width, height) / Math.min(viewHeight, 400)
    : DESKTOP_ZOOM * Math.min(width / (viewHeight * 16 / 9), height / viewHeight);
}

export function createTouchControls(scene) {
  // Touch controls only for a coarse (touch) primary pointer.
  if (!window.matchMedia?.('(pointer: coarse)').matches) return null;
  const state = new TouchInput((kind, down) => scene.handleTouchAction(kind, down),
    () => !scene.controlsSuspended && !scene.enemies?.defeated);
  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Touch flight and powers');
  document.body.classList.add('touch-play');
  const resets = [];
  for (const [kind, label] of [['move', 'Move'], ['punch', 'Punch'], ['laser', 'Laser'], ['grab', 'Grab / throw'], ['ram', 'RAM']]) {
    const pad = document.createElement('button');
    pad.type = 'button'; pad.className = `touch-pad touch-${kind}`;
    pad.setAttribute('aria-label', kind === 'laser' ? `${label}: hold and drag to aim` : label);
    const aims = kind === 'laser';
    const dotted = aims || kind === 'grab';
    // Move shows its knob; the laser shows a small dot on its rim pointing where it fires.
    pad.innerHTML = `<span>${label}</span>${kind === 'move' ? '<i></i>' : dotted ? '<b class="aim-dot"></b>' : ''}`;
    if (kind === 'grab') state.grabPad = pad;
    root.append(pad);
    // iOS can still reserve double taps / long presses despite touch-action.
    // These pads use pointer events, so they need no synthetic browser click.
    const preventGesture = event => event.preventDefault();
    for (const type of ['touchstart', 'touchmove', 'touchend']) {
      pad.addEventListener(type, preventGesture, { passive: false });
    }
    const paint = () => {
      pad.classList.toggle('is-held', state.pointers.has(kind));
      if (kind === 'move') { pad.classList.toggle('is-boost', state.reach > BOOST_REACH); const reach = pad.clientWidth * 0.34; pad.lastElementChild.style.transform = `translate(${state.x * reach}px,${state.y * reach}px)`; }
      if (aims && state.pointers.has(kind)) {
        const rim = pad.clientWidth / 2 - 7;
        pad.lastElementChild.style.transform = `translate(${state.aim.x * rim}px,${state.aim.y * rim}px)`;
      }
    };
    const release = event => {
      state.release(kind, event.pointerId); paint();
    };
    pad.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      if (!state.press(kind, event.pointerId, event.clientX, event.clientY)) return;
      pad.setPointerCapture(event.pointerId); paint();
    });
    pad.addEventListener('pointermove', event => {
      state.move(kind, event.pointerId, event.clientX, event.clientY); paint();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, release);
    pad.addEventListener('contextmenu', event => event.preventDefault());
    resets.push(() => {
      pad.classList.remove('is-held');
      if (kind === 'move') pad.lastElementChild.style.transform = '';
      for (const pointer of state.pointers.values()) {
        if (pad.hasPointerCapture(pointer.id)) pad.releasePointerCapture(pointer.id);
      }
    });
  }
  const hint = document.createElement('p');
  hint.textContent = 'STICK TO RIM: BOOST · PUNCH WHERE YOU FLY · DRAG LASER TO AIM';
  root.append(hint);
  document.body.append(root);
  const clear = state.reset.bind(state);
  state.reset = () => { resets.forEach(reset => reset()); clear(); };
  // While the hero carries someone, Grab's dot previews the throw (the stick direction).
  let throwDot = '';
  state.showThrow = direction => {
    const pad = state.grabPad;
    pad.classList.toggle('is-aiming', Boolean(direction));
    if (!direction) return;
    const rim = pad.clientWidth / 2 - 7;
    const transform = `translate(${Math.round(direction.x * rim)}px,${Math.round(direction.y * rim)}px)`;
    if (transform !== throwDot) pad.lastElementChild.style.transform = throwDot = transform;
  };
  const hidden = () => { if (document.hidden) state.reset(); };
  window.addEventListener('blur', state.reset);
  window.addEventListener('resize', state.reset);
  document.addEventListener('visibilitychange', hidden);
  scene.events.once('shutdown', () => {
    state.reset(); root.remove(); document.body.classList.remove('touch-play');
    window.removeEventListener('blur', state.reset);
    window.removeEventListener('resize', state.reset);
    document.removeEventListener('visibilitychange', hidden);
  });
  return state;
}
