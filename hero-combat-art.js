import { HeroFlightWake } from './hero-flight-wake.js';
import { GroundPoundArtwork } from './ground-pound-art.js';

const COLORS = { ink: '#203747', shell: '#edb65e', shade: '#bc7545', light: '#ffe1a1', eye: '#7ff2e6' };
const BOT_LABELS = { gunner: 'GROUND RANGED', drone: 'FLYING RANGED',
  'ground-melee': 'GROUND MELEE', 'flying-melee': 'FLYING MELEE', kamikaze: 'KAMIKAZE', swarm: 'SWARM' };

function createDummyTexture(scene, key = 'training-dummy', gunner = false) {
  if (scene.textures.exists(key)) return;
  const colors = gunner ? { ...COLORS, shell: '#d1887f', shade: '#98535f',
    light: '#fbc3a0', eye: '#ffef9c' } : COLORS;
  const texture = scene.textures.createCanvas(key, 32, 32);
  const c = texture.context;
  const rect = (color, x, y, width, height) => {
    c.fillStyle = color;
    c.fillRect(x, y, width, height);
  };
  rect(colors.ink, 10, 3, 12, 9);
  rect(colors.shell, 11, 4, 10, 7);
  rect(colors.light, 11, 4, 9, 1);
  rect(colors.ink, 12, 6, 8, 3);
  rect(colors.eye, 13, 7, 6, 1);
  rect(colors.ink, 8, 12, 16, 12);
  rect(colors.shell, 9, 13, 14, 9);
  rect(colors.shade, 9, 20, 14, 3);
  rect(colors.light, 10, 13, 12, 1);
  rect(colors.ink, 13, 15, 6, 6);
  rect(colors.eye, 14, 16, 4, 4);
  rect(colors.light, 15, 17, 2, 2);
  for (const x of [5, 24]) {
    rect(colors.ink, x, 13, 3, 8);
    rect(colors.shell, x + 1, 14, 1, 5);
  }
  for (const x of [10, 18]) {
    rect(colors.ink, x, 24, 4, 5);
    rect(colors.shade, x + 1, 24, 2, 3);
  }
  if (gunner) {
    rect(colors.ink, 23, 16, 9, 5);
    rect(colors.shade, 24, 17, 6, 2);
    rect(colors.eye, 30, 17, 2, 2);
  }
  texture.refresh();
}

function createDroneTexture(scene) {
  if (scene.textures.exists('training-drone')) return;
  const texture = scene.textures.createCanvas('training-drone', 32, 32);
  const c = texture.context;
  const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  rect('#203747', 1, 12, 30, 7);
  rect('#839ead', 2, 13, 28, 4);
  rect('#203747', 7, 7, 18, 17);
  rect('#b0c5d0', 8, 8, 16, 14);
  rect('#e5eeeb', 9, 8, 14, 2);
  rect('#627f99', 8, 20, 16, 3);
  rect('#203747', 11, 12, 10, 7);
  rect('#ffb778', 12, 13, 8, 4);
  rect('#fff1bb', 14, 14, 4, 2);
  rect('#203747', 9, 23, 4, 3);
  rect('#203747', 19, 23, 4, 3);
  rect('#7ff2e6', 10, 25, 2, 2);
  rect('#7ff2e6', 20, 25, 2, 2);
  texture.refresh();
}

