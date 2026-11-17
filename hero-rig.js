import { ART_RESOLUTION, HeroArtwork, HERO_PROPORTIONS } from './hero-art.js';
import { HeroPunch } from './hero-punch.js';
import { reachArm } from './hero-flight-punch.js';

// All pose coordinates remain in logical game pixels around the pelvis.
const NECK_LIMIT = Math.PI / 5; // A brief 36-degree lead; the chest catches up.
const HOVER_LOOK_UP = Math.PI * 55 / 180;
const HOVER_LOOK_DOWN = Math.PI * 40 / 180;
const FLIGHT_AIM_LIMIT = Math.PI / 6;
const FLIGHT_AIM_HYSTERESIS = Math.PI / 360;
const MAX_HIP_SWING = Math.PI * 18 / 180;
const HOVER_KNEE_BEND = Math.PI * 6 / 180;
const BRACED_KNEE_BEND = Math.PI * 24 / 180;
const LANDING_HOLD = 1.5;
const LANDING_RISE = 0.2;
// Under a load held overhead the hero can only glance up, and stands braced.
const CARRY_LOOK_UP = Math.PI * 15 / 180;
const CARRY_KNEE_BEND = Math.PI * 14 / 180;

const difference = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// A moving neck can shift pointer aim slightly at the edge of the cone.
const flightAim = (target, travel, extended = false) => Math.abs(difference(travel, target))
  <= FLIGHT_AIM_LIMIT + (extended ? FLIGHT_AIM_HYSTERESIS : 0) + 1e-9;
const punchVariant = (rig, target, velocity) => rig.flight > 0.5 && rig.pose.posture > 0.35
  && flightAim(target, Math.atan2(velocity.y, velocity.x), true) ? 'flight' : 'upright';
function turnToward(current, target, maxSpeed, dt, response = 18) {
  const step = difference(current, target) * (1 - Math.exp(-response * dt));
  return current + clamp(step, -maxSpeed * dt, maxSpeed * dt);
}

const landingAngle = (from, target, face, weight) => from
  + difference(from, face > 0 ? target : Math.PI - target) * weight;

