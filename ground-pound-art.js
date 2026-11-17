// Presentation only: damage and knockback happen at contact in CombatArena.
// Seeds, fracture paths and fragments are built once per landing; dust sprites share one texture.
const LIFE = 4.5, DUST_LIFE = 0.95, MAX_IMPACTS = 8, MAX_PUFFS = 96;
const DUST_KEY = 'hero-impact-dust';
const GRASS = { dust: 0xa49c79, chip: 0x665b42, light: 0xa7b77e, ink: 0x34443a };
const WATER = { dust: 0xe0f2f4, chip: 0xc8eaf2, light: 0xffffff, ink: 0x4699b4 };
const noise = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class GroundPoundArtwork {
  constructor(scene) {
    this.scene = scene;
    this.marks = scene.add.graphics().setDepth(2.5);
    this.puffs = [];
    this.reset();
    if (!scene.textures.exists(DUST_KEY)) {
      const texture = scene.textures.createCanvas(DUST_KEY, 64, 64);
      const c = texture.context;
      for (let i = 0; i < 9; i++) {
        const x = 20 + noise(i) * 24, y = 20 + noise(i + 10) * 24;
        const radius = 12 + noise(i + 20) * 8;
        const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,0.25)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.13)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gradient;
        c.fillRect(0, 0, 64, 64);
      }
      texture.refresh();
    }
  }

  reset() {
    this.seen = new WeakSet();
    this.impacts = [];
    this.marks.clear();
    for (const puff of this.puffs) puff.setVisible(false);
  }

  record(wave, elapsed, groundAt, surface) {
    const water = Boolean(wave.water || surface?.water);
    const palette = water ? WATER : surface ?? GRASS;
    const seed = wave.x * 0.71 + elapsed * 17;
    const power = 0.55 + wave.power * 0.45;
    const impact = { ...wave, water, palette, power, born: elapsed - wave.age,
      fragments: [], cracks: [], dust: [] };
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? -1 : 1, n = seed + i * 7;
      impact.fragments.push({ vx: side * (25 + noise(n) * 150) * power,
        vy: (45 + noise(n + 1) * 105) * power, size: 0.7 + noise(n + 2) * 1.8,
        spin: (noise(n + 3) - 0.5) * 12, shade: noise(n + 4) > 0.5 });
    }
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? -1 : 1, n = seed + i * 11;
      impact.dust.push({ side, speed: (i < 4 ? 30 + noise(n) * 70 : 140 + noise(n) * 310) * power,
        lift: 5 + noise(n + 1) * 22, size: (22 + noise(n + 2) * 28) * power,
        delay: noise(n + 3) * 0.07, stretch: 0.6 + noise(n + 4) * 0.5 });
    }
    if (!water) for (let i = 0; i < 7; i++) {
      const side = i % 2 ? -1 : 1, n = seed + i * 13;
      const reach = side * (14 + noise(n) * 37) * power;
      const path = [];
      for (let j = 0; j < 5; j++) {
        const x = wave.x + reach * j / 4;
        path.push({ x, y: groundAt(x) + 1 + i % 3 * 1.2 + noise(n + j + 1) * 2.5 });
      }
      impact.cracks.push(path);
    }
    this.impacts.push(impact);
    if (this.impacts.length > MAX_IMPACTS) this.impacts.shift();
  }

  draw(g, waves, elapsed, groundAt, surfaceAt) {
    for (const wave of waves) if (!this.seen.has(wave)) {
      this.seen.add(wave);
      this.record(wave, elapsed, groundAt, surfaceAt?.(wave.x));
    }
    let kept = 0;
    for (const impact of this.impacts) if (elapsed - impact.born < LIFE) this.impacts[kept++] = impact;
    this.impacts.length = kept;
    this.marks.clear();
    const view = this.scene.cameras.main.worldView;
    let puffCount = 0;
    for (const impact of this.impacts) {
      const { x, y, palette, power, water } = impact;
      const age = Math.max(0, elapsed - impact.born);
      if (view && (x + 220 < view.x || x - 220 > view.right || y + 20 < view.y || y - 90 > view.bottom)) continue;
      const scarFade = Math.min(1, (LIFE - age) / 1.5) * Math.min(1, age / 0.035);
      if (!water) {
        const marks = this.marks;
        marks.fillStyle(palette.ink, scarFade * 0.24);
        marks.fillEllipse(x, y + 2, 35 * power, 5 * power, 16);
        for (const path of impact.cracks) {
          marks.lineStyle(1.5, palette.ink, scarFade * 0.8);
          marks.beginPath(); marks.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) marks.lineTo(path[i].x, path[i].y);
          marks.strokePath();
          marks.lineStyle(0.6, palette.light, scarFade * 0.6);
          marks.lineBetween(path[2].x, path[2].y + 1, path[3].x, path[3].y + 1);
        }
      }
      // Two to four frames of contact light, tightly attached to the impact point.
      if (age < 0.065) {
        const alpha = (1 - age / 0.065) * 0.9;
        g.fillStyle(0xfff7df, alpha);
        g.fillEllipse(x, y - 1, (14 + age * 280) * power, (4 + age * 50) * power, 16);
        g.fillTriangle(x - 3, y, x + 1, y - 15 * power, x + 5, y);
      }
      if (water && age < 0.65) {
        const radius = impact.radius * (1 - Math.exp(-age * 7));
        g.lineStyle(1.5, WATER.light, (1 - age / 0.65) * 0.7);
        g.strokeEllipse(x, y, radius * 2, radius * 0.12 + 2);
      }
      if (age < 0.8) for (let i = 0; i < impact.fragments.length; i++) {
        const piece = impact.fragments[i];
        const xx = x + piece.vx * age;
        const floor = groundAt(xx), yy = Math.min(floor - 1, y - 2 - piece.vy * age + 190 * age * age);
        const alpha = Math.min(1, (0.8 - age) / 0.22);
        g.save(); g.translateCanvas(xx, yy); g.rotateCanvas(piece.spin * age);
        g.fillStyle(piece.shade ? palette.chip : palette.light, alpha);
        g.fillTriangle(-piece.size, 0, piece.size * 0.8, -piece.size * 0.65, piece.size * 0.5, piece.size * 0.8);
        g.restore();
      }
      if (age < DUST_LIFE) for (const puff of impact.dust) {
        const t = age - puff.delay;
        if (t < 0 || puffCount >= MAX_PUFFS) continue;
        let image = this.puffs[puffCount];
        if (!image) {
          image = this.scene.add.image(0, 0, DUST_KEY).setDepth(9);
          this.puffs.push(image);
        }
        puffCount++;
        const travel = puff.side * puff.speed * (1 - Math.exp(-t * 3)) / 3;
        const xx = x + travel, size = puff.size * (0.65 + t * 2.3);
        const alpha = Math.min(1, t / 0.035) * Math.max(0, 1 - age / DUST_LIFE) ** 1.6;
        image.setVisible(true).setPosition(xx, groundAt(xx) - size * 0.13 - puff.lift * t)
          .setDisplaySize(size * 1.4, size * puff.stretch).setTint(palette.dust).setAlpha(alpha);
      }
    }
    for (let i = puffCount; i < this.puffs.length; i++) this.puffs[i].setVisible(false);
  }
}