function createKamikazeTexture(scene) {
  if (scene.textures.exists('training-kamikaze')) return;
  const texture = scene.textures.createCanvas('training-kamikaze', 32, 32);
  const c = texture.context;
  const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  rect('#203747', 7, 6, 18, 20);
  rect('#203747', 4, 10, 24, 12);
  rect('#d35c62', 8, 7, 16, 18);
  rect('#d35c62', 5, 11, 22, 10);
  rect('#ffb394', 9, 7, 14, 2);
  rect('#943d54', 8, 22, 16, 3);
  rect('#203747', 10, 11, 12, 11);
  rect('#ffd179', 11, 12, 10, 9);
  rect('#203747', 15, 13, 2, 4);
  rect('#203747', 15, 18, 2, 2);
  for (const x of [2, 27]) {
    rect('#203747', x, 9, 3, 15);
    rect('#ffd179', x + 1, 10, 1, 5);
    rect('#d35c62', x + 1, 18, 1, 4);
  }
  rect('#203747', 12, 2, 8, 4);
  rect('#ffd179', 13, 3, 6, 2);
  rect('#203747', 11, 26, 10, 3);
  rect('#ffb778', 13, 27, 6, 3);
  texture.refresh();
}

function createSwarmTexture(scene) {
  if (scene.textures.exists('training-swarm')) return;
  const texture = scene.textures.createCanvas('training-swarm', 16, 16);
  const c = texture.context;
  const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  rect('#203747', 0, 5, 16, 5);
  rect('#67b8ab', 1, 6, 14, 2);
  rect('#203747', 4, 3, 8, 10);
  rect('#83d7bb', 5, 4, 6, 7);
  rect('#d8ffe1', 5, 4, 6, 1);
  rect('#408a8f', 5, 10, 6, 2);
  rect('#203747', 6, 6, 4, 4);
  rect('#ffb778', 7, 7, 2, 2);
  rect('#ffd9aa', 7, 7, 2, 1);
  rect('#b3ffe0', 6, 13, 1, 1);
  rect('#b3ffe0', 9, 13, 1, 1);
  texture.refresh();
}

export class CombatArtwork {
  constructor(scene, arena) {
    this.scene = scene;
    this.arena = arena;
    createDummyTexture(scene);
    createDummyTexture(scene, 'training-gunner', true);
    createDroneTexture(scene);
    createKamikazeTexture(scene);
    createSwarmTexture(scene);
    this.graphics = scene.add.graphics().setDepth(9);
    if (arena.props.length) {
      for (const [x, y, text] of [[246, 270, 'CRATES'], [542, 192, 'BREAKABLE WALL'],
        ...(arena.enemies.length ? [[680, 310, 'BOT DRILL'], [455, 320, 'BOTS →']] : [])]) {
        scene.add.text(x, y, text, {
          fontFamily: 'monospace', fontSize: '7px', color: '#243e4c',
        }).setOrigin(0.5).setDepth(8);
      }
    }
    this.numbers = new Map();
    this.wake = new HeroFlightWake();
    this.groundPound = new GroundPoundArtwork(scene);
    this.poundGroundAt = x => arena.groundAt(x);
    this.poundSurfaceAt = x => scene.groundPoundSurface?.(x);
    this.reset();
  }

  reset() {
    this.wake.reset();
    this.groundPound.reset();
    for (const visual of this.targets?.values() ?? []) {
      visual.sprite.destroy();
      visual.label.destroy();
    }
    for (const text of this.numbers.values()) text.destroy();
    for (const pool of Object.values(this.numberPool ?? {})) for (const text of pool) text.destroy();
    this.numbers.clear();
    // Damage numbers are recycled per style: a new Text costs a canvas, a GPU texture and its later
    // deletion, and the laser alone shows one per target every 0.18 s.
    this.numberPool = { ram: [], laser: [], hit: [] };
    this.targets = new Map([...this.arena.targets, ...this.arena.enemies.filter(enemy => !enemy.customArt)].map(target => [target.id, {
      sprite: this.scene.add.image(target.x, target.y, target.enemyType === 'swarm'
        ? 'training-swarm' : target.enemyType === 'kamikaze'
          ? 'training-kamikaze' : target.enemyType === 'gunner'
          ? 'training-gunner' : target.enemyType && !target.grounded
          ? 'training-drone' : 'training-dummy').setDepth(10),
      label: this.scene.add.text(target.x, target.y - 25, target.heavy ? 'HEAVY' : target.anchored ? 'ANCHOR' : 'DUMMY', {
        fontFamily: 'monospace', fontSize: '6px', color: '#243e4c',
      }).setOrigin(0.5).setDepth(10),
    }]));
  }