function joints(pose, flight) {
  const extend = (point, angle, length) => [
    point[0] + Math.cos(angle) * length,
    point[1] + Math.sin(angle) * length,
  ];
  const pelvis = extend([0, 0], pose.spine + Math.PI, 2);
  const shoulder = extend([0, 0], pose.spine, 2);
  // Keep the boots one colored pixel beyond the cape in horizontal flight,
  // including the punch guard. Upright hover and upright punches keep their size.
  const horizontalFlight = clamp(pose.posture, 0, 1)
    * Math.abs(Math.cos(pose.spine)) * (1 - (pose.combatPose ?? 0));
  const flightLegExtension = pose.flightLegExtension ?? horizontalFlight * 2;
  const flightBend = clamp((pose.posture - 0.35) / 0.65, 0, 1)
    * (1 - (pose.combatPose ?? 0));
  const landing = pose.landingCrouch ?? 0;
  return [-1, 1].map((side) => {
    const brace = pose.punchBrace ?? 0;
    const tuck = Math.max(brace, pose.punchDrive ?? 0);
    const punchTuck = tuck > 0.001;
    const split = punchTuck ? 0 : 1;
    const hoverLegGap = (punchTuck ? 1 - clamp(pose.posture ?? flight, 0, 1) : 1)
      * (1 - flightBend);
    const flex = clamp(pose.kneeBend + side * Math.PI * 2 / 180 * split,
      Math.PI * 4 / 180,
      Math.PI * (26 + Math.max(pose.punchBrace ?? 0, pose.landingCrouch ?? 0) * 45) / 180);
    // Bring the hips together as flight extends, then bend the foreground knee.
    const hip = extend(pelvis, pose.leg + Math.PI / 2, side * pose.hipsFace * hoverLegGap);
    const leg = pose.leg + side * pose.hipsFace * brace * split * 0.5;
    let thighAngle = leg - pose.hipsFace * flex * 0.45;
    let shinAngle = leg + pose.hipsFace * flex * 0.55;
    const shinLength = 3.5 + flightLegExtension;
    if (side > 0 && flightBend > 0) {
      // Let the foreground knee dip below the straight leg, then bring the
      // boot back onto the flight line. Keep both bone lengths unchanged.
      const reach = 3.5 + shinLength - 1;
      const kneeReach = (3.5 ** 2 + reach ** 2 - shinLength ** 2) / (2 * reach);
      const bentThigh = leg - pose.hipsFace * Math.acos(kneeReach / 3.5);
      const bentShin = leg + pose.hipsFace * Math.acos((reach - kneeReach) / shinLength);
      thighAngle += difference(thighAngle, bentThigh) * flightBend;
      shinAngle += difference(shinAngle, bentShin) * flightBend;
    }
    // Three-point landing: foreground boot forward, rear knee planted and ankle trailing.
    // Interpolate joint angles, so the same bone lengths survive the entire recovery.
    if (landing > 0) {
      thighAngle = landingAngle(thighAngle, side > 0 ? -0.2 : 2.3, pose.face, landing);
      shinAngle = landingAngle(shinAngle, side > 0 ? 1.4 : 3.3, pose.face, landing);
    }
    const knee = extend(hip, thighAngle, 3.5);
    const foot = extend(knee, shinAngle, shinLength);
    const toeAngle = pose.leg - Math.PI / 2 + (pose.hipsFace < 0 ? Math.PI : 0);
    const toe = extend(foot, landing > 0 ? landingAngle(toeAngle, side > 0 ? 0 : Math.PI, pose.face, landing) : toeAngle,
      1.5);
    // Tuck the reaching shoulder one pixel toward the torso's center in flight.
    const shoulderOffset = side > 0 ? 2 - clamp(pose.posture, 0, 1) : 2;
    // Reach the foreground shoulder forward so the fist clears the flight head.
    const shoulderReach = side > 0 ? 2 * clamp((pose.posture - 0.35) / 0.65, 0, 1) : 0;
    const armRoot = extend(shoulder, pose.spine, shoulderReach);
    const arm = extend(armRoot, pose.spine + Math.PI / 2, side * pose.armSide * shoulderOffset);
    const upperBend = 0.2 + pose.bend * 0.8;
    const foreBend = 0.3 + pose.bend * 1.4;
    // Hover splays the arms equally outside the chest so neither sleeve is hidden.
    // In flight the foreground arm reaches ahead while the rear arm stays tucked.
    let upperAngle = side < 0
      ? pose.spine + Math.PI + pose.armSide * upperBend
      : pose.spine + (pose.armUpper ?? pose.bodyFace * (Math.PI - upperBend) * (1 - flight));
    let foreAngle = side < 0
      ? pose.spine + Math.PI + pose.armSide * foreBend
      : pose.spine + (pose.armFore ?? pose.bodyFace * (Math.PI - foreBend) * (1 - flight));
    if (landing > 0) {
      upperAngle = landingAngle(upperAngle, side > 0 ? 1.8 : 2.65, pose.face, landing);
      foreAngle = landingAngle(foreAngle, side > 0 ? 1.15 : 0.6, pose.face, landing);
    }
    const elbow = extend(arm, upperAngle, 3);
    const hand = extend(elbow, foreAngle, 3);
    return { hip, knee, foot, toe, arm, elbow, hand };
  });
}

const copyLimbs = limbs => limbs.map(limb => Object.fromEntries(
  Object.entries(limb).map(([key, point]) => [key, [...point]])));
const rotatePoint = (point, angle) => [point[0] * Math.cos(angle) - point[1] * Math.sin(angle),
  point[0] * Math.sin(angle) + point[1] * Math.cos(angle)];
const boneAngle = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const extendBone = (a, angle, length) => [a[0] + Math.cos(angle) * length, a[1] + Math.sin(angle) * length];

// Omni-punching is presentation only. Combat keeps its immediate, committed
// pose; these continuous channels bridge turns, posture changes and handoffs.
export class OmniPunchAnimator {
  constructor() { this.reset(); }

  reset() {
    this.pose = null;
    this.limbs = null;
    this.channels = {};
    this.armIK = [];
    this.active = false;
    this.visualAttackId = -1;
    this.visualArmBlends = [];
    this.flight = 0;
    this.settle = 0;
  }

  follow(key, from, target, dt, response, angular = false, maxSpeed = Infinity) {
    const state = this.channels[key] ??= { value: from, velocity: 0 };
    const goal = angular ? state.value + difference(state.value, target) : target;
    // Exact critically damped response, stable even when the render cadence changes.
    const error = state.value - goal;
    const impulse = state.velocity + response * error;
    const decay = Math.exp(-response * dt);
    const next = goal + (error + impulse * dt) * decay;
    const step = clamp(next - state.value, -maxSpeed * dt, maxSpeed * dt);
    state.velocity = Math.abs(next - state.value - step) > 1e-9 ? step / dt
      : (state.velocity - response * impulse * dt) * decay;
    state.value += step;
    return state.value;
  }

