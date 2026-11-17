const clamp = value => Math.max(0, Math.min(1, value));
const lifetime = ramming => ramming ? 0.12 : 0.17;

// Sample in simulation time. Old airflow stays on the travelled path as the hero turns away.
export class HeroFlightWake {
  constructor() {
    this.reset();
  }

  reset() {
    this.samples = [];
    this.previous = null;
    this.emitting = false;
    this.run = 0;
    this.pressure = 0;
  }

  update(dt, hero, velocity, boosting, ramming) {
    for (const sample of this.samples) sample.age += dt;
    this.samples = this.samples.filter(sample => sample.age < lifetime(sample.ramming));
    const distance = this.previous ? Math.hypot(hero.x - this.previous.x, hero.y - this.previous.y) : 0;
    // A reset/teleport must never draw a line across the arena.
    if (distance > 80) this.reset();
    this.previous = { x: hero.x, y: hero.y };
    const speed = Math.hypot(velocity.x, velocity.y);
    const strength = clamp((speed - 55) / 160);
    const emitting = (boosting || ramming) && strength > 0 && distance > 0.01 && distance <= 80;
    this.pressure += ((ramming && emitting ? strength : 0) - this.pressure)
      * (1 - Math.exp(-24 * dt));
    if (emitting) {
      if (!this.emitting) this.run++;
      const dx = velocity.x / speed;
      const dy = velocity.y / speed;
      this.samples.push({ x: hero.x - dx * 9, y: hero.y - dy * 9,
        dx, dy, age: 0, strength, ramming, run: this.run });
    }
    this.emitting = emitting;
  }

  draw(graphics, hero, velocity, leadingHand) {
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1];
      const b = this.samples[i];
      if (a.run !== b.run || a.ramming !== b.ramming) continue;
      const fade = (1 - a.age / lifetime(a.ramming)) ** 1.6 * a.strength;
      const lanes = a.ramming ? [-1, 0, 1] : [-1, 1];
      for (const lane of lanes) {
        const offset = lane * (a.ramming ? 3 : 4.5);
        const core = a.ramming && lane === 0;
        graphics.lineStyle(a.ramming && !core ? 2 : 1,
          core ? 0xfff6cc : a.ramming ? 0xffd66d : 0xc9f2ff,
          fade * (core ? 0.45 : a.ramming ? 0.62 : 0.42));
        graphics.lineBetween(a.x - a.dy * offset, a.y + a.dx * offset,
          b.x - b.dy * offset, b.y + b.dx * offset);
      }
    }
    const speed = Math.hypot(velocity.x, velocity.y);
    if (this.pressure < 0.01 || speed < 8) return;
    const dx = velocity.x / speed;
    const dy = velocity.y / speed;
    const angle = leadingHand?.angle ?? Math.atan2(dy, dx);
    const nose = leadingHand ?? { x: hero.x + dx * 14, y: hero.y + dy * 14 };
    graphics.lineStyle(1, 0xffecaa, this.pressure * 0.7);
    graphics.beginPath();
    graphics.arc(nose.x - Math.cos(angle), nose.y - Math.sin(angle),
      6, angle - 1, angle + 1);
    graphics.strokePath();
  }
}
