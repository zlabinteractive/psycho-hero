// Smooth vector hero drawn at a fine resolution over the original game-pixel silhouette.
const SIZE = 64;
// Canvas pixels per game pixel.
export const ART_RESOLUTION = 4;
const RES = ART_RESOLUTION;
const CAPE_LENGTH = 13;
// Keep the head and chest proportions consistent with the 20-pixel punch guard.
// The forward-facing flight head needs one extra pixel of reach to clear the chest.
export const HERO_PROPORTIONS = Object.freeze({ hoverNeckReach: 5, extendedNeckReach: 6 });
const PAL = {
  H: '#292438', h: '#46415e', T: '#c77f62', S: '#f5b28b',
  // Comet suit: purple body, orange cape, boots, belt and gloves, yellow comet mark.
  W: '#fff8eb', P: '#262237', B: '#6b3fb8', b: '#8c64d6',
  D: '#4a2a8c', Y: '#ffcc3d', y: '#ffe78f', G: '#ff8a2e',
  R: '#ff7424', r: '#ff9a4d', C: '#c94e17', K: '#1d2339',
};

// Points mark the top-left of the old square brush, so a stroke of `size`
// covers the same area the pixel line did. Round caps turn single points into dots.
function line(context, points, color, size = 1) {
  const half = size / 2;
  context.strokeStyle = color;
  context.lineWidth = size;
  context.beginPath();
  context.moveTo(points[0][0] + half, points[0][1] + half);
  for (const [x, y] of points.slice(1)) context.lineTo(x + half, y + half);
  if (points.length === 1) context.lineTo(points[0][0] + half + 0.01, points[0][1] + half);
  context.stroke();
}

function shape(c, fill, outline, details) {
  outline();
  c.fillStyle = fill;
  c.fill();
  c.save();
  c.clip();
  details();
  c.restore();
  outline();
  c.strokeStyle = PAL.K;
  c.lineWidth = 1;
  c.stroke();
}

function ellipse(c, color, x, y, rx, ry) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

// Long hair tied at the nape: full near the head, narrowing to a soft tip.
function ponytail(c, points) {
  const widths = [1, 0.85, 0.4];
  for (const [fill, grow] of [[PAL.K, 0.5], [PAL.H, 0]]) {
    c.fillStyle = fill;
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const length = Math.max(Math.hypot(bx - ax, by - ay), 0.001);
      const nx = -(by - ay) / length;
      const ny = (bx - ax) / length;
      const a = widths[i - 1] + grow;
      const b = widths[i] + grow;
      c.beginPath();
      c.moveTo(ax + nx * a, ay + ny * a);
      c.lineTo(bx + nx * b, by + ny * b);
      c.lineTo(bx - nx * b, by - ny * b);
      c.lineTo(ax - nx * a, ay - ny * a);
      c.fill();
    }
    points.forEach(([x, y], i) => ellipse(c, fill, x, y, widths[i] + grow, widths[i] + grow));
  }
}

// The head keeps the old 5x4 pixel footprint, facing +x, with its outline on the old edge.
function drawHead(c) {
  shape(c, PAL.S, () => {
    c.beginPath();
    c.roundRect(-2.5, -3.5, 6, 5, [1.8, 1.4, 1.6, 2.2]);
  }, () => {
    c.fillStyle = PAL.T;
    c.beginPath();
    c.moveTo(-3, -1.2);
    c.quadraticCurveTo(-1, -0.9, -0.4, 1.6);
    c.lineTo(-3, 1.6);
    c.fill();
    // Slicked back from a high hairline, clearing the forehead and ear.
    c.fillStyle = PAL.H;
    c.beginPath();
    c.moveTo(-3, -4);
    c.lineTo(3.6, -4);
    c.quadraticCurveTo(1.6, -3.2, 0.4, -2.5);
    c.quadraticCurveTo(-0.8, -2.2, -1.2, -0.8);
    c.lineTo(-3, -0.4);
    c.fill();
    // Combed strands running back toward the ponytail.
    line(c, [[1.8, -3.5], [0.2, -3.2], [-1.8, -2.6]], PAL.h, 0.3);
    line(c, [[0.4, -2.9], [-1, -2.5], [-2.2, -1.9]], PAL.h, 0.25);
    ellipse(c, PAL.T, -0.4, -1.3, 0.5, 0.65);
    ellipse(c, PAL.W, 1.85, -1.5, 0.8, 0.6);
    ellipse(c, PAL.P, 2.35, -1.45, 0.4, 0.5);
    // A heavy brow gives a rugged profile.
    line(c, [[0.9, -2.45], [2.6, -2.35]], PAL.H, 0.5);
    line(c, [[1.3, -0.4], [2.3, -0.3]], PAL.T, 0.35);
  });
}