  // engaged: something other than a punch (a load held overhead) wants the same smooth turns.
  update(dt, target, limbs, flight, punch, strike = null, engaged = false) {
    const fighting = punch.active || punch.stance > 0 || engaged;
    this.settle = fighting ? 0 : this.settle + dt;
    const release = fighting ? 1 : Math.max(0, 1 - this.settle / 0.18);
    if (!this.pose || !this.active && !fighting || release === 0) {
      this.pose = { ...target };
      this.limbs = copyLimbs(limbs);
      this.flight = flight;
      this.channels = {};
      this.armIK = [];
      this.active = fighting;
      return;
    }
    if (dt <= 0) return;
    this.active = true;
    const before = this.pose;
    const p = { ...target };
    p.spine = this.follow('spine', before.spine, target.spine, dt, 32, true, 20);
    p.leg = this.follow('leg', before.leg, target.leg, dt, 24, true, 18);
    p.capeAngle = this.follow('cape', before.capeAngle, target.capeAngle, dt, 22, true, 18);
    for (const key of ['spine', 'leg', 'capeAngle']) p[key] = target[key] + difference(target[key], p[key]) * release;
    this.flight = clamp(flight + (this.follow('flight', this.flight, flight, dt, 28) - flight) * release, 0, 1);
    for (const key of ['posture', 'combatPose', 'punchBrace', 'punchDrive', 'capeSide', 'trailX', 'trailY']) {
      p[key] = this.follow(key, before[key] ?? 0, target[key] ?? 0, dt, 30);
      p[key] = (target[key] ?? 0) + (p[key] - (target[key] ?? 0)) * release;
      if (['posture', 'combatPose', 'punchBrace', 'punchDrive'].includes(key)) p[key] = clamp(p[key], 0, 1);
    }
    const turn = difference(target.spine, p.spine);
    const targetNeckLength = Math.hypot(target.neckX, target.neckY);
    const neckLength = targetNeckLength + (this.follow('neckLength', Math.hypot(before.neckX, before.neckY),
      targetNeckLength, dt, 32) - targetNeckLength) * release;
    const targetNeckOffset = difference(target.spine, Math.atan2(target.neckY, target.neckX));
    const filteredNeckOffset = this.follow('neckOffset',
      difference(before.spine, Math.atan2(before.neckY, before.neckX)),
      targetNeckOffset, dt, 28, true, 10);
    const neckOffset = targetNeckOffset + difference(targetNeckOffset, filteredNeckOffset) * release;
    p.neckX = Math.cos(p.spine + neckOffset) * neckLength;
    p.neckY = Math.sin(p.spine + neckOffset) * neckLength;
    p.omniLookSide = clamp(target.face + (this.follow('lookSide', before.omniLookSide ?? before.face,
      target.face, dt, 32) - target.face) * release, -1, 1);
    p.omniBodySide = clamp(target.bodyFace + (this.follow('bodySide', before.omniBodySide ?? before.bodyFace,
      target.bodyFace, dt, 28) - target.bodyFace) * release, -1, 1);
    p.face = p.omniLookSide < 0 ? -1 : 1;
    p.omniHeadRotation = this.follow('head', before.omniHeadRotation ?? before.headRotation * before.face,
      target.headRotation * target.face, dt, 30, true, 16);
    p.omniHeadRotation = target.headRotation * target.face
      + difference(target.headRotation * target.face, p.omniHeadRotation) * release;
    p.headRotation = p.omniHeadRotation * p.face;
    const counter = this.follow('counter', 0, punch.armIndex === 1 ? 1 : -1, dt, 26);
    const { wind, drive } = punch.weight;
    const coil = (wind + drive * 0.25) * punch.stance;
    const result = limbs.map((limb, index) => {
      const old = this.limbs[index];
      const pose = {};
      const leading = punch.active && index === punch.armIndex;
      const reaching = leading && strike !== null;
      const armTarget = reaching ? strike.limbs[index] : limb;
      for (const root of ['arm', 'hip']) {
        const armTurn = reaching ? difference(strike.spine, p.spine) : turn;
        const goal = rotatePoint(root === 'arm' ? armTarget[root] : limb[root], root === 'arm' ? armTurn : turn);
        const reachingShoulder = reaching && root === 'arm';
        pose[root] = goal.map((value, axis) => value + (this.follow(`${index}-${root}-${axis}`,
          old[root][axis], value, dt, reachingShoulder ? 70 : 38, false,
          reachingShoulder ? 100 : 80) - value) * release);
      }
      const shoulderShift = [pose.arm[0] - old.arm[0], pose.arm[1] - old.arm[1]];
      const solved = { arm: pose.arm, elbow: old.elbow.map((v, axis) => v + shoulderShift[axis]),
        hand: old.hand.map((v, axis) => v + shoulderShift[axis]) };
      const cross = (armTarget.elbow[0] - armTarget.arm[0]) * (armTarget.hand[1] - armTarget.elbow[1])
        - (armTarget.elbow[1] - armTarget.arm[1]) * (armTarget.hand[0] - armTarget.elbow[0]);
      const side = Math.abs(cross) > 0.001 ? -Math.sign(cross) : target.armSide ?? target.face;
      reachArm(solved, armTarget.hand, side, 1, this.armIK[index] ??= {});
      const armResponse = reaching ? 100 : leading ? 48 : 32;
      const armSpeed = reaching ? 80 : leading ? 54 : 28;
      const upper = this.follow(`${index}-upper`, boneAngle(old.arm, old.elbow),
        boneAngle(solved.arm, solved.elbow), dt, armResponse, true, armSpeed);
      const fore = this.follow(`${index}-fore`, boneAngle(old.elbow, old.hand),
        boneAngle(solved.elbow, solved.hand), dt, armResponse, true, armSpeed);
      const rawUpper = boneAngle(limb.arm, limb.elbow), rawFore = boneAngle(limb.elbow, limb.hand);
      pose.elbow = extendBone(pose.arm, rawUpper + difference(rawUpper, upper) * release, 3);
      pose.hand = extendBone(pose.elbow, rawFore + difference(rawFore, fore) * release, 3);
      // Alternate the bracing knee while the other leg trails. The hips/boots
      // follow the body through a turn rather than snapping between leg rigs.
      const sideWeight = (index === 1 ? 1 : -1) * counter * coil;
      const thigh = this.follow(`${index}-thigh`, boneAngle(old.hip, old.knee),
        boneAngle(limb.hip, limb.knee) + turn + sideWeight * 0.14, dt, 26, true, 20);
      const shin = this.follow(`${index}-shin`, boneAngle(old.knee, old.foot),
        boneAngle(limb.knee, limb.foot) + turn - sideWeight * 0.2, dt, 24, true, 20);
      const targetShin = Math.hypot(limb.foot[0] - limb.knee[0], limb.foot[1] - limb.knee[1]);
      const shinLength = clamp(targetShin + (this.follow(`${index}-shinLength`,
        Math.hypot(old.foot[0] - old.knee[0], old.foot[1] - old.knee[1]), targetShin, dt, 28) - targetShin) * release, 3.5, 5.5);
      const boot = this.follow(`${index}-boot`, boneAngle(old.foot, old.toe),
        boneAngle(limb.foot, limb.toe) + turn, dt, 25, true, 20);
      const rawThigh = boneAngle(limb.hip, limb.knee), rawShin = boneAngle(limb.knee, limb.foot);
      const rawBoot = boneAngle(limb.foot, limb.toe);
      pose.knee = extendBone(pose.hip, rawThigh + difference(rawThigh, thigh) * release, 3.5);
      pose.foot = extendBone(pose.knee, rawShin + difference(rawShin, shin) * release, shinLength);
      pose.toe = extendBone(pose.foot, rawBoot + difference(rawBoot, boot) * release, 1.5);
      return pose;
    });
    this.pose = p;
    this.limbs = result;
  }
}

