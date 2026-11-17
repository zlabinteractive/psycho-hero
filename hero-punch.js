import { HERO_PROPORTIONS } from './hero-art.js';
import { COMBAT } from './hero-combat.js';
// Share the flight timing/body choreography and its directional arm animation.
import { HeroPunch as FlightPunch, reachArm } from './hero-flight-punch.js';

const difference = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const mix = (a, b, t) => a + (b - a) * t;
const mixAngle = (a, b, t) => a + difference(a, b) * t;
const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => (t = clamp(t)) * t * (3 - 2 * t);

function tuckLeg(limb, forward, drop, face, weight) {
  const dx = face * forward;
  const dy = drop;
  const distance = Math.min(6.99, Math.hypot(dx, dy));
  const ux = dx / Math.hypot(dx, dy);
  const uy = dy / Math.hypot(dx, dy);
  const bend = Math.sqrt(Math.max(0, 3.5 ** 2 - distance ** 2 / 4));
  // Knees lead toward the opponent while the shins fold back under the hips.
  const knee = [limb.hip[0] + ux * distance / 2 + uy * bend * face,
    limb.hip[1] + uy * distance / 2 - ux * bend * face];
  const foot = [limb.hip[0] + ux * distance, limb.hip[1] + uy * distance];
  const angle = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const upper = mixAngle(angle(limb.hip, limb.knee), angle(limb.hip, knee), weight);
  const lower = mixAngle(angle(limb.knee, limb.foot), angle(knee, foot), weight);
  const boot = mixAngle(angle(limb.foot, limb.toe), Math.atan2(0.5, face * 1.4), weight);
  limb.knee = [limb.hip[0] + Math.cos(upper) * 3.5,
    limb.hip[1] + Math.sin(upper) * 3.5];
  limb.foot = [limb.knee[0] + Math.cos(lower) * 3.5,
    limb.knee[1] + Math.sin(lower) * 3.5];
  limb.toe = [limb.foot[0] + Math.cos(boot) * 1.5,
    limb.foot[1] + Math.sin(boot) * 1.5];
}

// Every press is heavy; alternating arms gives repeats a rhythm without a damage combo.
export class HeroPunch extends FlightPunch {
  constructor() {
    super();
    this.variant = 'upright';
    this.queuedVariant = null;
    this.aimSource = 'mouse';
    this.queuedAimSource = null;
    this.dashDistance = COMBAT.punch.missDistance;
    this.dashControl = 1;
    this.dashStopped = false;
    this.strikingArm = 0;
    this.contacted = false;
    this.target = null;
    this.targetAssigned = false;
    this.queuedTarget = undefined;
  }

  request(variant = 'upright', aimSource = 'mouse', target = undefined) {
    if (this.active) {
      this.queued = true;
      this.queuedVariant = variant;
      this.queuedAimSource = aimSource;
      this.queuedTarget = target;
      return;
    }
    this.start(2, variant, aimSource, target);
  }

  start(combo, variant, aimSource, target) {
    // The shared animation clock starts buffered attacks here as well.
    if (variant === undefined) {
      variant = this.queuedVariant ?? this.variant;
    }
    aimSource ??= this.queuedAimSource ?? this.aimSource;
    if (target === undefined) target = this.queuedTarget;
    super.start(2);
    this.strikingArm = 1 - this.strikingArm;
    this.variant = variant;
    this.queuedVariant = null;
    this.aimSource = aimSource;
    this.queuedAimSource = null;
    this.target = target ?? null;
    this.targetAssigned = target !== undefined;
    this.queuedTarget = undefined;
    this.dashDistance = COMBAT.punch.missDistance;
    this.dashControl = 1;
    this.dashStopped = false;
    this.contacted = false;
  }

  get hit() { return { ...COMBAT.punch, distance: this.dashDistance, lean: 1 }; }
  get armIndex() { return this.strikingArm; }
  get chainTime() { return COMBAT.punch.chainTime; }
  get guardGrace() { return 0.04; }
  get guardRelease() { return 0.10; }

  get weight() {
    const weight = super.weight;
    if (!this.active) return weight;
    // The fist and body displacement share one drive curve, reaching forward together.
    const extension = smooth((this.time - this.hit.windup) / this.hit.snap);
    return { ...weight, wind: smooth(this.time / this.hit.windup) * (1 - extension),
      drive: extension * (1 - weight.recovery) };
  }

  get canHit() {
    return this.active && !this.contacted && this.weight.drive >= 0.65
      && this.time <= this.hit.windup + this.hit.snap + this.hit.hold;
  }

  contact() {
    this.stopDash();
    this.contacted = true;
    // Contact owns the visual payoff, even when a nearby target intercepts extension.
    this.time = Math.max(this.time, this.hit.windup + this.hit.snap);
    this.stance = 1;
    this.impact = 0;
    this.pauseOnContact(COMBAT.punch.hitStop);
  }

