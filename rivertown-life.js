import { AreaLife } from './area-life.js';
import { BRIDGE_DECK, RIVER, RIVERTOWN, RIVERTOWN_BUILDINGS, RIVERTOWN_LANDMARKS, deckRise } from './rivertown-art.js';
import { BUS_LIVERIES } from './bus-liveries.js';

// Life in Rivertown, following game-design-rules/city-life-rules.md (area-life.js does the street):
// - Townsfolk on both quays, crowds at the Minster, the Water Mill and the Market Hall, and pigeons
//   on the terraces' roofs.
// - Two lanes of cars, taxis and the town bus, which cross the river on the Old Bridge: they ease
//   down to a crawl on the approach, ride up over its hump and knock over its joints (city-life.js).
// - When evil mode brings the bridge down, the roads end at the quays (city-life.js); walkers keep to
//   their own bank, and anyone on the deck goes into the river with it.
const HOTSPOTS = {
  'rivertown-minster': [6, 60],
  'water-mill': [3, 40],
  'market-hall': [8, 66],
};
const STOPS = [10640, 11380];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class RivertownLife extends AreaLife {
  constructor(random = Math.random) {
    super(random, { area: RIVERTOWN, landmarks: RIVERTOWN_LANDMARKS, hotspots: HOTSPOTS, stops: STOPS,
      walkerSpacing: 120, carSpacing: 340, seed: 1500 });
    this.busLivery = BUS_LIVERIES.rivertown;
    for (const building of RIVERTOWN_BUILDINGS) {
      if (!building.roof || !building.kind || hash(building.seed * 7) >= 0.35) continue;
      this.flocks.push({ x: building.x, height: building.roof - 2, spread: building.width * 0.2, seed: building.seed });
    }
    for (const flock of this.flocks) this.settle(flock);
    this.doors = RIVERTOWN_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
  }

  // With the bridge down, a walker turns back at their own quay instead of walking on the water.
  walkBounds(person) {
    const [low, high] = super.walkBounds(person);
    if (this.bridges.length || !person) return [low, high];
    return person.x < (RIVER.from + RIVER.to) / 2 ? [low, RIVER.from - 14] : [RIVER.to + 14, high];
  }

  // People on the deck when it falls are thrown off it into the river.
  setBridgeStanding(standing) {
    const fell = !standing && this.bridges.length > 0;
    super.setBridgeStanding(standing);
    if (!fell) return;
    for (const person of this.walkers) {
      if (!this.exposed(person) || person.state === 'thrown' || person.x <= RIVER.from || person.x >= RIVER.to) continue;
      Object.assign(person, { state: 'thrown', angle: 0, air: { h: deckRise(person.x) ?? BRIDGE_DECK.rise,
        vx: (this.random() - 0.5) * 20, vy: 10, spin: (this.random() < 0.5 ? -1 : 1) * (3 + this.random() * 3) } });
    }
  }
}
