// Map-lab planet: one hand-authored equatorial loop. Everything is a pure function of world x,
// so a later polar renderer (space view) can reuse it: angle = x / CIRCUMFERENCE * 2π.

// 65,400 px: about 177 s around at 370.5 px/s fast travel.
export const CIRCUMFERENCE = 65400;
const SEA_LEVEL = 0;

// sky: optional tint the sky eases toward while the camera is over this kind.
const KINDS = {
  city: { ground: [0xa9adb3, 0x6d7178, 0x45494f] },
  village: { ground: [0x8fc782, 0x6b8a52, 0x4a5e3a] },
  farmland: { ground: [0xc9c46a, 0x8f8a4a, 0x5e5236] },
  forest: { ground: [0x5f9e5a, 0x4a6b3a, 0x2f4730], water: 0x3d8fc6 },
  beach: { ground: [0xf0dc9a, 0xd4b979, 0xa58a5a], water: 0x2f9fd0 },
  ocean: { ground: [0xd4b979, 0x8a7a58, 0x5a5040], water: 0x1f78b8 },
  volcano: { ground: [0x5a4545, 0x2f2626, 0x1e1818], sky: 0xc9937e },
  lava: { ground: [0xff6a2a, 0x7a2e1e, 0x1e1818], sky: 0xd0846a },
  // The Red Dunes: rust-red sand.
  desert: { ground: [0xd9956a, 0xb8764c, 0x8a5638], sky: 0xf0cf96 },
  oasis: { ground: [0x9aa862, 0xc9a35f, 0x9a7445], sky: 0xf0cf96 },
  canyon: { ground: [0xc9683e, 0x9a4a2e, 0x6e3322], water: 0x4a9ac0, sky: 0xeab98a },
  savanna: { ground: [0xc8b65a, 0x9a8a45, 0x6b5e35], sky: 0xeed3a0 },
  mountains: { ground: [0x8a8f8a, 0x62665f, 0x43463f], snowline: 220 },
  taiga: { ground: [0xdde8ea, 0x5e6e58, 0x3a4636], sky: 0xdcebf2 },
  tundra: { ground: [0xe8f0f2, 0x9aa8a8, 0x6a7676], water: 0xcfe8f4, sky: 0xe4f0f5 },
  fjord: { ground: [0x7d8a7a, 0x5a6358, 0x3a4038], water: 0x2a6a8f, sky: 0xd2e3ec },
};
const DEFAULT_WATER = 0x2f8fc8;

// [end x, name, kind, country]; each region starts where the previous one ends.
// Country names are placeholders.
export const REGIONS = [
  [5400, 'Green City', 'city', 'Meadowland'],
  [6200, 'Windmill Fields', 'farmland', 'Meadowland'],
  [6700, 'Windmill', 'village', 'Meadowland'],
  [7200, 'Windmill Fields', 'farmland', 'Meadowland'],
  [8400, 'Oakwood', 'forest', 'Meadowland'],
  [9200, 'Mirror Lake', 'forest', 'Meadowland'],
  [10200, 'Oakwood', 'forest', 'Meadowland'],
  [11800, 'Rivertown', 'city', 'Meadowland'],
  [12300, 'Orchard Fields', 'farmland', 'Meadowland'],
  [12800, 'Orchard', 'village', 'Meadowland'],
  [13300, 'Orchard Fields', 'farmland', 'Meadowland'],
  [14560, 'Bayport', 'city', 'Meadowland'],
  [15100, 'Shell Beach', 'beach', 'Meadowland'],
  [25300, 'Blue Sea', 'ocean', null],
  [25900, 'Golden Beach', 'beach', 'Sunland'],
  [27400, 'Sandport', 'city', 'Sunland'],
  [30400, 'Red Dunes', 'desert', 'Sunland'],
  [31200, 'Palm Oasis', 'oasis', 'Sunland'],
  [32600, 'Redrock', 'city', 'Sunland'],
  [35600, 'Echo Canyon', 'canyon', 'Sunland'],
  [41000, 'Sun City', 'city', 'Sunland'],
  [41600, 'Long Plains', 'savanna', 'Sunland'],
  [42000, 'Longfield', 'village', 'Sunland'],
  [42600, 'Long Plains', 'savanna', 'Sunland'],
  [47600, 'Snowcap Peaks', 'mountains', null],
  [48100, 'Highpass', 'village', 'Frostland'],
  [49100, 'Pine Woods', 'taiga', 'Frostland'],
  [50900, 'Pinetown', 'city', 'Frostland'],
  [51700, 'Frozen Plains', 'tundra', 'Frostland'],
  [52400, 'Ice Lake', 'tundra', 'Frostland'],
  [53200, 'Frozen Plains', 'tundra', 'Frostland'],
  [59200, 'Snow City', 'city', 'Frostland'],
  [59600, 'Birchwood', 'village', 'Frostland'],
  [60400, 'Pine Woods', 'taiga', 'Frostland'],
  [61800, 'Whale Fjord', 'fjord', 'Frostland'],
  [63100, 'Whale Harbor', 'city', 'Frostland'],
  [64330, 'Mount Ember', 'volcano', null],
  [64470, 'Mount Ember', 'lava', null],
  [CIRCUMFERENCE, 'Mount Ember', 'volcano', null],
].map(([to, name, kind, country], index, list) => ({
  from: index ? list[index - 1][0] : 0, to, name, kind, country, ...KINDS[kind],
}));

