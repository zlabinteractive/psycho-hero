import { lerpColor } from './planet.js';

// Whales and dolphins drawn as one flexible body (feedback #15, #18): a spine of segments that
// bends up and down along its length (cetaceans flex dorsoventrally, which reads perfectly side-on),
// with a darker back, a pale belly, fins and flukes. Every part below the water line is drawn tinted
// toward the water and faded, so a body diving or rising shows as a shadow under the surface.
// Only fillTriangle, fillRect and fillCircle, so it also works through a fading pen.
const SEGMENTS = 14;

// Half-thickness along the body (0 head .. 1 tail) as a fraction of `thick`.
function profile(s, beak) {
  if (s < 0.08) return beak ? 0.25 + s * 6 : 0.55 + s * 4;
  if (s < 0.3) return Math.min(1, (beak ? 0.73 : 0.87) + (s - 0.08) * 1.2);
  // A real tail stock stays fairly deep right back to the flukes, not a hairline.
  if (s < 0.82) return 1 - Math.pow((s - 0.3) / 0.52, 1.5) * 0.7;
  return 0.3 - (s - 0.82) * 0.7;
}

// o: { x, y (centre), dir (±1 facing), angle (rad, + = nose up), length, thick (half px), back,
//   belly, sea (water line y), water (colour), wave (bend phase), bend (px at the tail), beak,
//   dorsal (fin height, × thick), flipper, grooves, alpha, roll (0 upright .. 1 belly-up) }
// Rolling over keeps the side-on outline (the body is round in section) but swaps which colour
// faces up, sinks the dorsal fin out of sight and swings the flipper from below the body to above.
export function drawCetacean(g, o) {
  const { x, y, dir, angle, length, thick, sea, water, wave = 0, bend = 0, alpha = 1, roll = 0 } = o;
  const turn = Math.cos(roll * Math.PI);
  const mix = roll * roll * (3 - 2 * roll);
  const top = lerpColor(o.back, o.belly, mix);
  const under = lerpColor(o.belly, o.back, mix);
  const hx = dir * Math.cos(angle);
  const hy = -Math.sin(angle);
  // Toward the back: up when level, whichever way the body faces.
  const nx = dir * hy;
  const ny = -dir * hx;
  const spine = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const s = i / SEGMENTS;
    const along = (0.5 - s) * length;
    // The flex grows toward the tail, as a wave running back along the body.
    const flex = bend * Math.sin(wave - s * 4.2) * Math.pow(s, 1.6);
    const px = x + hx * along + nx * flex;
    const py = y + hy * along + ny * flex;
    const half = thick * profile(s, o.beak);
    spine.push({ s, px, py, ux: px + nx * half * 0.95, uy: py + ny * half * 0.95, dx: px - nx * half * 1.05, dy: py - ny * half * 1.05 });
  }
  const tint = (color, my) => {
    const under = my > sea + 1;
    g.fillStyle(under ? lerpColor(color, water, 0.55) : color, alpha * (under ? 0.5 : 1));
  };
  for (let i = 0; i < SEGMENTS; i++) {
    const a = spine[i];
    const b = spine[i + 1];
    tint(top, (a.uy + b.py) / 2);
    g.fillTriangle(a.ux, a.uy, b.ux, b.uy, b.px, b.py);
    g.fillTriangle(a.ux, a.uy, b.px, b.py, a.px, a.py);
    tint(under, (a.dy + b.py) / 2);
    g.fillTriangle(a.px, a.py, b.px, b.py, b.dx, b.dy);
    g.fillTriangle(a.px, a.py, b.dx, b.dy, a.dx, a.dy);
  }
  const at = s => spine[Math.min(SEGMENTS, Math.round(s * SEGMENTS))];
  // Dorsal fin, swept back.
  if (o.dorsal && turn > 0.15) {
    const f = at(o.beak ? 0.45 : 0.68);
    const h = thick * o.dorsal * turn;
    tint(o.back, f.uy - h / 2);
    g.fillTriangle(f.ux + hx * thick * 0.6, f.uy + hy * thick * 0.6, f.ux - hx * thick * 1.6 + nx * h, f.uy - hy * thick * 1.6 + ny * h,
      f.ux - hx * thick * 1.2, f.uy - hy * thick * 1.2);
  }
  // Pectoral flipper, angled down and back from under the chest.
  if (o.flipper) {
    // Rooted on the belly side, low on the chest: below the body upright, above it belly-up.
    const f = at(0.24);
    const l = thick * o.flipper;
    const half = thick * profile(0.24, o.beak) * 0.85;
    const bx = f.px - nx * half * turn;
    const by = f.py - ny * half * turn;
    tint(lerpColor(o.back, o.belly, mix * 0.5), by - ny * l * 0.3 * turn);
    g.fillTriangle(bx + hx * thick * 0.4, by + hy * thick * 0.4, bx - hx * thick * 0.5, by - hy * thick * 0.5,
      bx - hx * l * 0.75 - nx * l * 0.55 * turn, by - hy * l * 0.75 - ny * l * 0.55 * turn);
  }
  // Flukes: flat and horizontal like a real whale's, so side-on they show as a slim swept-back
  // blade off the tail stock with a shallow notch, never an upright fish's tail.
  const t = spine[SEGMENTS];
  const p = spine[SEGMENTS - 1];
  const tx = t.px - p.px;
  const ty = t.py - p.py;
  const tl = Math.hypot(tx, ty) || 1;
  const [ex, ey] = [tx / tl, ty / tl];
  const span = length * (o.beak ? 0.13 : 0.11);
  const root = Math.max(1.5, thick * 0.2);
  const [rx, ry] = [t.px - ex * span * 0.1, t.py - ey * span * 0.1];
  const at2 = (back, side) => [rx + ex * span * back + nx * span * side, ry + ey * span * back + ny * span * side];
  // A leaf-shaped blade: widest a third of the way back, tapering to a point.
  const [ax, ay] = [rx + nx * root, ry + ny * root];
  const [bx2, by2] = [rx - nx * root, ry - ny * root];
  const [mx, my] = at2(0.45, 0.16);
  const [qx, qy] = at2(0.45, -0.12);
  const [px2, py2] = at2(1.25, 0.03);
  tint(top, t.py);
  g.fillTriangle(ax, ay, bx2, by2, mx, my);
  g.fillTriangle(bx2, by2, qx, qy, mx, my);
  g.fillTriangle(mx, my, qx, qy, px2, py2);
  // Throat grooves: pale lines along the lower jaw and chest, on the belly side.
  if (o.grooves) {
    const side = turn >= 0 ? 1 : -1;
    for (let k = 1; k <= 3; k++) {
      for (let i = 1; i <= 5; i++) {
        const a = at(i / 16);
        const gx = (side > 0 ? a.dx : a.ux) + side * nx * thick * 0.18 * k;
        const gy = (side > 0 ? a.dy : a.uy) + side * ny * thick * 0.18 * k;
        tint(lerpColor(o.belly, 0xffffff, 0.35), gy);
        g.fillRect(Math.round(gx), Math.round(gy), 1, 1);
      }
    }
  }
  // Eye and the line of the mouth.
  const eye = at(o.beak ? 0.1 : 0.12);
  const ex2 = eye.px - nx * thick * 0.15;
  const ey2 = eye.py - ny * thick * 0.15;
  tint(0x1e2428, ey2);
  if (o.deadEye) {
    const x0 = Math.round(ex2);
    const y0 = Math.round(ey2);
    g.fillRect(x0 - 2, y0 - 2, 1, 1);
    g.fillRect(x0 + 2, y0 - 2, 1, 1);
    g.fillRect(x0 - 1, y0 - 1, 1, 1);
    g.fillRect(x0 + 1, y0 - 1, 1, 1);
    g.fillRect(x0, y0, 1, 1);
    g.fillRect(x0 - 1, y0 + 1, 1, 1);
    g.fillRect(x0 + 1, y0 + 1, 1, 1);
    g.fillRect(x0 - 2, y0 + 2, 1, 1);
    g.fillRect(x0 + 2, y0 + 2, 1, 1);
  } else {
    g.fillRect(Math.round(ex2), Math.round(ey2), Math.max(1, Math.round(thick * 0.12)), Math.max(1, Math.round(thick * 0.12)));
  }
}

// The point on the back where the blowhole sits, for spouts.
export function blowhole(o) {
  const hx = o.dir * Math.cos(o.angle);
  const hy = -Math.sin(o.angle);
  const along = (0.5 - 0.16) * o.length;
  const [nx, ny] = [o.dir * hy, -o.dir * hx];
  return { x: o.x + hx * along + nx * o.thick * 0.9, y: o.y + hy * along + ny * o.thick * 0.9 };
}