// A full-width front view bridges left/right combat turns without mirroring
// the whole head in a single frame or shrinking it into a thin sliver.
function drawHeadFront(c) {
  shape(c, PAL.S, () => {
    c.beginPath();
    c.roundRect(-2.5, -3.5, 6, 5, [1.8, 1.8, 1.7, 1.7]);
  }, () => {
    c.fillStyle = PAL.H;
    c.beginPath();
    c.moveTo(-3, -4); c.lineTo(4, -4); c.lineTo(3.5, -2.5);
    c.quadraticCurveTo(0.6, -3.2, -2.6, -1.8); c.fill();
    line(c, [[-1.8, -3.3], [0.2, -3.5], [2.5, -3.2]], PAL.h, 0.3);
    for (const x of [-0.8, 1.8]) {
      ellipse(c, PAL.W, x, -1.4, 0.65, 0.55);
      ellipse(c, PAL.P, x + 0.1, -1.35, 0.3, 0.45);
      line(c, [[x - 0.55, -2.3], [x + 0.55, -2.3]], PAL.H, 0.4);
    }
    line(c, [[0.45, -0.9], [0.3, -0.1], [0.85, 0]], PAL.T, 0.3);
    line(c, [[-0.1, 0.6], [1.3, 0.6]], PAL.T, 0.3);
  });
}

// The chest keeps the old 4x5 footprint: shaded side, emblem, and belt.
function drawChest(c, side = 1) {
  shape(c, PAL.B, () => {
    c.beginPath();
    c.roundRect(-2.5, -2.5, 5, 6, [1.4, 1.4, 0.8, 0.8]);
  }, () => {
    c.fillStyle = PAL.D;
    c.fillRect(-1 - side * 2, -3, 2, 7);
    c.fillStyle = PAL.R;
    c.fillRect(-3, 2, 6, 2);
    ellipse(c, PAL.b, 0.6 * side, -1.6, 0.9, 0.35);
    // Comet mark: round head with a tail streaming back.
    c.fillStyle = PAL.Y;
    c.beginPath();
    c.moveTo(-1.6 * side, -1.3);
    c.lineTo(0.3 * side, -0.9);
    c.lineTo(0.3 * side, 0.3);
    c.closePath();
    c.fill();
    ellipse(c, PAL.Y, 0.4 * side, -0.3, 0.75, 0.75);
    ellipse(c, PAL.y, 0.55 * side, -0.45, 0.3, 0.3);
  });
}

export function capePoints(p, elapsed, flight = 0) {
  // Combat uses the flight collar and drape even when the hero is hovering.
  flight = Math.max(flight, p.combatPose ?? 0);
  const hover = 1 - flight;
  const rearX = Math.sin(p.spine) * p.capeSide;
  const rearY = -Math.cos(p.spine) * p.capeSide;
  // Hover keeps its neck drape; flight fastens to the collar on the torso.
  const outset = 1.5 + flight * 0.5;
  const root = [hover * (p.neckX - Math.cos(p.spine)) + flight * Math.cos(p.spine) * 2 + rearX * outset,
    hover * (p.neckY - Math.sin(p.spine)) + flight * Math.sin(p.spine) * 2 + rearY * outset];
  const directionX = Math.cos(p.capeAngle);
  const directionY = Math.sin(p.capeAngle);
  const hanging = hover * (1 - Math.min(1, Math.abs(p.trailX)));
  const phase = p.capePhase ?? elapsed * 7;
  const flutterStrength = 1 + (p.capeWind ?? 0) * 1.5;
  const points = [root];
  for (let i = 1; i <= CAPE_LENGTH; i++) {
    const t = i / CAPE_LENGTH;
    const flutter = Math.sin(phase - t * 6) * t * (0.8 - flight * 0.4) * flutterStrength;
    const drape = hanging * (Math.sin(t * Math.PI) * 1.2 + t * 1.8)
      + flight * Math.sin(t * Math.PI / 2) * 1.5;
    const distance = t * (CAPE_LENGTH - 1);
    points.push([root[0] + directionX * distance + rearX * drape + directionY * flutter,
      root[1] + directionY * distance + rearY * drape - directionX * flutter]);
  }
  return points;
}

