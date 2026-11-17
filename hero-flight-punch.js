const HITS = [
  { duration: 0.26, windup: 0.06, snap: 0.025, hold: 0.045,
    distance: 2, stepDuration: 0.08, lean: 0.2 },
  { duration: 0.3, windup: 0.08, snap: 0.03, hold: 0.06,
    distance: 3, stepDuration: 0.1, lean: 0.4 },
  { duration: 0.52, windup: 0.17, snap: 0.035, hold: 0.08,
    distance: 0, lean: 1 },
];
const COMBO_GRACE = 0.32;
const ARM_LOADS = [[1.5, 1.6], [0.7, 3.5], [0.6, 2.5]];
const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => (t = clamp(t)) * t * (3 - 2 * t);
const snap = t => 1 - (1 - clamp(t)) ** 3;
const difference = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const mix = (a, b, t) => a + (b - a) * t;

// Keep each bone's winding through the whole gesture. Choosing a new shortest
// arc every draw flips the elbow when a moving wrist crosses the opposite angle.
const unwrap = (angle, previous) => previous === undefined ? angle
  : angle + Math.round((previous - angle) / (Math.PI * 2)) * Math.PI * 2;

export function reachArm(limb, hand, side, weight, blend, load = hand) {
  const dx = hand[0] - limb.arm[0];
  const dy = hand[1] - limb.arm[1];
  const length = Math.hypot(dx, dy);
  const distance = Math.max(0.1, Math.min(6, length));
  const direction = Math.atan2(dy, dx);
  const bend = Math.acos(distance / 6) * side;
  blend.upper = unwrap(Math.atan2(limb.elbow[1] - limb.arm[1], limb.elbow[0] - limb.arm[0]), blend.upper);
  blend.fore = unwrap(Math.atan2(limb.hand[1] - limb.elbow[1], limb.hand[0] - limb.elbow[0]), blend.fore);
  if (blend.upperTarget === undefined) {
    // Choose the route toward the loaded fist before blending out of rest.
    // Otherwise the cheek guard can send a forearm the long way around to its load.
    const lx = load[0] - limb.arm[0], ly = load[1] - limb.arm[1];
    const loadAngle = Math.atan2(ly, lx);
    const loadBend = Math.acos(Math.max(0.1, Math.min(6, Math.hypot(lx, ly))) / 6) * side;
    blend.upperTarget = unwrap(loadAngle + loadBend, blend.upper);
    blend.foreTarget = unwrap(loadAngle - loadBend, blend.fore);
  }
  blend.upperTarget = unwrap(direction + bend, blend.upperTarget);
  blend.foreTarget = unwrap(direction - bend, blend.foreTarget);
  const upperAngle = mix(blend.upper, blend.upperTarget, weight);
  const foreAngle = mix(blend.fore, blend.foreTarget, weight);
  limb.elbow = [limb.arm[0] + Math.cos(upperAngle) * 3,
    limb.arm[1] + Math.sin(upperAngle) * 3];
  limb.hand = [limb.elbow[0] + Math.cos(foreAngle) * 3,
    limb.elbow[1] + Math.sin(foreAngle) * 3];
}

// One buffered click keeps rapid input responsive without queuing a long flurry.
export class HeroPunch {
  constructor() {
    this.active = false;
    this.combo = 0;
    this.time = 0;
    this.grace = 0;
    this.queued = false;
    this.angle = 0;
    this.motion = { x: 0, y: 0 };
    this.impact = 0;
    this.stance = 0;
    this.attackId = 0;
    this.hitPause = 0;
    this.armBlends = [];
  }

  request() {
    if (this.active) {
      this.queued = true;
      return;
    }
    this.start(this.grace > 0 ? (this.combo + 1) % 3 : 0);
  }

  start(combo) {
    this.attackId++;
    this.combo = combo;
    this.time = 0;
    this.active = true;
    this.queued = false;
    this.grace = 0;
    this.hitPause = 0;
    this.armBlends = [];
  }