export class HeroRig {
  constructor(scene) {
    this.artwork = new HeroArtwork(scene);
    this.texture = this.artwork.texture;
    this.context = this.artwork.context;
    this.image = this.artwork.image;
    this.pose = {
      look: 0, chest: 0, hips: 0, spine: -Math.PI / 2, leg: Math.PI / 2,
      posture: 0, bend: 0, kneeBend: HOVER_KNEE_BEND, face: 1, bodyFace: 1, hipsFace: 1,
      armSide: 1, armUpper: null, armFore: null,
      headRotation: 0, neckX: 0, neckY: -HERO_PROPORTIONS.hoverNeckReach,
      trailX: 0, trailY: 1,
      capeSide: 1, capeAngle: Math.PI / 2, capePhase: 0, capeWind: 0,
    };
    this.flight = 0;
    this.gazeTarget = 0;
    this.punch = new HeroPunch();
    this.omni = new OmniPunchAnimator();
    this.landing = 0;
    // What the hands hold, as { x, y, spread } in pose pixels from the pelvis: the underside of a
    // carried car or bot, or the line of a throw just let go. null lets the arms ease back.
    this.hold = null;
    this.holdTarget = null;
    this.holdWeight = 0;
    // True while a load is held. The hero stays upright under it on Shift boost and stretches out
    // only in a RAM, with the load along its back. Its gaze follows travel until the throw.
    this.carrying = false;
    // The angle of a throw in its windup and follow-through, else null. The hero looks down it.
    this.throwAim = null;
    // True while the hero stands upright out of a throw, whatever its speed or flight mode.
    this.upright = false;
  }