export class HeroArtwork {
  constructor(scene) {
    this.scene = scene;
    this.texture = scene.textures.createCanvas('hero-rig', SIZE * RES, SIZE * RES);
    this.context = this.texture.context;
    this.image = scene.add.image(160, 112, 'hero-rig').setDepth(10).setScale(1 / RES);
    // World size multiplier: 1 is the hero's true size.
    this.size = 1;
    // True while both arms are raised under a load: they are drawn behind the chest, so they
    // come out of the shoulders instead of lying across the torso.
    this.armsBehind = false;
  }

  draw(p, limbs, headPoint, elapsed, flight = 0, punch = null) {
    const c = this.context;
    // Draw at about one canvas pixel per screen pixel, centred in the canvas, so zooming the camera
    // out never squeezes several canvas pixels into one (which shimmers under pixelArt sampling).
    const scale = Math.min(RES, (this.scene.cameras?.main.zoom ?? RES) * this.size);
    const offset = SIZE * (RES - scale) / 2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, SIZE * RES, SIZE * RES);
    c.setTransform(scale, 0, 0, scale, offset, offset);
    this.image.setScale(this.size / scale);
    c.save();
    c.translate(SIZE / 2, SIZE / 2);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const drawLine = (a, b, color, size = 1) => line(c, [a, b], color, size);
    // Outline the whole chain before its color so joints read as one smooth limb.
    const bone = (points, color) => {
      line(c, points.map(([x, y]) => [x - 1, y - 1]), PAL.K, 3);
      line(c, points.map(([x, y]) => [x - 0.5, y - 0.5]), color, 2);
    };

    const cape = capePoints(p, elapsed, flight);
    const capeFlare = Math.max(p.combatPose ?? 0, (p.landingCrouch ?? 0) * 1.2);
    for (let i = 1; i <= CAPE_LENGTH; i++) {
      const width = 2 + capeFlare * Math.sin(i / CAPE_LENGTH * Math.PI) * 3;
      const offset = (width - 2) / 2;
      drawLine([cape[i - 1][0] - offset, cape[i - 1][1] - offset],
        [cape[i][0] - offset, cape[i][1] - offset],
        i / CAPE_LENGTH > 0.7 ? PAL.C : PAL.R, width);
    }

    // Hangs down the back at rest and streams with the airflow in flight.
    const hairFlight = flight * (1 - (p.combatPose ?? 0));
    const hairX = -(p.omniLookSide ?? p.face) * 0.35 * (1 - hairFlight) + p.trailX * hairFlight;
    const hairY = 1 - hairFlight + p.trailY * hairFlight;
    const sway = Math.sin(elapsed * 9) * 0.4 * hairFlight;
    const nape = headPoint(-2.3, -1.8);
    const mid = [nape[0] + hairX * 1.5, nape[1] + hairY * 1.5];
    ponytail(c, [nape, mid,
      [mid[0] + hairX * 1.5 - hairY * sway, mid[1] + hairY * 1.5 + 0.3 + hairX * sway]]);

