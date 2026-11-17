// Visual sizes only: distant attacks keep a readable silhouette without enlarging their hit boxes.
export const attackVisualScale = camera => Math.max(1, Math.min(1.25, 1 / (camera?.zoom || 1)));

// Miss trails disappear into the distance instead of spanning the entire view like a laser.
// These limits affect the drawing only; weapon range and damage stay with EnemySystem.
export const MISS_TRAIL_END = 420;
export const MISS_TRAIL_FADE = 240;

// The approved comparison-board colours identify weapon families; white is deliberately excluded.
export const SHOT_COLORS = Object.freeze({
  pistol: 0xffff00, drone: 0xf5ff3b, rifle: 0xffdf00, heavy: 0xffb800, cannon: 0xff403a,
});
export const SHOT_COLOR = SHOT_COLORS.pistol;
const ENEMY_SHOT_COLORS = Object.freeze({
  gunner: SHOT_COLORS.pistol, police: SHOT_COLORS.pistol, 'police-heli': SHOT_COLORS.pistol,
  drone: SHOT_COLORS.drone, 'police-drone': SHOT_COLORS.drone,
  swat: SHOT_COLORS.rifle, soldier: SHOT_COLORS.rifle, 'heli-rifle': SHOT_COLORS.rifle,
  'truck-gun': SHOT_COLORS.heavy, autocannon: SHOT_COLORS.heavy, 'tank-gun': SHOT_COLORS.heavy,
  'chin-gun': SHOT_COLORS.cannon, sniper: SHOT_COLORS.cannon, 'police-sniper': SHOT_COLORS.cannon,
  'police-heli-sniper': SHOT_COLORS.cannon, 'police-breacher': SHOT_COLORS.heavy,
  'police-rider': SHOT_COLORS.pistol, 'sky-marshal': SHOT_COLORS.cannon,
  vtol: SHOT_COLORS.cannon, fighter: SHOT_COLORS.cannon,
});
export const enemyShotColor = type => ENEMY_SHOT_COLORS[type] ?? SHOT_COLOR;

// CSS pixels per world pixel, including high-DPI canvas scaling. Other attack cues stay restrained.
export const bulletScreenZoom = scene => (scene.cameras.main.zoom || 1) / (scene.scale?.displayScale?.x || 1);

export function drawGunRound(g, x, y, ux, uy, fade = 1, length = 10, color = SHOT_COLOR,
  screenZoom = 1, tailLimit = Infinity) {
  if (fade <= 0) return;
  const zoom = Math.max(0.05, screenZoom);
  const scale = Math.max(1, 1 / zoom);
  // Keep each weapon's short streak on screen. Grow only its coloured core as zoom falls,
  // smoothly reaching 1.5 CSS pixels; the dark edge stays a subtle half-pixel on each side.
  length = Math.min(length * scale, tailLimit);
  const core = Math.max(1, Math.min(1.5, 1 / zoom) / zoom);
  g.lineStyle(core + scale, 0x202632, 0.65 * fade);
  g.lineBetween(x - ux * length, y - uy * length, x, y);
  g.lineStyle(core, color, fade);
  g.lineBetween(x - ux * length, y - uy * length, x, y);
}