  land() {
    this.landing = 1;
  }

  getBodyPose() {
    const base = this.punch.bodyPose(this.pose);
    if (this.landing <= 0 || this.punch.active || this.punch.queued) return base;
    // Hold the planted silhouette for 1.5 seconds, then rise. A punch owns the entire pose.
    const release = Math.min(1, this.landing * (LANDING_HOLD + LANDING_RISE) / LANDING_RISE);
    const weight = release * release * (3 - 2 * release)
      * (1 - clamp(this.punch.stance ?? 0, 0, 1));
    const angle = (from, to) => from + difference(from, to) * weight;
    return {
      ...base,
      spine: angle(base.spine, -Math.PI / 2 + base.face * 0.55),
      leg: angle(base.leg, Math.PI / 2),
      posture: base.posture * (1 - weight),
      hipsFace: base.hipsFace + (base.face - base.hipsFace) * weight,
      armSide: base.armSide + (base.face - base.armSide) * weight,
      neckX: base.neckX * (1 - weight),
      neckY: base.neckY + (-3.5 - base.neckY) * weight,
      headRotation: base.headRotation + (Math.PI / 5 - base.headRotation) * weight,
      kneeBend: base.kneeBend + weight * 1.05,
      landingCrouch: weight,
      capeAngle: angle(base.capeAngle, base.face > 0 ? -2.5 : -0.64),
      capeWind: Math.max(base.capeWind, weight * 0.7),
      armUpper: angle(base.armUpper ?? 0, Math.PI - base.face * 0.35),
      armFore: angle(base.armFore ?? 0, Math.PI + base.face * 0.25),
    };
  }

  // Drawn size only; hit detection keeps using true-size joints.
  get size() { return this.artwork.size; }
  set size(value) { this.artwork.size = value; }

  headPoint(x, y) {
    const p = this.getBodyPose();
    const angle = p.headRotation;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [
      // Match the artwork's pixel-center correction when the head faces left.
      p.neckX + (1 - p.face) / 2 + (x * cosine - y * sine) * p.face,
      p.neckY + x * sine + y * cosine,
    ];
  }

  getJoints() {
    const pose = this.getBodyPose();
    // Limbs belong to the body: a head turned to a backward laser must not mirror the legs.
    return this.punch.apply(joints(pose, this.flight), pose.bodyFace, pose);
  }

  getRenderPose() { return this.omni.active ? this.omni.pose : this.getBodyPose(); }
  getRenderJoints() {
    if (this.holdWeight <= 0) return this.omni.active ? this.omni.limbs : this.getJoints();
    return this.holdArms(this.omni.active ? copyLimbs(this.omni.limbs) : this.getJoints());
  }

  // Drawn pose only: both arms reach up under the load, elbows out. Hit tests keep the true joints,
  // so a punch already swinging still lands.
  holdArms(limbs) {
    const { x, y, spread, angle: along = 0 } = this.holdTarget;
    const weight = this.holdWeight * this.holdWeight * (3 - 2 * this.holdWeight);
    // Each hand keeps to its own shoulder's side. armSide eases through zero as the body turns, so
    // the hands cross over smoothly instead of swapping places in one frame.
    const across = clamp((this.pose.armSide ?? 1) * 3, -1, 1);
    limbs.forEach((limb, i) => {
      const side = (i ? 1 : -1) * across;
      const dx = x + side * spread * Math.cos(along) - limb.arm[0];
      const dy = y + side * spread * Math.sin(along) - limb.arm[1];
      const reach = clamp(Math.hypot(dx, dy), 1, 6);
      const angle = Math.atan2(dy, dx);
      const bend = Math.acos(Math.min(1, reach / 6)) * side;
      const bone = Math.max(3, reach / 2);
      // Blend bone angles, not points, so the arms never shorten on the way up.
      const upper = boneAngle(limb.arm, limb.elbow);
      const fore = boneAngle(limb.elbow, limb.hand);
      limb.elbow = extendBone(limb.arm, upper + difference(upper, angle + bend) * weight, 3 + (bone - 3) * weight);
      limb.hand = extendBone(limb.elbow, fore + difference(fore, angle - bend) * weight, 3 + (bone - 3) * weight);
    });
    return limbs;
  }