    for (const limb of limbs) {
      bone([limb.hip, limb.knee, limb.foot], PAL.B);
      const boot = [limb.knee[0] * 0.25 + limb.foot[0] * 0.75,
        limb.knee[1] * 0.25 + limb.foot[1] * 0.75];
      drawLine(boot, limb.foot, PAL.R, 2);
      drawLine(limb.foot, limb.toe, PAL.R);
      drawLine(boot, boot, PAL.r);
    }
    const arm = (limb, color, highlight = false) => {
      bone([limb.arm, limb.elbow, limb.hand], color);
      // The fist is centered on the wrist, including when the facing is mirrored.
      const fist = [limb.hand[0] - 1, limb.hand[1] - 1];
      drawLine(fist, fist, PAL.G, 2);
      if (highlight) drawLine(limb.arm, limb.arm, PAL.b);
    };
    const attacking = punch?.active && punch.weight.drive > 0.1 ? punch.armIndex : -1;
    if (attacking !== 0) arm(limbs[0], PAL.D);
    if (this.armsBehind && attacking !== 1) arm(limbs[1], PAL.B);
    c.save();
    c.rotate(p.spine + Math.PI / 2);
    if (p.omniBodySide === undefined) c.scale(p.bodyFace, 1);
    drawChest(c, p.omniBodySide ?? 1);
    c.restore();
    if (attacking !== 1 && !this.armsBehind) arm(limbs[1], PAL.B, true);
    const collar = [Math.cos(p.spine) * 2.5, Math.sin(p.spine) * 2.5];
    const neck = [p.neckX, p.neckY];
    // Cover the extra reach with the suit; leave only a short neck below the chin.
    // The head anchor and silhouette stay at their existing height.
    bone([collar, neck], PAL.B);
    const neckLength = Math.hypot(neck[0] - collar[0], neck[1] - collar[1]);
    const exposed = Math.min(1, 2 / Math.max(neckLength, 0.001));
    drawLine([neck[0] + (collar[0] - neck[0]) * exposed,
      neck[1] + (collar[1] - neck[1]) * exposed], neck, PAL.T);

    c.save();
    // Mirror around the old pixel columns' centers to keep left/right body lengths equal.
    const lookSide = p.omniLookSide ?? p.face;
    c.translate(p.neckX + (1 - lookSide) / 2, p.neckY);
    if (p.omniLookSide === undefined) {
      c.scale(p.face, 1);
      c.rotate(p.headRotation);
      drawHead(c);
    } else {
      c.rotate(p.omniHeadRotation);
      const alpha = c.globalAlpha ?? 1;
      const profile = Math.abs(lookSide);
      if (profile < 0.999) {
        c.globalAlpha = alpha; drawHeadFront(c);
      }
      if (profile > 0.001) {
        c.save(); c.scale(p.face, 1); c.globalAlpha = alpha * profile; drawHead(c); c.restore();
      }
    }
    c.restore();
    // Keep the striking forearm and fist readable even for upward punches.
    if (attacking >= 0) arm(limbs[attacking], PAL.B, true);
    c.restore();
    this.texture.refresh();
  }
}

export class HeroPunchEffects {
  constructor(graphics) {
    this.graphics = graphics;
    this.waves = [];
    this.streak = null;
  }

  reset() {
    this.waves.length = 0;
    this.streak = null;
    this.graphics.clear();
  }

  contact(point, angle) {
    this.waves.push({ x: point.x, y: point.y, angle, power: 4, contact: true, age: 0 });
  }

  update(dt, rig) {
    for (const wave of this.waves) wave.age += dt;
    this.waves = this.waves.filter(wave => wave.age < 0.18);
    const punch = rig.punch;
    this.streak = punch.active && punch.weight.drive > 0.2 ? {
      x: rig.image.x, y: rig.image.y, angle: punch.angle,
      power: punch.combo + 1, alpha: punch.weight.drive,
    } : null;
    if (!punch.impact) return;
    const hand = (rig.getRenderJoints?.() ?? rig.getJoints())[punch.armIndex].hand;
    this.waves.push({ x: rig.image.x + hand[0] * rig.size, y: rig.image.y + hand[1] * rig.size,
      angle: punch.angle, power: punch.impact, age: 0 });
  }