  draw(elapsed, hero, velocity) {
    const g = this.graphics;
    g.clear();
    this.drawProps(g);
    let leadingHand;
    if (this.wake.pressure > 0.01) {
      const hand = this.scene.rig.getRenderJoints()[1].hand;
      const { size } = this.scene.rig;
      leadingHand = { x: this.scene.rig.image.x + hand[0] * size, y: this.scene.rig.image.y + hand[1] * size,
        angle: this.scene.rig.getRenderPose().spine };
    }
    this.wake.draw(g, hero, velocity, leadingHand);
    const punch = this.scene.rig.punch;
    const selected = this.scene.controlsSuspended || this.scene.enemies?.defeated ? null
      : punch.active ? punch.target
        : this.scene.getPunchAim(this.scene.aimSource === 'gamepad' ? 'gamepad' : 'mouse').target;
    if (this.brackets !== false && this.arena.isPunchTargetValid(hero, selected)) {
      const radius = selected.radius + 5;
      g.lineStyle(1, punch.active ? 0xfff0bf : 0xc9f2ff, 0.75);
      for (const x of [-1, 1]) {
        for (const y of [-1, 1]) {
          const px = selected.x + x * radius, py = selected.y + y * radius;
          g.lineBetween(px, py, px - x * 4, py);
          g.lineBetween(px, py, px, py - y * 4);
        }
      }
    }
    this.groundPound.draw(g, this.arena.groundPounds, elapsed, this.poundGroundAt, this.poundSurfaceAt);
    for (const target of [...this.arena.targets, ...this.arena.enemies]) {
      // Units with their own artwork (the enemy lab's police) have no training sprite, label or bar.
      if (target.customArt) continue;
      const { sprite, label } = this.targets.get(target.id);
      const alive = target.health > 0;
      const swarm = target.enemyType === 'swarm';
      const pack = swarm ? this.arena.enemies.filter(other => other.health > 0
        && other.enemyType === 'swarm' && other.swarmGroup === target.swarmGroup) : [];
      const visible = !target.detonated && (alive || target.deathAge < 0.3);
      sprite.setVisible(visible);
      label.setVisible(alive && (!swarm || pack[0] === target));
      if (!visible) continue;
      const bob = target.anchored || target.grounded ? 0
        : Math.sin(elapsed * 2.5 + target.homeX) * 1.2;
      const recoil = target.reaction * Math.sin(target.reaction * 15) * 0.3 * target.recoil;
      sprite.setPosition(Math.round(target.x), Math.round(target.y + bob));
      sprite.setRotation(alive ? target.spin ?? recoil : target.recoil * target.deathAge * 11);
      sprite.setScale(1 + target.reaction * 0.12, 1 - target.reaction * 0.1);
      sprite.setAlpha(alive ? 1 : Math.max(0, 1 - target.deathAge / 0.3));
      if (target.enemyType) sprite.setFlipX(target.facing < 0);
      const armed = target.enemyType === 'kamikaze' && ['arming', 'charge'].includes(target.state);
      if (target.flash > 0 || (armed && Math.sin(target.stateTime * (target.state === 'charge' ? 50 : 30)) > 0)) {
        sprite.setTint(0xfff6d6).setTintMode(Phaser.TintModes.FILL);
      } else if (target.heavy) sprite.setTint(0xb5c8df).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (target.enemyType === 'ground-melee') sprite.setTint(0x9cd8a0).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (target.enemyType === 'flying-melee') sprite.setTint(0xc3a0ed).setTintMode(Phaser.TintModes.MULTIPLY);
      else sprite.clearTint();
      label.setPosition(Math.round(target.x), Math.round(target.y - (swarm ? 22 : 25)));
      if (swarm && pack[0] === target) {
        label.setPosition(Math.round(pack.reduce((sum, member) => sum + member.x, 0) / pack.length),
          Math.round(Math.min(...pack.map(member => member.y)) - 22));
      }
      if (target.enemyType) {
        const action = { aim: 'AIMING', windup: 'WINDUP', locked: 'LOCKED!',
          strike: 'STRIKING', burst: 'FIRING', arming: 'ARMING!', charge: 'INCOMING!',
          stunned: 'STUNNED', recover: 'RECOVER' }[target.state];
        label.setText(swarm ? `SWARM ×${pack.length} · LASER WEAK` : action ?? BOT_LABELS[target.enemyType]);
        // setColor redraws and re-uploads the text texture even when unchanged; only call it on a change.
        const color = target.state === 'locked' || armed ? '#9b283b' : '#243e4c';
        if (label.style.color !== color) label.setColor(color);
      }
      if (!alive) continue;
      if (target.anchored) {
        g.fillStyle(0x314d58, 0.8);
        g.fillRect(target.homeX - 1, target.homeY + 12, 2, 5);
        g.fillRect(target.homeX - 7, target.homeY + 17, 14, 2);
      } else if (!target.grounded) {
        g.fillStyle(0x7ff2e6, 0.5 + Math.sin(elapsed * 8) * 0.2);
        g.fillRect(Math.round(target.x) - (swarm ? 1 : 3),
          Math.round(target.y + bob) + (swarm ? 7 : 14), swarm ? 2 : 6, 1);
      }
      const barWidth = swarm ? 14 : 28;
      const barY = Math.round(target.y) - (swarm ? 12 : 20);
      g.fillStyle(0x203747);
      g.fillRect(Math.round(target.x) - barWidth / 2, barY, barWidth, 4);
      g.fillStyle(target.health > 35 ? 0x7ff2c4 : 0xffb56e);
      g.fillRect(Math.round(target.x) - barWidth / 2 + 1, barY + 1,
        Math.ceil((barWidth - 2) * target.health / target.maxHealth), 2);
    }

    const liveNumbers = new Set();
    for (const impact of this.arena.impacts) {
      if (impact.kind === 'self-destruct') continue;
      const { x, y, age, fatal, kind } = impact;
      const duration = fatal ? 0.5 : 0.24;
      const fade = Math.max(0, 1 - age / duration);
      const radius = 3 + age * (kind === 'ram' ? 100 : 55);
      if (fade > 0) {
        g.lineStyle(1, kind === 'laser' ? 0xfff5cf : 0xf6ffed, fade);
        g.strokeCircle(x, y, radius);
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4 + impact.id;
          const inner = radius * 0.6;
          const outer = radius + (fatal ? 9 : 4) * fade;
          g.lineBetween(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner,
            x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        }
      }
      if (fatal && !impact.material) {
        for (let i = 0; i < 12; i++) {
          const angle = i * Math.PI / 6 + impact.id;
          const travel = age * (30 + (i % 3) * 25);
          g.fillStyle(i % 2 ? 0xedb65e : 0x203747, Math.max(0, 1 - age / 0.65));
          g.fillRect(Math.round(x + Math.cos(angle) * travel + impact.dx * age * 70),
            Math.round(y + Math.sin(angle) * travel + 90 * age * age), 2, 2);
        }
      }
      if (impact.silent) continue;
      liveNumbers.add(impact.id);
      let text = this.numbers.get(impact.id);
      if (!text) {
        const style = kind === 'ram' || kind === 'laser' ? kind : 'hit';
        const label = `${Math.round(impact.damage)}`;
        text = this.numberPool[style].pop()?.setText(label).setVisible(true)
          ?? this.scene.add.text(x, y, label, {
            fontFamily: 'monospace', fontSize: kind === 'ram' ? '11px' : '8px',
            fontStyle: 'bold', color: kind === 'laser' ? '#fff5cf' : '#ffffff',
            stroke: '#203747', strokeThickness: 2,
          }).setOrigin(0.5).setDepth(13);
        text.poolStyle = style;
        this.numbers.set(impact.id, text);
      }
      text.setPosition(Math.round(x + impact.dx * age * 12), Math.round(y - 15 - age * 26));
      text.setAlpha(Math.max(0, 1 - age / 0.65));
    }
    for (const [id, text] of this.numbers) {
      if (!liveNumbers.has(id)) {
        this.numberPool[text.poolStyle].push(text.setVisible(false));
        this.numbers.delete(id);
      }
    }
  }