  renderHeadPoint(x, y) {
    const p = this.getRenderPose();
    if (p.omniLookSide === undefined) return this.headPoint(x, y);
    const side = p.omniLookSide;
    const local = rotatePoint([x * side, y], p.omniHeadRotation);
    return [p.neckX + (1 - side) / 2 + local[0], p.neckY + local[1]];
  }

  resetRenderPose() { this.omni.reset(); }

  getRenderStrike() {
    const punch = this.punch;
    const { windup, snap, hold } = punch.hit;
    if (!punch.active || punch.time > windup + snap + hold) return null;
    if (this.omni.visualAttackId !== punch.attackId) {
      this.omni.visualAttackId = punch.attackId;
      this.omni.visualArmBlends = [];
    }
    // Lead the visual extension into contact instead of teleporting the wrist
    // when collision confirms a hit. This pose never participates in hit tests.
    const gesture = Object.assign(Object.create(punch), {
      time: punch.time <= windup ? punch.time : windup + Math.min(snap, (punch.time - windup) * 2.2),
      armBlends: this.omni.visualArmBlends,
    });
    const pose = gesture.bodyPose(this.pose);
    return { spine: pose.spine, limbs: gesture.apply(joints(pose, this.flight), pose.bodyFace, pose) };
  }

  aimAngle(position, pointer) {
    const [eyeX, eyeY] = this.headPoint(1, -2);
    const dx = pointer.worldX - position.x - eyeX;
    const dy = pointer.worldY - position.y - eyeY;
    return dx * dx + dy * dy > 4 ? Math.atan2(dy, dx) : this.gazeTarget;
  }

  requestPunch(position, velocity, pointer, aimSource = 'mouse') {
    const target = this.aimAngle(position, pointer);
    this.punch.request(punchVariant(this, target, velocity), aimSource, pointer.target);
  }