  draw() {
    const g = this.graphics;
    g.clear();
    const stroke = (origin, forwardA, acrossA, forwardB, acrossB, width, color, alpha) => {
      const dx = Math.cos(origin.angle);
      const dy = Math.sin(origin.angle);
      g.lineStyle(width, color, alpha);
      g.lineBetween(origin.x + dx * forwardA - dy * acrossA,
        origin.y + dy * forwardA + dx * acrossA,
        origin.x + dx * forwardB - dy * acrossB,
        origin.y + dy * forwardB + dx * acrossB);
    };
    if (this.streak) {
      const s = this.streak;
      // Air tears away behind the shoulders, leaving the hero's silhouette clear.
      for (const side of [-1, 1]) {
        stroke(s, -5 - s.power * 4, side * 5, 1, side * 3,
          1, 0xe0f7ff, s.alpha * 0.7);
        stroke(s, -9 - s.power * 5, side * 3, -6, side * 2,
          1, 0xa0e5f5, s.alpha * 0.45);
      }
    }
    for (const wave of this.waves) {
      const t = wave.age / 0.18;
      const fade = (1 - t) ** 2;
      const radius = 2 + Math.sqrt(t) * (3 + wave.power * 1.5);
      const travel = 1 + t * (4 + wave.power * 1.5);
      if (wave.contact) {
        // A compact star marks real contact; empty swings only get the air-pressure front.
        for (let ray = 0; ray < 8; ray++) {
          const a = ray * Math.PI / 4;
          const length = (ray % 2 ? 6 : 10) * (1 - t * 0.4);
          stroke(wave, Math.cos(a) * 2, Math.sin(a) * 2,
            Math.cos(a) * length, Math.sin(a) * length, 1, 0xfff0bf, fade);
        }
      }
      // A curved pressure front, not a collision spark in empty air.
      for (const [width, color, alpha] of [[3, 0xb9edff, 0.2],
        [1, wave.power === 3 ? 0xfff1bd : 0xf1fcff, 0.95]]) {
        for (let i = 0; i < 10; i++) {
          const a = -1.4 + i * 0.28;
          const b = a + 0.28;
          stroke(wave, travel + Math.cos(a) * radius * 0.45, Math.sin(a) * radius,
            travel + Math.cos(b) * radius * 0.45, Math.sin(b) * radius,
            width, color, fade * alpha);
        }
      }
      for (const side of [-1, 1]) {
        stroke(wave, travel - 7, side * radius * 0.6,
          travel - 2, side * radius * 0.7, 1, 0xf1fcff, fade * 0.65);
      }
    }
  }
}

const PULSE_TIME = 0.12;
const LASER_SPARK_RATE = 48;
const LASER_SPARK_LIFE = 0.25;

export class HeroLaser {
  constructor(graphics, groundY, random = Math.random) {
    this.graphics = graphics;
    this.groundY = groundY;
    this.pulse = 0;
    this.wasDown = false;
    this.angle = 0;
    this.elapsed = 0;
    this.firingTime = 0;
    this.sparks = [];
    this.sparkAccumulator = 0;
    this.random = random;
    this.beam = null;
  }

  fire() {
    this.pulse = PULSE_TIME;
  }

  groundDistance(origin, directionX, directionY, range) {
    if (typeof this.groundY === 'number') {
      return directionY > 0 && origin.y < this.groundY ? (this.groundY - origin.y) / directionY : Infinity;
    }
    // Terrain varies with x, so march the beam and refine the first crossing.
    const below = d => origin.y + directionY * d >= this.groundY(origin.x + directionX * d);
    for (let d = 4; d < range + 4; d += 4) {
      if (!below(d)) continue;
      let low = d - 4;
      let high = d;
      for (let i = 0; i < 6; i++) {
        const middle = (low + high) / 2;
        if (below(middle)) high = middle;
        else low = middle;
      }
      return high;
    }
    return Infinity;
  }

