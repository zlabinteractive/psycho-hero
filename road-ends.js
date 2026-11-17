// Road ends (they replaced the road tunnels, then a junction turn-off; the owner found both odd,
// 2026-11-11). Wherever a road ends — short of open water, at an area's own ends, and at Green
// City's two ends — there is nothing drawn: cars ease to a roll at the end and fade out, and new
// traffic fades in there. This is where one area's traffic hands over to the next, so cars never
// U-turn and never leave their own area.
// FADE: how far (px of travel) a car rolls on while fading out (or in). Along the road it moves
// DRIFT px per px of that travel, so it barely creeps past the end.
export const FADE = 54;
export const DRIFT = 0.35;

// Green City's and Windmill Fields' road ends between them and at the city's west end, in world x
// (the old tunnel mouths). dir points past the end of the road.
export const ROAD_ENDS = Object.freeze([
  { id: 'ember-end', x: 128, dir: -1 },
  { id: 'meadow-end-city', x: 5254, dir: 1 },
  { id: 'meadow-end-fields', x: 5398, dir: -1 },
]);

// An area's [west, east] road ends from ROAD_ENDS (null where it has none), for areas spanning
// from..to.
export function areaEnds(from, to) {
  const west = ROAD_ENDS.find(end => end.dir < 0 && end.x >= from - 60 && end.x <= from + 400);
  const east = ROAD_ENDS.find(end => end.dir > 0 && end.x <= to + 60 && end.x >= to - 400);
  return [west?.x ?? null, east?.x ?? null];
}