  update(dt, position, velocity, input, pointer, elapsed, boosting = false, ramming = false) {
    const leavingImpact = Math.abs(input.x) > 0.1 || input.y < -0.1 || this.punch.active;
    this.landing = Math.max(0, this.landing - dt / (leavingImpact ? 0.1 : LANDING_HOLD + LANDING_RISE));
    // Finish aiming the punch even when the right button was only tapped.
    pointer = { ...pointer, isDown: pointer.isDown || this.punch.active || this.punch.grace > 0 };
    const p = this.pose;
    const speed = Math.hypot(velocity.x, velocity.y);
    const momentum = clamp((speed - 48) / (200 - 48), 0, 1);
    const travelAngle = Math.atan2(velocity.y, velocity.x);

    let target = this.gazeTarget;
    if (this.throwAim !== null) {
      target = this.throwAim;
    } else if (pointer.isDown) {
      target = this.aimAngle(position, pointer);
    } else if (speed > 8) {
      target = travelAngle;
    }
    this.gazeTarget = target;
    let punchTarget = pointer.punchWorldX === undefined ? target
      : this.aimAngle(position, { worldX: pointer.punchWorldX, worldY: pointer.punchWorldY });
    this.punch.aim(punchTarget);
    if (pointer.refreshPunchAim && this.punch.time === 0) {
      this.punch.variant = punchVariant(this, punchTarget, velocity);
    }
    const attackId = this.punch.attackId;
    this.punch.update(dt);
    if (this.punch.attackId !== attackId && pointer.refreshPunchAim) {
      // A queued hit starts inside update(). Resolve its target and posture before its first draw.
      punchTarget = this.aimAngle(position, pointer.refreshPunchAim());
      this.punch.aim(punchTarget);
      this.punch.variant = punchVariant(this, punchTarget, velocity);
    }

    // Looking behind changes the pose, never the movement or boost speed.
    // Use the upright pose sooner so the head never has to twist far from travel.
    // A punch carries the body; the gaze (a mouse laser fired elsewhere) turns only the head.
    const punching = this.punch.active || this.punch.grace > 0;
    const bodyAim = punching ? punchTarget : target;
    const aimingOutsideFlight = pointer.isDown && !flightAim(bodyAim, travelAngle, this.flight > 0.5);
    // On Shift boost a load stays overhead, the hero upright. Only a RAM lays it along the back.
    const lowering = this.carrying && !ramming;
    // A held downward RAM has no travel once it meets the floor. Recover upright instead of
    // laying the stationary hero sideways after the brace; the power and steering stay active.
    const flyingRam = ramming && speed > 55;
    const recoveringImpact = this.landing > 0 && speed < 55;
    const wantsFlight = !this.upright && !lowering && (flyingRam
      || boosting && (input.x * input.x + input.y * input.y > 0) && speed > 55 && !aimingOutsideFlight);
    const flightStep = dt / (flyingRam || recoveringImpact ? 0.07 : wantsFlight ? 0.2 : 0.24);
    this.flight += clamp((wantsFlight ? 1 : 0) - this.flight, -flightStep, flightStep);
    // Forward aiming moves only the head; the extended body follows travel.
    const bodyTarget = wantsFlight ? travelAngle : bodyAim;
    // Tight turns need less accumulated chest/spine lag; hover keeps its softer follow-through.
    const flightFollow = this.flight * momentum;
    p.chest = turnToward(p.chest, bodyTarget, 10 + flightFollow * 6, dt, 12 + flightFollow * 10);
    p.look = turnToward(p.look, target, 16, dt, 18 + flightFollow * 10);
    p.look = p.chest + clamp(difference(p.chest, p.look), -NECK_LIMIT, NECK_LIMIT);
    p.hips = turnToward(p.hips, p.chest, 7 + flightFollow * 5, dt, 8 + flightFollow * 8);
    // Under a load the aim often passes overhead; a wider dead zone stops the hero flipping
    // from side to side each time it does.
    const flip = this.carrying ? -0.4 : -0.15;
    if (Math.cos(target) * p.face < flip) p.face *= -1;
    if (Math.cos(p.chest) * p.bodyFace < flip) p.bodyFace *= -1;
    if (Math.cos(p.hips) * p.hipsFace < flip) p.hipsFace *= -1;
    const pitch = Math.atan2(Math.sin(target), Math.abs(Math.cos(target)));
    const hoverUp = this.carrying ? CARRY_LOOK_UP : HOVER_LOOK_UP;
    const upLimit = hoverUp + (Math.PI / 2 - hoverUp) * this.flight;
    const downLimit = HOVER_LOOK_DOWN + (Math.PI / 2 - HOVER_LOOK_DOWN) * this.flight;
    p.headRotation = turnToward(p.headRotation, clamp(pitch, -upLimit, downLimit), 10, dt, 14);

    const postureLook = wantsFlight && pointer.isDown ? p.chest : p.look;
    const alignment = speed > 8
      ? (Math.cos(postureLook) * velocity.x + Math.sin(postureLook) * velocity.y) / speed
      : 1;
    const turning = Math.abs(difference(p.chest, bodyTarget)) / Math.PI;
    const blend = 1 - Math.exp(-10 * dt);
    p.posture += (this.flight * Math.max(0, alignment) * (1 - turning) - p.posture) * blend;
    p.bend += (Math.max(turning * 0.4, (1 - alignment) * 0.5 * this.flight,
      Math.abs(this.flight - p.posture) * 0.5) - p.bend) * blend;
    const restKnee = this.carrying ? CARRY_KNEE_BEND : HOVER_KNEE_BEND;
    const kneeTarget = restKnee + (BRACED_KNEE_BEND - restKnee) * clamp(p.bend, 0, 1) * this.flight;
    p.kneeBend += (kneeTarget - p.kneeBend) * (1 - Math.exp(-16 * dt));
    // Upright is an explicit rest pose. It never depends on the last look angle.
    // Flight follows an unwrapped angle, so crossing vertical has no side-switch jump.
    const aimMomentum = pointer.isDown ? momentum : 0;
    // At speed, lean into travel even when the head aims backward.
    const hoverLean = clamp(velocity.x / 48, -1, 1) * Math.PI * 8 / 180 * (1 - aimMomentum)
      + clamp(velocity.x / 200, -1, 1) * Math.PI * 30 / 180 * aimMomentum
      + (pointer.isDown ? Math.cos(p.look) * Math.PI * 4 / 180 * (1 - aimMomentum) : 0);
    const extended = wantsFlight && p.posture > 0.35;
    const spineTarget = extended ? p.chest : -Math.PI / 2 + hoverLean;
    p.spine = turnToward(p.spine, spineTarget, recoveringImpact ? 24 : 8 + flightFollow * 8,
      dt, recoveringImpact ? 36 : 10 + flightFollow * 14);
    // Shoulders and arm angles follow the turn continuously instead of mirroring
    // in one frame. Start reaching as the torso extends into the flight pose.
    p.armSide += (p.bodyFace - p.armSide) * (1 - Math.exp(-8 * dt));
    const armReach = clamp((p.posture - 0.35) / 0.65, 0, 1);
    const upperTarget = p.bodyFace * (Math.PI - 0.2 - p.bend * 0.8) * (1 - armReach);
    const foreTarget = p.bodyFace * (Math.PI - 0.3 - p.bend * 1.4) * (1 - armReach);
    p.armUpper = turnToward(p.armUpper ?? upperTarget, upperTarget, 8, dt, 16);
    p.armFore = turnToward(p.armFore ?? foreTarget, foreTarget, 8, dt, 16);
    const pelvisAxis = p.spine + Math.PI;
    const legTarget = extended ? pelvisAxis
      : Math.PI / 2 + hoverLean * (0.35 + aimMomentum * 0.65);
    p.leg = turnToward(p.leg, legTarget, 10, dt, 18);
    p.leg = pelvisAxis + clamp(difference(pelvisAxis, p.leg), -MAX_HIP_SWING, MAX_HIP_SWING);
    // Keep the calibrated head and chest proportions through hover/flight transitions.
    const neckReach = HERO_PROPORTIONS.hoverNeckReach
      + (HERO_PROPORTIONS.extendedNeckReach - HERO_PROPORTIONS.hoverNeckReach) * p.posture;
    const neckBlend = 1 - Math.exp(-(10 + flightFollow * 8) * dt);
    p.neckX += (Math.cos(p.spine) * neckReach - p.neckX) * neckBlend;
    p.neckY += (Math.sin(p.spine) * neckReach - p.neckY) * neckBlend;
    const trailX = speed > 8 ? -velocity.x / speed : 0;
    const trailY = speed > 8 ? -velocity.y / speed : 1;
    const windBlend = 1 - Math.exp(-(5 + momentum * 13) * dt);
    p.trailX += (trailX - p.trailX) * windBlend;
    p.trailY += (trailY - p.trailY) * windBlend;
    p.capeSide += (p.bodyFace - p.capeSide) * (1 - Math.exp(-12 * dt));
    p.capeWind += (momentum - p.capeWind) * blend;
    // Accumulate phase so changing speed never jumps the cape's flutter.
    p.capePhase += dt * (7 + momentum * 9);
    // Fast airflow keeps the cape streaming even when aiming brings the body upright.
    const wakeY = p.trailY + (1 - Math.max(this.flight, p.capeWind)) * 1.1;
    // Keep a direction through wake cancellation instead of normalizing a near-zero vector.
    if (Math.hypot(p.trailX, wakeY) > 0.05) {
      p.capeAngle = turnToward(p.capeAngle, Math.atan2(wakeY, p.trailX), 7 + momentum * 3,
        dt, 10 + momentum * 10);
    }

    this.artwork.armsBehind = this.holdWeight > 0.5;
    if (this.hold) this.holdTarget = this.hold;
    this.holdWeight = clamp(this.holdWeight + (this.hold ? dt / 0.12 : -dt / 0.18), 0, 1);
    // Under a load the body turns through the same smoothed channels as a punch: the head passes
    // through its front view instead of mirroring in one frame.
    this.omni.update(dt, this.getBodyPose(), this.getJoints(), this.flight, this.punch, this.getRenderStrike(),
      this.carrying || this.holdWeight > 0);
    this.pendingDraw = elapsed;
    const planted = this.getRenderPose().landingCrouch ?? 0;
    const bob = Math.sin(elapsed * 3.4) * 1.5 * (1 - this.flight) * (1 - planted)
      + planted * 7;
    const snap = value => Math.round(value * ART_RESOLUTION) / ART_RESOLUTION;
    this.image.setPosition(snap(position.x), snap(position.y + bob));
  }

  // update() runs at the 120 Hz simulation rate. Redrawing and uploading the 256 px canvas there costs
  // two uploads per 60 fps frame, of which only the last is seen, so the scene draws once per frame.
  render() {
    if (this.pendingDraw == null) return;
    this.draw(this.pendingDraw);
    this.pendingDraw = null;
  }

  draw(elapsed) {
    this.artwork.draw(this.getRenderPose(), this.getRenderJoints(), (x, y) => this.renderHeadPoint(x, y),
      elapsed, this.omni.active ? this.omni.flight : this.flight, this.punch);
  }
}
