const DEAD_ZONE = 0.18;
const BUTTON_THRESHOLD = 0.25;

function stick(axes, offset) {
  const x = Number.isFinite(axes[offset]) ? axes[offset] : 0;
  const y = Number.isFinite(axes[offset + 1]) ? axes[offset + 1] : 0;
  const length = Math.hypot(x, y);
  if (length <= DEAD_ZONE) return { x: 0, y: 0 };
  const magnitude = (Math.min(1, length) - DEAD_ZONE) / (1 - DEAD_ZONE);
  return { x: x / length * magnitude, y: y / length * magnitude };
}

function down(button) {
  return Boolean(button?.pressed || (button?.value ?? 0) >= BUTTON_THRESHOLD);
}

function idleState() {
  return {
    connected: false, index: null, id: null, ready: false, moveX: 0, moveY: 0, aiming: false,
    ram: false, laser: false, punch: false, laserPressed: false, punchPressed: false,
    ramPressed: false, resetPressed: false, grabPressed: false, active: false,
  };
}

// Poll once per render frame; button edges must not repeat in the 120 Hz simulation.
export class GamepadInput {
  constructor(readGamepads = () => globalThis.navigator?.getGamepads?.() ?? null) {
    this.readGamepads = readGamepads;
    this.index = null;
    this.id = null;
    this.enabled = true;
    this.status = 'waiting';
    this.aim = { x: 1, y: 0 };
    this.previous = {};
    this.needsNeutral = true;
    this.state = idleState();
  }

  requireNeutral() {
    this.needsNeutral = true;
    const { connected, index, id } = this.state;
    this.state = { ...idleState(), connected, index, id };
  }

  suspend() {
    this.enabled = false;
    this.requireNeutral();
  }

  resume() {
    this.enabled = true;
    this.requireNeutral();
  }

  poll() {
    let pads;
    try {
      pads = this.readGamepads();
    } catch {
      // Browsers may deny the API through a permissions policy or insecure context.
      pads = null;
    }
    const connected = Array.from(pads ?? []).filter(pad => pad?.connected);
    const standard = connected.filter(pad => pad.mapping === 'standard');
    const pad = standard.find(pad => pad.index === this.index && pad.id === this.id) ?? standard[0];
    this.status = pad ? 'connected' : pads === null ? 'unavailable'
      : connected.length ? 'unmapped' : 'waiting';
    if (!pad) {
      this.index = this.id = null;
      this.requireNeutral();
      this.state = idleState();
      return this.state;
    }

    if (pad.index !== this.index || pad.id !== this.id) {
      this.index = pad.index;
      this.id = pad.id;
      this.aim = { x: 1, y: 0 };
      this.previous = {};
      this.requireNeutral();
    }

    const left = stick(pad.axes, 0);
    const right = stick(pad.axes, 2);
    const buttons = pad.buttons;
    const held = {
      laser: down(buttons[7]), punch: down(buttons[2]),
      ram: down(buttons[3]), reset: down(buttons[9]), grab: down(buttons[5]),
    };
    const neutral = left.x === 0 && left.y === 0 && right.x === 0 && right.y === 0
      && !buttons.some(down);
    if (this.enabled && neutral) this.needsNeutral = false;
    if (!this.enabled || this.needsNeutral) {
      this.previous = held;
      this.state = { ...idleState(), connected: true, index: pad.index, id: pad.id };
      return this.state;
    }

    const dpadX = Number(down(buttons[15])) - Number(down(buttons[14]));
    const dpadY = Number(down(buttons[13])) - Number(down(buttons[12]));
    const length = Math.hypot(dpadX, dpadY);
    const moveX = length ? dpadX / length : left.x;
    const moveY = length ? dpadY / length : left.y;
    const aiming = right.x !== 0 || right.y !== 0;
    const moving = moveX !== 0 || moveY !== 0;
    if (aiming) {
      const length = Math.hypot(right.x, right.y);
      this.aim = { x: right.x / length, y: right.y / length };
    }

    this.state = {
      connected: true, index: pad.index, id: pad.id, ready: true, moveX, moveY, aiming,
      ram: held.ram, laser: held.laser, punch: held.punch,
      laserPressed: held.laser && !this.previous.laser,
      punchPressed: held.punch && !this.previous.punch,
      ramPressed: held.ram && !this.previous.ram,
      resetPressed: held.reset && !this.previous.reset,
      grabPressed: held.grab && !this.previous.grab,
      active: moving || aiming || Object.values(held).some(Boolean),
    };
    this.previous = held;
    return this.state;
  }
}