export const COUNTRIES = [...new Set(REGIONS.map(region => region.country).filter(Boolean))]
  .map(name => {
    const own = REGIONS.filter(region => region.country === name);
    return { name, from: own[0].from, to: own.at(-1).to };
  });

// [x, elevation above sea level]. A monotone curve passes through the points: slopes flow
// through climbs without overshoot, and repeated heights stay flat, so settlements are level. The last point matches the first so the loop is seamless.
const TERRAIN = [
  [0, 12], [5400, 12],
  [5600, 16], [6200, 18], [6700, 18], [7200, 22],
  [7600, 44], [8000, 34], [8300, 14], [8450, -50], [9150, -50], [9250, 10], [9600, 36], [9900, 28], [10200, 18],
  // Rivertown: the river runs between stone quay walls, not sloping banks, so the Old Bridge
  // springs from them.
  [10906, 18], [10928, -20], [11072, -20], [11094, 18], [11800, 18],
  [12000, 22], [12300, 24], [12800, 24], [13000, 20], [13300, 12],
  // Shell Beach: a wide, gently shelving beach below the sea wall, then the shore.
  [14500, 12], [14600, 8], [14960, 4], [15040, -3], [15180, -40],
  // Blue Sea: shelves drop to one stretch of open water between Meadowland and Sunland.
  [15600, -90], [16300, -170], [17500, -190], [18600, -200], [19800, -205],
  // Open water right across the middle (Palm Isle removed, QA round 2).
  [20500, -208], [21250, -205], [22200, -200],
  [23600, -195], [24600, -160], [25000, -80], [25300, -20], [25600, 6], [25900, 10],
  [27400, 12],
  [27700, 40], [28000, 22], [28350, 55], [28700, 28], [29050, 60], [29400, 30], [29750, 48], [30100, 24], [30400, 16],
  [31200, 16], [32600, 16],
  // Echo Canyon: climb to a mesa, a stepped gorge with a river, then down again.
  [32900, 40], [33200, 90], [33500, 140], [33800, 160], [34000, 160],
  [34100, 120], [34160, 40], [34220, -15], [34480, -15], [34540, 40], [34600, 120],
  [34700, 160], [35000, 160], [35250, 100], [35450, 40], [35600, 20],
  [41000, 20],
  [41200, 28], [41600, 24], [42000, 24], [42600, 40],
  // Snowcap Peaks: foothills build to the high peaks and ease down to Highpass.
  [42900, 70], [43300, 110], [43700, 170], [44100, 150], [44500, 260], [44900, 220], [45300, 360],
  [45600, 300], [46000, 420], [46400, 330], [46700, 380], [47000, 250], [47300, 160], [47600, 80],
  [48100, 80], [48400, 64], [48800, 42], [49100, 30],
  [50900, 30],
  [51100, 40], [51400, 22], [51600, 18], [51700, -30], [52400, -30], [52500, 20], [52800, 38], [53200, 30],
  [59200, 30], [59600, 30],
  // Whale Fjord: rising pines, cliffs, deep cold water, then the harbour.
  [59850, 42], [60150, 48], [60400, 42], [60550, 35], [60640, 28], [60760, -90], [61640, -90], [61760, 28], [61800, 26],
  [63100, 26],
  // Mount Ember: long, gentle slopes up to a shallow crater, then down into Green City.
  [63400, 40], [63800, 90], [64150, 170], [64300, 210], [64360, 190], [64440, 190],
  [64500, 210], [64650, 170], [65000, 80], [65250, 25], [CIRCUMFERENCE, 12],
];
const EDGE_BLEND = 32;

export function wrapX(x) {
  return (x % CIRCUMFERENCE + CIRCUMFERENCE) % CIRCUMFERENCE;
}