  update(dt, isDown, origin, aim, range, trace = null) {
    if (isDown && !this.wasDown) this.fire();
    this.wasDown = isDown;
    this.pulse = Math.max(0, this.pulse - dt);
    this.elapsed += dt;
    for (const spark of this.sparks) {
      spark.life -= dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
    }
    this.sparks = this.sparks.filter(spark => spark.life > 0);
    this.beam = null;
    if (!isDown && this.pulse === 0) {
      this.sparkAccumulator = 0;
      return;
    }
    this.firingTime += dt;

    const dx = aim.x - origin.x;
    const dy = aim.y - origin.y;
    // Keep the last direction if the pointer rests directly on the eye.
    if (Math.hypot(dx, dy) > 2) this.angle = Math.atan2(dy, dx);
    const directionX = Math.cos(this.angle);
    const directionY = Math.sin(this.angle);
    const groundDistance = this.groundDistance(origin, directionX, directionY, range);
    let distance = Math.min(range, groundDistance);
    const contact = trace?.(origin, {
      x: origin.x + directionX * distance, y: origin.y + directionY * distance,
    });
    if (contact) distance *= contact.t;
    this.beam = {
      x: origin.x, y: origin.y,
      endX: origin.x + directionX * distance,
      endY: origin.y + directionY * distance,
      hitsGround: !contact && groundDistance <= range,
      hitsTarget: contact?.target ?? null,
      // Stopped by a vehicle (a car, boat or aircraft), which is not a combat target.
      hitsVehicle: Boolean(contact) && !contact.target,
    };
    // Match tiny-hero's drifting embers, with emission based on simulation time.
    this.sparkAccumulator += dt * LASER_SPARK_RATE;
    while (this.sparkAccumulator >= 1) {
      this.sparkAccumulator -= 1;
      const along = this.beam.hitsGround || contact ? distance : this.random() * distance;
      this.sparks.push({
        x: origin.x + directionX * along, y: origin.y + directionY * along,
        vx: (this.random() - 0.5) * 20, vy: -10 - this.random() * 20,
        life: LASER_SPARK_LIFE,
        color: this.random() < 0.5 ? 0xffb03a : 0xff5a3a,
      });
    }
  }

  draw(visualOrigin) {
    const g = this.graphics;
    g.clear();
    for (const spark of this.sparks) {
      g.fillStyle(spark.color, Math.min(1, spark.life / LASER_SPARK_LIFE));
      g.fillRect(Math.round(spark.x), Math.round(spark.y), 1, 1);
    }
    if (!this.beam) return;
    const b = this.beam;
    const origin = visualOrigin ?? b;
    // Use the original sandbox's pulse cadence for both beam and eye flare.
    const pulse = Math.sin(this.firingTime * 60) > 0;
    // Whole game-pixel widths keep the bright core crisp at every camera zoom. Focus (0..1, an
    // unbroken beam building damage) widens the glow and burns the core white-hot.
    const heat = this.heat ?? 0;
    const grow = Math.round(heat * 3);
    for (const [width, color, alpha] of [[(pulse ? 5 : 4) + grow, 0xff2a4a, 0.18 + heat * 0.12],
      [(pulse ? 3 : 2) + Math.round(heat * 2), heat > 0.66 ? 0xff7a3a : 0xff2a4a, 0.5 + heat * 0.2],
      [heat > 0.33 ? 2 : 1, heat > 0.9 ? 0xffffff : 0xfff2c0, 1]]) {
      g.lineStyle(width, color, alpha);
      g.lineBetween(origin.x, origin.y, b.endX, b.endY);
    }
    const eyeX = Math.round(origin.x);
    const eyeY = Math.round(origin.y);
    g.fillStyle(0xff2a4a, pulse ? 0.45 : 0.25);
    g.fillRect(eyeX - 2, eyeY - 2, pulse ? 5 : 4, pulse ? 5 : 4);
    g.fillStyle(0xffffff);
    g.fillRect(eyeX - 1, eyeY - 1, pulse ? 3 : 2, pulse ? 3 : 2);
    if (b.hitsGround || b.hitsTarget || b.hitsVehicle) {
      const spark = Math.floor(this.elapsed * 30) % 2;
      const x = Math.round(b.endX);
      const y = Math.round(b.endY);
      g.fillStyle(0xff6b4a);
      g.fillRect(x - 3 - spark, y - 1, 7 + spark * 2, 2);
      g.fillRect(x - 1, y - 4 - spark, 2, 4);
      g.fillStyle(0xfff1dc);
      g.fillRect(x - 1, y - 1, 3, 2);
    }
  }
}
