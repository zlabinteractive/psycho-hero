import { ENEMY_RULES, TRACER_LIFE, TRACER_SPEED } from './enemy-system.js';
import { drawGunRound, enemyShotColor, bulletScreenZoom, MISS_TRAIL_END, MISS_TRAIL_FADE } from './enemy-attack-art.js';

export class EnemyArtwork {
  constructor(scene, system) {
    this.system = system;
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(12);
  }

  draw(elapsed, hero, image) {
    const g = this.graphics;
    const zoom = bulletScreenZoom(this.scene);
    g.clear();
    for (const enemy of this.system.arena.enemies) {
      const rule = ENEMY_RULES[enemy.enemyType];
      if (rule.attack === 'self-destruct') {
        this.drawKamikaze(g, enemy, rule, elapsed);
        continue;
      }
      if (rule.attack === 'melee') {
        // warnings off: the enemy's own windup pose is the telegraph.
        if (this.warnings !== false) this.drawMelee(g, enemy, rule);
        continue;
      }
      // warnings off (the enemy lab): the officer's raised pistol and muzzle flash are the telegraph.
      if (this.warnings === false || enemy.health <= 0 || !['aim', 'locked', 'burst'].includes(enemy.state)) continue;
      const locked = enemy.state !== 'aim';
      const color = locked ? 0xf06467 : 0xffd179;
      const range = rule.range;
      const end = { x: enemy.x + enemy.aim.x * range, y: enemy.y + enemy.aim.y * range };
      const wall = this.system.obstruction(enemy, end);
      if (wall) {
        end.x = enemy.x + (end.x - enemy.x) * wall.t;
        end.y = enemy.y + (end.y - enemy.y) * wall.t;
      }
      g.lineStyle(1, color, locked ? 0.8 : 0.35);
      // Dashed lines read as warnings, distinct from the hero's continuous eye laser.
      const length = Math.hypot(end.x - enemy.x, end.y - enemy.y);
      for (let offset = 16; offset < length; offset += 10) {
        const tail = Math.min(length, offset + (locked ? 7 : 4));
        g.lineBetween(enemy.x + enemy.aim.x * offset, enemy.y + enemy.aim.y * offset,
          enemy.x + enemy.aim.x * tail, enemy.y + enemy.aim.y * tail);
      }
      g.lineStyle(1, color, 0.7 + Math.sin(elapsed * 20) * 0.25);
      g.strokeCircle(enemy.x, enemy.y, locked ? 17 : 15);
      if (locked) {
        const dx = hero.x - enemy.x;
        const dy = hero.y - enemy.y;
        const distance = Math.min(range, Math.hypot(dx, dy));
        const x = enemy.x + enemy.aim.x * distance;
        const y = enemy.y + enemy.aim.y * distance;
        g.strokeCircle(x, y, 6);
        g.lineBetween(x - 9, y, x + 9, y);
        g.lineBetween(x, y - 9, x, y + 9);
      }
    }
    for (const shot of this.system.projectiles) {
      const speed = Math.hypot(shot.vx, shot.vy) || 1;
      drawGunRound(g, shot.x, shot.y, shot.vx / speed, shot.vy / speed,
        Math.min(1, (4 - shot.age) / 0.15), 10, enemyShotColor(shot.type), zoom);
    }
    // One moving streak per shot, like the VTOL. No persistent line along the entire path.
    // Misses fade into the distance; muzzle flashes retain their brief spark animation.
    const frame = TRACER_LIFE / 8;
    for (const tracer of this.system.tracers) {
      const color = enemyShotColor(tracer.type);
      const f = tracer.age / frame;
      const dx = tracer.x2 - tracer.x1;
      const dy = tracer.y2 - tracer.y1;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const gap = 10 * tracer.flash;
      const bx = tracer.x1 + ux * gap;
      const by = tracer.y1 + uy * gap;
      const end = tracer.hit ? length : Math.min(length, MISS_TRAIL_END);
      const speed = tracer.speed ?? TRACER_SPEED;
      const roundLength = tracer.length ?? 10;
      const d = tracer.age * speed;
      if (d < end) {
        const head = Math.min(end, d + roundLength);
        const distanceFade = tracer.hit ? 1 : Math.min(1, (end - d) / Math.max(1, end - MISS_TRAIL_FADE));
        const travel = length / speed;
        const fade = Math.min(1, (travel - tracer.age) / Math.min(0.15, travel * 0.3)) * distanceFade;
        drawGunRound(g, tracer.x1 + ux * head, tracer.y1 + uy * head, ux, uy, fade, roundLength, color, zoom, head);
      }
      if (f < 2) {
        const s = Math.round(3 * tracer.flash);
        g.fillStyle(color);
        for (let i = -1; i <= 1; i++) {
          const size = i === 0 ? s + 2 : s;
          g.fillRect(Math.round(bx + ux * i * s - size / 2), Math.round(by + uy * i * s - size / 2), size, size);
        }
      }
      if (f >= 2 && f < 8) {
        const p = (f - 2) / 6;
        g.fillStyle(color, 1 - p);
        for (let i = 0; i < 7; i++) {
          const a = i * 2.39;
          const r = 2 + p * 7 + (i % 3);
          const size = i % 2 ? 2 : 1;
          g.fillRect(Math.round(bx + Math.cos(a) * r + ux * p * 6), Math.round(by + Math.sin(a) * r * 0.7 + uy * p * 6 - p * 3), size, size);
        }
      }
    }
    for (const impact of this.system.impacts) {
      if (impact.age < 0) continue;
      if (impact.kind === 'explosion') {
        this.drawExplosion(g, impact);
        continue;
      }
      g.lineStyle(1, impact.hero ? 0xff817d : 0xffe4a1, 1 - impact.age / 0.25);
      g.strokeCircle(impact.x, impact.y, 2 + impact.age * 35);
    }
    const state = this.system.hero;
    if (state.flash > 0) image.setTint(0xffe9de).setTintMode(Phaser.TintModes.FILL);
    else image.clearTint();
    if (!this.system.defeated) {
      // Hit protection and the last moments of the revive grace flicker; the long grace shimmers.
      const flicker = state.invulnerable > 0 && state.invulnerable < 1.5 && Math.sin(elapsed * 45) > 0;
      image.setAlpha(flicker ? 0.4 : state.invulnerable >= 1.5 ? 0.8 + 0.2 * Math.sin(elapsed * 6) : 1);
    }
  }