function findIndex(list, x, start) {
  let low = 0;
  let high = list.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (start(list[middle]) <= x) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function regionAt(x) {
  return REGIONS[findIndex(REGIONS, wrapX(x), region => region.from)];
}

// Monotone cubic (PCHIP) tangents. The loop's first and last points coincide, so their
// tangent uses the segments on both sides of the seam.
const SLOPES = TERRAIN.slice(0, -1).map(([x0, y0], i) => (TERRAIN[i + 1][1] - y0) / (TERRAIN[i + 1][0] - x0));
const WIDTHS = TERRAIN.slice(0, -1).map(([x0], i) => TERRAIN[i + 1][0] - x0);
const TANGENTS = TERRAIN.map((_, i) => {
  const before = (i || TERRAIN.length - 1) - 1;
  const after = i % (TERRAIN.length - 1);
  const [d0, d1, h0, h1] = [SLOPES[before], SLOPES[after], WIDTHS[before], WIDTHS[after]];
  if (d0 * d1 <= 0) return 0;
  return 3 * (h0 + h1) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
});

// Nearby contacts and debris usually query the same immutable terrain segment.
// Guard both ends so arbitrary query order and wrapped positions stay exact.
let elevationSegment = 0;
export function elevation(x) {
  const wrapped = wrapX(x);
  if (!(wrapped >= TERRAIN[elevationSegment][0] && wrapped < TERRAIN[elevationSegment + 1][0])) {
    elevationSegment = Math.min(TERRAIN.length - 2, findIndex(TERRAIN, wrapped, point => point[0]));
  }
  const index = elevationSegment;
  const [x0, y0] = TERRAIN[index];
  const [, y1] = TERRAIN[index + 1];
  if (y0 === y1) return y0;
  const h = WIDTHS[index];
  const t = (wrapped - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * TANGENTS[index]
    + (3 * t2 - 2 * t3) * y1 + (t3 - t2) * h * TANGENTS[index + 1];
}

const MAX_ELEVATION = Math.max(...TERRAIN.map(point => point[1]));

// PCHIP is monotone between knots, so extrema lie at the interval ends or knots.
// Used as a conservative collision bound; exact surface tests still decide contact.
export function maxElevation(from, to) {
  if (to < from) [from, to] = [to, from];
  if (to - from >= CIRCUMFERENCE) return MAX_ELEVATION + 1e-8;
  const left = wrapX(from), right = left + to - from;
  let maximum = Math.max(elevation(from), elevation(to));
  let index = findIndex(TERRAIN, left, point => point[0]) + 1;
  let offset = 0;
  while (true) {
    if (index === TERRAIN.length) { index = 1; offset = CIRCUMFERENCE; }
    const [x, y] = TERRAIN[index];
    if (x + offset > right) break;
    maximum = Math.max(maximum, y);
    index++;
  }
  return maximum + 1e-8;
}

export function lerpColor(a, b, t) {
  const channel = shift => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Ground and water colours at x, softened across a short band at region edges.
export function groundColors(x) {
  const wrapped = wrapX(x);
  const index = findIndex(REGIONS, wrapped, region => region.from);
  const region = REGIONS[index];
  const fromStart = wrapped - region.from;
  const toEnd = region.to - wrapped;
  const other = REGIONS[(index + (fromStart < toEnd ? -1 : 1) + REGIONS.length) % REGIONS.length];
  const weight = Math.max(0, 0.5 - Math.min(fromStart, toEnd) / (2 * EDGE_BLEND));
  return {
    ground: region.ground.map((color, i) => lerpColor(color, other.ground[i], weight)),
    water: lerpColor(region.water ?? DEFAULT_WATER, other.water ?? DEFAULT_WATER, weight),
  };
}

// 0 below the snowline, rising to full snow 40 px above it.
export function snowAt(x, height = elevation(x)) {
  const snowline = regionAt(x).snowline;
  return snowline === undefined ? 0 : Math.min(1, Math.max(0, (height - snowline) / 40));
}

export function surfaceColor(x, height = elevation(x)) {
  const { ground, water } = groundColors(x);
  if (height < SEA_LEVEL) return water;
  return lerpColor(ground[0], 0xf4fbff, snowAt(x, height));
}

// Is x open water: below sea level and not under one of the given bridge decks ([from, to] in
// world x)? Ground traffic must never drive here (game-design-rules/city-life-rules.md).
export function isWater(x, bridges = []) {
  if (elevation(x) >= SEA_LEVEL) return false;
  const at = wrapX(x);
  return !bridges.some(([from, to]) => at > from && at < to);
}

// The first x within reach of x, heading dir (±1), where the land meets open water, or null if the
// way ahead stays dry. Sampled every step px, then refined to the pixel.
export function shoreAhead(x, dir, reach = 2000, bridges = [], step = 8) {
  if (isWater(x, bridges)) return x;
  for (let d = step; d <= reach; d += step) {
    if (!isWater(x + dir * d, bridges)) continue;
    let dry = d - step;
    let wet = d;
    while (wet - dry > 1) {
      const mid = (dry + wet) / 2;
      if (isWater(x + dir * mid, bridges)) wet = mid;
      else dry = mid;
    }
    return x + dir * wet;
  }
  return null;
}