  drawProps(g) {
    for (const prop of this.arena.props) {
      // Scenery props, such as city buildings, draw themselves in the world art.
      if (prop.health <= 0 || prop.scenery) continue;
      const left = prop.x - prop.width / 2;
      const top = prop.y - prop.height / 2;
      const wood = prop.material === 'wood';
      const detailX = wood ? 1 : prop.width / 16;
      const detailY = wood ? 1 : prop.height / 16;
      g.fillStyle(wood ? 0x513c36 : 0x415663);
      g.fillRect(left, top, prop.width, prop.height);
      g.fillStyle(prop.flash > 0 ? 0xfff0c3 : wood ? 0xbc874b : 0x96a9aa);
      g.fillRect(left + 1, top + 1, prop.width - 2, prop.height - 2);
      g.fillStyle(wood ? 0xe5ba7d : 0xc5d2ca);
      g.fillRect(left + 1, top + 1, prop.width - 2, 1);
      g.fillStyle(wood ? 0x8f5c3d : 0x657c82);
      g.fillRect(left + 1, top + prop.height - 3, prop.width - 2, 2);
      if (wood) {
        g.lineStyle(1, 0x8f5c3d);
        g.lineBetween(left + 3, top + 6, left + prop.width - 3, top + 6);
        g.lineBetween(left + 3, top + 12, left + prop.width - 3, top + 12);
        g.lineStyle(2, 0xe5ba7d);
        g.lineBetween(left + 3, top + 3, left + prop.width - 4, top + prop.height - 4);
        g.lineBetween(left + prop.width - 4, top + 3, left + 3, top + prop.height - 4);
      } else {
        g.fillStyle(0x7e9499, 0.7);
        g.fillRect(left + Math.round(3 * detailX), top + Math.round(4 * detailY),
          Math.max(1, Math.round(3 * detailX)), 1);
        g.fillRect(left + Math.round(9 * detailX), top + Math.round(10 * detailY),
          Math.max(1, Math.round(2 * detailX)), 1);
      }
      if (prop.health < prop.maxHealth) {
        g.lineStyle(1, wood ? 0x513c36 : 0x344e59);
        g.lineBetween(prop.x - 2 * detailX, top + 2 * detailY,
          prop.x + detailX, prop.y - 2 * detailY);
        g.lineBetween(prop.x + detailX, prop.y - 2 * detailY,
          prop.x - 2 * detailX, prop.y + 2 * detailY);
        g.lineBetween(prop.x - 2 * detailX, prop.y + 2 * detailY,
          prop.x + 3 * detailX, top + prop.height - 2 * detailY);
        if (prop.health < prop.maxHealth / 2) {
          g.lineBetween(prop.x + detailX, prop.y - 2 * detailY,
            left + prop.width - 2 * detailX, prop.y - 3 * detailY);
          g.lineBetween(prop.x - 2 * detailX, prop.y + 2 * detailY,
            left + 2 * detailX, prop.y + 4 * detailY);
        }
      }
    }
    for (const piece of this.arena.debris) {
      g.fillStyle(piece.material === 'wood' ? 0xd3a36b : 0x9eafb0,
        Math.min(1, (1.2 - piece.age) * 3));
      g.fillRect(Math.round(piece.x), Math.round(piece.y), piece.size, piece.size);
    }
  }
}