  drawKamikaze(g, enemy, rule, elapsed) {
    if (enemy.health <= 0 || !['arming', 'charge'].includes(enemy.state)) return;
    const charging = enemy.state === 'charge';
    const progress = Math.min(1, enemy.stateTime / (charging ? rule.fuse : rule.arm));
    const pulse = 0.5 + Math.sin(elapsed * (charging ? 45 : 25)) * 0.2;
    const color = charging ? 0xf06467 : 0xffb778;
    g.fillStyle(color, 0.07 + progress * 0.05);
    g.fillCircle(enemy.x, enemy.y, rule.blastRadius);
    g.lineStyle(1, color, pulse);
    g.strokeCircle(enemy.x, enemy.y, rule.blastRadius);
    g.lineStyle(2, color, 0.9);
    g.beginPath();
    g.arc(enemy.x, enemy.y, enemy.radius + 5, -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * (charging ? 1 - progress : progress));
    g.strokePath();
    if (charging) {
      g.lineStyle(3, 0xffd179, 0.6);
      g.lineBetween(enemy.x - enemy.aim.x * 23, enemy.y - enemy.aim.y * 23,
        enemy.x - enemy.aim.x * 13, enemy.y - enemy.aim.y * 13);
    }
  }

  drawExplosion(g, impact) {
    const progress = Math.min(1, impact.age / impact.duration);
    const fade = 1 - progress;
    const radius = impact.radius * Math.min(1, 0.3 + progress * 2.5);
    g.fillStyle(0xffb778, fade * fade * 0.3);
    g.fillCircle(impact.x, impact.y, radius);
    g.fillStyle(0xfff6d3, Math.max(0, 1 - progress * 4));
    g.fillCircle(impact.x, impact.y, radius * 0.6);
    g.lineStyle(3 * fade + 1, 0xffd179, fade);
    g.strokeCircle(impact.x, impact.y, radius);
    g.lineStyle(1, 0xf06467, fade * 0.8);
    g.strokeCircle(impact.x, impact.y, radius * 0.75);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const travel = radius * (0.5 + progress * (0.8 + i % 3 * 0.2));
      g.fillStyle(i % 2 ? 0x203747 : 0xffd179, fade);
      g.fillRect(Math.round(impact.x + Math.cos(angle) * travel),
        Math.round(impact.y + Math.sin(angle) * travel + impact.age ** 2 * 45), 2, 2);
    }
  }

  drawMelee(g, enemy, rule) {
    if (enemy.health <= 0 || !['windup', 'locked', 'strike'].includes(enemy.state)) return;
    const striking = enemy.state === 'strike';
    const color = enemy.state === 'windup' ? 0xffd179 : 0xf06467;
    const remaining = Math.max(0, rule.duration - (striking ? enemy.stateTime : 0));
    const reach = rule.flying ? rule.lungeSpeed * remaining : rule.reach;
    const end = { x: enemy.x + enemy.aim.x * reach, y: enemy.y + enemy.aim.y * reach };
    const wall = this.system.obstruction(enemy, end);
    const distance = reach * (wall?.t ?? 1);
    end.x = enemy.x + enemy.aim.x * distance;
    end.y = enemy.y + enemy.aim.y * distance;
    g.lineStyle(striking ? 3 : 1, color, striking ? 0.9 : 0.65);
    g.lineBetween(enemy.x, enemy.y, end.x, end.y);
    g.strokeCircle(end.x, end.y, rule.attackRadius);
    if (striking && !rule.flying) {
      g.fillStyle(0xffd179);
      g.fillRect(end.x - 3, end.y - 3, 6, 6);
    }
  }
}