  stopDash() {
    this.dashStopped = true;
    this.motion = { x: 0, y: 0 };
  }

  update(dt) {
    super.update(dt);
    if (this.dashStopped) this.motion = { x: 0, y: 0 };
  }

  bodyPose(base) {
    if (this.variant === 'flight') return super.bodyPose(base);
    if (!this.active && this.stance === 0) return base;
    const { wind, drive, guard } = this.weight;
    const p = { ...base };
    const face = Math.abs(Math.cos(this.angle)) > 0.15 ? Math.sign(Math.cos(this.angle)) : base.face;
    const upright = -Math.PI / 2;
    // Lean with the horizontal component of the strike. A shortest-angle turn
    // from upright changes sign at straight down and flips the torso by 108°.
    const horizontal = Math.cos(this.angle);
    const combatSpine = upright + horizontal * (drive * Math.PI * 0.15 + 0.06 - wind * 0.18);
    p.spine = mixAngle(base.spine, combatSpine, guard);
    const tilt = difference(base.spine, p.spine);
    p.combatPose = guard;
    // Use the flight punch's shoulder spacing and leg tuck in either movement state.
    p.posture = mix(base.posture, 1, guard);
    // Neck, chest and shoulders rotate together around the hips.
    // Share the extended flight proportions so the body size stays consistent.
    const neckReach = HERO_PROPORTIONS.extendedNeckReach;
    p.neckX = mix(base.neckX * Math.cos(tilt) - base.neckY * Math.sin(tilt),
      Math.cos(p.spine) * neckReach, guard);
    p.neckY = mix(base.neckX * Math.sin(tilt) + base.neckY * Math.cos(tilt),
      Math.sin(p.spine) * neckReach, guard);
    p.leg = mixAngle(base.leg, Math.PI / 2 + horizontal * (wind * 0.1 - drive * 0.25), guard);
    p.kneeBend += guard * 0.2 + wind * 0.35;
    p.punchBrace = guard;
    // The reference cape hangs diagonally behind the airborne guard.
    const cape = mixAngle(Math.atan2(1, -face * 0.7), this.angle + Math.PI, drive * 0.65);
    p.capeAngle = mixAngle(base.capeAngle, cape, guard);
    p.trailX = mix(base.trailX, -face * 0.45, guard);
    p.trailY = mix(base.trailY, 0.65, guard);
    return p;
  }

  apply(limbs, face, pose) {
    if (this.variant === 'flight') return super.apply(limbs, face, pose);
    if (!this.active && this.stance === 0) return limbs;
    const { wind, drive, guard, recovery } = this.weight;
    const dx = Math.cos(this.angle);
    const dy = Math.sin(this.angle);
    const target = (limb, forward, across) => [
      limb.arm[0] + dx * forward - dy * across * face,
      limb.arm[1] + dy * forward + dx * across * face,
    ];
    for (let i = 0; i < limbs.length; i++) {
      const limb = limbs[i];
      tuckLeg(limb, i === 1 ? 1.4 - drive : -1.6 - drive,
        i === 1 ? 3 + drive - wind * 0.5 : 5.7 - wind * 0.5, face, guard);
      const ready = target(limb, i === 1 ? 2.5 : -1.1, i === 1 ? -3.5 : -2);
      if (this.active && i === this.armIndex) {
        // Shoulder rotation brings the cross out from behind the chest.
        const shoulder = (drive * (i === 0 ? 3.5 : 1.8) - wind * 0.7) * guard;
        for (const joint of ['arm', 'elbow', 'hand']) {
          limb[joint] = [limb[joint][0] + dx * shoulder, limb[joint][1] + dy * shoulder];
        }
        // Keep the loaded fist beside the cheek. Passing too close to the
        // shoulder makes the elbow whip around as the fist extends/retracts.
        const cock = target(limb, i === 0 ? -2.2 : -1.6, -3);
        const strike = target(limb, 6, 0);
        const settled = target(limb, i === 1 ? 2.5 : -1.1, i === 1 ? -3.5 : -2);
        let hand;
        if (recovery > 0) {
          const retract = smooth(recovery / 0.65);
          const settle = smooth((recovery - 0.35) / 0.65);
          const recoil = target(limb, 0.7, -3.2);
          hand = [mix(mix(strike[0], recoil[0], retract), settled[0], settle),
            mix(mix(strike[1], recoil[1], retract), settled[1], settle)];
        } else {
          const loaded = [mix(settled[0], cock[0], wind), mix(settled[1], cock[1], wind)];
          hand = [mix(loaded[0], strike[0], drive), mix(loaded[1], strike[1], drive)];
        }
        reachArm(limb, hand, face, smooth(guard), this.armBlends[i] ??= {}, cock);
      } else {
        reachArm(limb, ready, face, smooth(guard), this.armBlends[i] ??= {});
      }
    }
    return limbs;
  }
}