  pauseOnContact(seconds) {
    if (this.active) this.hitPause = Math.max(this.hitPause, seconds);
  }

  update(dt) {
    this.motion = { x: 0, y: 0 };
    this.impact = 0;
    const paused = Math.min(dt, this.hitPause);
    this.hitPause -= paused;
    dt -= paused;
    if (dt <= 0) return;
    const wasFighting = this.active || this.grace > 0;
    let remaining = dt;
    while (this.active && remaining > 0) {
      const hit = this.hit;
      const previous = this.time;
      // A follow-up can take over late recovery without changing the pose's clock.
      const end = this.queued ? Math.max(previous, this.chainTime) : hit.duration;
      const spent = Math.min(remaining, end - previous);
      this.time += spent;
      remaining -= spent;
      const travel = t => smooth((t - hit.windup) / (hit.stepDuration ?? hit.snap)) * hit.distance
        - (hit.retreat ?? 0) * smooth(t / hit.windup);
      const distance = travel(this.time) - travel(previous);
      this.motion.x += Math.cos(this.angle) * distance;
      this.motion.y += Math.sin(this.angle) * distance;
      if (hit.lift) {
        const recoveryStart = hit.windup + hit.snap + hit.hold;
        const height = t => hit.lift * (smooth(t / hit.windup)
          - smooth((t - recoveryStart) / (hit.duration - recoveryStart)));
        this.motion.y -= height(this.time) - height(previous);
      }
      const contact = hit.windup + hit.snap;
      if (previous < contact && this.time >= contact) this.impact = this.combo + 1;
      if (this.time < end) break;
      if (this.queued) this.start((this.combo + 1) % 3);
      else {
        this.active = false;
        this.grace = this.guardGrace;
      }
    }
    if (!this.active) this.grace = Math.max(0, this.grace - remaining);
    const stanceTarget = wasFighting ? 1 : 0;
    const stanceStep = dt / (wasFighting ? 0.06 : this.guardRelease);
    this.stance += Math.max(-stanceStep, Math.min(stanceStep, stanceTarget - this.stance));
  }

  aim(angle) {
    // Track the cursor during anticipation, then commit through the fast strike.
    if (!this.active || this.time < this.hit.windup) this.angle = angle;
  }

  get hit() { return HITS[this.combo]; }
  get chainTime() { return this.hit.duration; }
  get guardGrace() { return COMBO_GRACE; }
  get guardRelease() { return 0.18; }
  get armIndex() { return this.combo === 1 ? 0 : 1; }

  get weight() {
    if (!this.active) return { wind: 0, drive: 0, guard: this.stance, recovery: 1 };
    const { windup, snap: extension, hold, duration } = this.hit;
    const strike = snap((this.time - windup) / extension);
    const recovery = smooth((this.time - windup - extension - hold)
      / (duration - windup - extension - hold));
    return {
      wind: smooth(this.time / windup) * (1 - strike),
      drive: strike * (1 - recovery),
      guard: this.stance,
      recovery,
    };
  }

  bodyPose(base) {
    if (!this.active && this.stance === 0) return base;
    const { wind, drive, guard } = this.weight;
    const p = { ...base };
    // Keep the normal flight leg lengths through anticipation, contact and recovery.
    p.flightLegExtension = 2 * clamp(base.posture) * Math.abs(Math.cos(base.spine));
    const lean = difference(base.spine, this.angle);
    const tilt = (this.combo === 2 ? lean : Math.max(-1.35, Math.min(1.35, lean)))
      * this.hit.lean * drive
      - Math.cos(this.angle) * wind * 0.12;
    p.spine += tilt;
    // Neck, chest and shoulders rotate together around the hips.
    p.neckX = base.neckX * Math.cos(tilt) - base.neckY * Math.sin(tilt);
    p.neckY = base.neckX * Math.sin(tilt) + base.neckY * Math.cos(tilt);
    if (this.combo === 2) {
      const pitch = Math.atan2(Math.sin(this.angle), Math.abs(Math.cos(this.angle)));
      p.headRotation += difference(base.headRotation, pitch) * drive;
      p.punchDrive = drive;
    }
    p.leg += tilt;
    p.kneeBend = base.kneeBend;
    // Fold the wide guard into a tight, arrow-straight Superman flight line.
    p.punchBrace = guard * (this.combo === 2 ? 1 - drive * 0.96 : 1 - drive * 0.15);
    // The cape whips back as the whole body drives through the strike.
    p.capeAngle += difference(base.capeAngle, this.angle + Math.PI) * drive * 0.85;
    p.trailX -= Math.cos(this.angle) * drive;
    p.trailY -= Math.sin(this.angle) * drive;
    return p;
  }

  apply(limbs, face, pose) {
    if (!this.active && this.stance === 0) return limbs;
    const { wind, drive, guard, recovery } = this.weight;
    const dx = Math.cos(this.angle);
    const dy = Math.sin(this.angle);
    const spine = pose?.spine ?? this.angle;
    const bodyX = Math.cos(spine);
    const bodyY = Math.sin(spine);
    const side = pose?.armSide ?? face;
    // The guard belongs to the torso. Only the punching fist follows aim;
    // steering within the flight cone must not swing the defensive arm.
    const target = (limb, forward, across) => [
      limb.arm[0] + bodyX * forward - bodyY * across * side,
      limb.arm[1] + bodyY * forward + bodyX * across * side,
    ];
    for (let i = 0; i < limbs.length; i++) {
      const limb = limbs[i];
      const front = i === 1;
      let hand;
      let load;
      if (this.active && i === this.armIndex) {
        // Roll the rear shoulder across the chest, keeping the sleeve attached.
        const aimSwing = Math.max(-0.5, Math.min(0.5, Math.sin(difference(spine, this.angle))));
        const shoulderRoll = this.combo === 0 ? 1.3 + 4.4 * aimSwing ** 2
          : this.combo === 1 ? 2.7 : front ? 1.65 : 3.65;
        const roll = drive * shoulderRoll - wind * 0.35;
        const inward = front ? 0 : drive * 1.15;
        const shoulderLift = inward * side + aimSwing * drive * 2;
        const shiftX = (bodyX * roll - bodyY * shoulderLift) * guard;
        const shiftY = (bodyY * roll + bodyX * shoulderLift) * guard;
        // Translate the whole starting arm before solving it, preserving its angles.
        for (const joint of ['arm', 'elbow', 'hand']) {
          limb[joint] = [limb[joint][0] + shiftX, limb[joint][1] + shiftY];
        }
        const ready = target(limb, front ? 2.8 : 1.2, front ? 0.8 : 3.2);
        const cock = target(limb, ...ARM_LOADS[this.combo]);
        load = cock;
        // A nearly straight elbow avoids a mechanical lock at full extension.
        const strike = [limb.arm[0] + dx * 5.96, limb.arm[1] + dy * 5.96];
        if (recovery > 0) {
          // Pull the elbow back first, then settle the fist into the cheek guard.
          const retract = smooth(recovery / 0.7);
          const settle = smooth((recovery - 0.45) / 0.55);
          hand = [mix(mix(strike[0], cock[0], retract), ready[0], settle),
            mix(mix(strike[1], cock[1], retract), ready[1], settle)];
        } else {
          hand = [mix(mix(ready[0], cock[0], wind), strike[0], drive),
            mix(mix(ready[1], cock[1], wind), strike[1], drive)];
        }
      } else {
        // Counterbalance the cross; tuck the spare fist at the ribs on the drive.
        const tuck = this.active ? drive : 0;
        hand = target(limb, front ? 2.8 - tuck * 0.8 : 1.2 - tuck * (this.combo === 2 ? 3.4 : 0.8),
          front ? 0.8 + tuck * 0.5 : 3.2 + tuck * 0.3);
      }
      reachArm(limb, hand, side, smooth(guard), this.armBlends[i] ??= {}, load);
    }
    return limbs;
  }
}
