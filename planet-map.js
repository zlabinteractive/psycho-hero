import { CIRCUMFERENCE, COUNTRIES, REGIONS, elevation, groundColors, lerpColor, regionAt, surfaceColor, wrapX } from './planet.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER = 150;
const RADIUS = 94;
const RELIEF = 0.045;
const hex = color => `#${color.toString(16).padStart(6, '0')}`;
const angleAt = x => x / CIRCUMFERENCE * 2 * Math.PI - Math.PI / 2;
const terrainRadius = x => RADIUS + elevation(x) * RELIEF;

function point(x, radius) {
  const angle = angleAt(x);
  return `${(CENTER + Math.cos(angle) * radius).toFixed(2)},${(CENTER + Math.sin(angle) * radius).toFixed(2)}`;
}

function node(tag, attributes, parent, text) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text) element.textContent = text;
  parent.append(element);
  return element;
}

// Fixed polar projection of the actual equatorial loop. Dense sampling preserves lakes,
// the volcano crater and snowcaps; only the relief is exaggerated for this small scale.
function arc(from, to, radius) {
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 24));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = from + (to - from) * i / steps;
    return point(x, typeof radius === 'function' ? radius(x) : radius);
  }).join('L');
}

// Surface colour per step, with equal neighbouring steps merged so the SVGs stay small.
function surfaceRuns(step) {
  const runs = [];
  for (let x = 0; x < CIRCUMFERENCE; x += step) {
    const middle = x + step / 2;
    const run = { from: x, to: Math.min(CIRCUMFERENCE, x + step), wet: elevation(middle) < 0,
      stroke: hex(surfaceColor(middle)), water: hex(groundColors(middle).water) };
    const last = runs.at(-1);
    if (last && last.wet === run.wet && last.stroke === run.stroke && last.water === run.water) last.to = run.to;
    else runs.push(run);
  }
  return runs;
}

export class PlanetMap {
  constructor(svg, { hemisphere = false } = {}) {
    if (!svg) return;
    this.svg = svg;
    this.hemisphere = hemisphere;
    const fillUrl = name => `url(#${svg.id}-${name})`;
    const defs = node('defs', {}, svg);
    const gradient = (id, stops, attributes = {}) => {
      const fill = node('radialGradient', { id: `${svg.id}-${id}`, cx: '32%', cy: '25%', r: '76%', ...attributes }, defs);
      for (const [offset, color, opacity = 1] of stops) {
        node('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, fill);
      }
    };
    gradient('planet-atmosphere', [['65%', '#82e7ff', 0], ['80%', '#a7edff', .22], ['100%', '#7edbff', 0]], { cx: '50%', cy: '50%', r: '50%' });
    gradient('planet-ocean', [['0%', '#77d3dc'], ['55%', '#3688a9'], ['100%', '#163e69']]);
    gradient('planet-core', [['0%', '#668d78'], ['45%', '#416f67'], ['100%', '#1c3f4b']]);
    gradient('planet-shade', [['0%', '#d4f9ed', .12], ['50%', '#0c2133', 0], ['100%', '#09172c', .5]]);

    this.terrain = node('g', {}, svg);
    const world = this.terrain;
    node('circle', { cx: CENTER, cy: CENTER, r: 130, fill: fillUrl('planet-atmosphere') }, world);
    node('circle', { cx: CENTER, cy: CENTER + 3, r: RADIUS + 2, fill: '#122b43', opacity: '.35' }, world);
    node('circle', { cx: CENTER, cy: CENTER, r: RADIUS, fill: fillUrl('planet-ocean'), stroke: '#c5f3f2', 'stroke-width': '1.2' }, world);

    for (const region of REGIONS) {
      const middle = (region.from + region.to) / 2;
      const { ground } = groundColors(middle);
      const d = `M${arc(region.from, region.to, terrainRadius)}L${arc(region.to, region.from, RADIUS - 18)}Z`;
      node('path', { d, fill: hex(lerpColor(ground[1], 0x264c51, .25)) }, world);
    }
    // Surface colour, water level and snow use the same functions as the playable world.
    for (const run of surfaceRuns(40)) {
      if (run.wet) node('path', { d: `M${arc(run.from, run.to, RADIUS)}L${arc(run.to, run.from, terrainRadius)}Z`, fill: run.water }, world);
      node('path', { d: `M${arc(run.from, run.to, run.wet ? RADIUS : terrainRadius)}`,
        fill: 'none', stroke: run.stroke, 'stroke-width': run.wet ? 2.3 : 3.5,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, world);
    }

    // Soft inner shading keeps the little planet spherical without inventing continents
    // for a world that currently has only an equatorial terrain loop.
    node('circle', { cx: CENTER, cy: CENTER, r: RADIUS - 18, fill: fillUrl('planet-core') }, world);
    node('circle', { cx: CENTER, cy: CENTER, r: RADIUS, fill: fillUrl('planet-shade') }, world);
    node('path', { d: `M${arc(0, CIRCUMFERENCE, RADIUS - 20)}Z`, fill: 'none', stroke: '#a1ccad',
      'stroke-opacity': '.12', 'stroke-width': '1' }, world);

    this.countries = COUNTRIES.map(country => {
      const group = node('g', { opacity: '.6' }, world);
      const middle = (country.from + country.to) / 2;
      const [x, y] = point(middle, RADIUS - 39).split(',');
      node('path', { d: `M${arc(country.from + 120, country.to - 120, RADIUS - 27)}`,
        fill: 'none', stroke: '#d7e8d2', 'stroke-opacity': '.4', 'stroke-width': '1.3' }, group);
      if (!hemisphere) node('text', { x, y, fill: '#e0ebd8', 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '10', 'letter-spacing': '1', 'font-family': "'Space Grotesk', sans-serif", 'font-weight': '600' }, group,
      country.name.toUpperCase());
      return { name: country.name, group };
    });
    // Settlement lights are attached to their real positions on the surface.
    for (const region of REGIONS.filter(r => r.kind === 'city')) {
      const x = (region.from + region.to) / 2;
      const [cx, cy] = point(x, terrainRadius(x) - 5).split(',');
      node('circle', { cx, cy, r: 2.2, fill: '#ffedb1', stroke: '#364e4d', 'stroke-width': '1' }, world);
    }

    this.marker = node('g', { class: 'planet-map-marker' }, svg);
    // Same diamond, glow and dashed line as the atlas profile marker; smaller on the HUD minimap.
    const size = this.markerSize = hemisphere ? 4.5 : 7;
    this.markerLine = node('path', { stroke: '#ffda76', 'stroke-width': '1.5', 'stroke-dasharray': '3 4', opacity: '.75' }, this.marker);
    this.markerGlow = node('circle', { r: size * 1.7, fill: '#ffda76', opacity: '.1' }, this.marker);
    this.markerDot = node('path', { d: `M0,${-size}L${size * .85},0L0,${size}L${-size * .85},0Z`, fill: '#ffda76', stroke: '#172a3a',
      'stroke-width': hemisphere ? '1.3' : '1.8', 'stroke-linejoin': 'round' }, this.marker);
  }

  update(worldX, altitude = 0) {
    if (!this.svg || (this.lastX === worldX && this.lastAltitude === altitude)) return;
    this.lastX = worldX;
    this.lastAltitude = altitude;
    const x = wrapX(worldX);
    const region = regionAt(x);
    const surface = RADIUS + Math.max(0, elevation(x)) * RELIEF;
    const radius = surface + 10 + Math.min(16, Math.max(0, altitude) * .025);
    const rotation = x / CIRCUMFERENCE * 360;
    if (this.hemisphere) this.terrain.setAttribute('transform', `rotate(${-rotation},${CENTER},${CENTER})`);
    this.marker.setAttribute('transform', `translate(${CENTER},${CENTER}) rotate(${this.hemisphere ? 0 : rotation})`);
    this.markerLine.setAttribute('d', `M0,${-surface - 2}V${-radius + this.markerSize}`);
    this.markerGlow.setAttribute('cy', -radius);
    this.markerDot.setAttribute('transform', `translate(0,${-radius})`);
    if (this.region === region) return;
    this.region = region;
    for (const country of this.countries) country.group.setAttribute('opacity', country.name === region.country ? '1' : '.6');
    this.svg.setAttribute('aria-label', `Planet minimap. You are in ${region.name}${region.country ? `, ${region.country}` : ''}. The gold diamond shows your position.`);
  }
}

// The expanded atlas keeps the equator unrolled alongside the full globe.
export class PlanetProfile {
  constructor(svg) {
    if (!svg) return;
    this.svg = svg;
    const left = 16, width = 608, sea = 126, base = 174;
    this.projectX = x => left + x / CIRCUMFERENCE * width;
    this.projectY = x => sea - elevation(x) * .18;
    const profile = (from, to) => {
      const steps = Math.max(1, Math.ceil((to - from) / 16));
      return 'M' + Array.from({ length: steps + 1 }, (_, i) => {
        const x = from + (to - from) * i / steps;
        return `${this.projectX(x).toFixed(2)},${this.projectY(x).toFixed(2)}`;
      }).join('L');
    };
    const defs = node('defs', {}, svg);
    const water = node('linearGradient', { id: 'atlas-profile-water', x2: '0', y2: '1' }, defs);
    node('stop', { offset: '0%', 'stop-color': '#57b7d7', 'stop-opacity': '.65' }, water);
    node('stop', { offset: '100%', 'stop-color': '#245a7a', 'stop-opacity': '.2' }, water);
    const terrain = profile(0, CIRCUMFERENCE);
    const clip = node('clipPath', { id: 'atlas-profile-clip' }, defs);
    node('path', { d: `${terrain}L${left + width},${base}L${left},${base}Z` }, clip);
    const grid = node('g', { stroke: '#9ebdd2', 'stroke-opacity': '.10', 'stroke-width': '1' }, svg);
    for (let i = 0; i <= 8; i++) node('path', { d: `M${left + width * i / 8},47V${base}` }, grid);
    for (const y of [78, 102, 150, base]) node('path', { d: `M${left},${y}H${left + width}` }, grid);
    this.regionBand = node('rect', { y: 46, height: base - 46, fill: '#ffdb78', opacity: '.055' }, svg);
    node('rect', { x: left, y: sea, width, height: base - sea, fill: 'url(#atlas-profile-water)' }, svg);
    const land = node('g', { 'clip-path': 'url(#atlas-profile-clip)' }, svg);
    for (const region of REGIONS) {
      const { ground } = groundColors((region.from + region.to) / 2);
      node('rect', { x: this.projectX(region.from), y: 46, width: this.projectX(region.to) - this.projectX(region.from) + .1,
        height: base - 46, fill: hex(lerpColor(ground[1], 0x203c49, .4)) }, land);
    }
    node('path', { d: terrain, fill: 'none', stroke: '#132c3d', 'stroke-width': '7', 'stroke-linejoin': 'round' }, svg);
    for (const run of surfaceRuns(32)) {
      node('path', { d: profile(run.from, run.to), fill: 'none', stroke: run.stroke,
        'stroke-width': '3', 'stroke-linecap': 'round' }, svg);
    }
    node('path', { d: `M${left},${sea}H${left + width}`, stroke: '#91d9ec', 'stroke-width': '1',
      'stroke-opacity': '.45', 'stroke-dasharray': '3 5' }, svg);
    node('path', { d: `M${left},${base}H${left + width}`, stroke: '#a9c9da', 'stroke-opacity': '.2' }, svg);
    const labels = node('g', { fill: '#b6c9d8', 'font-size': '18', 'font-family': "'Space Grotesk', sans-serif" }, svg);
    const colors = ['#8acdae', '#e1bb7f', '#abcada'];
    this.countries = COUNTRIES.map((country, i) => {
      const capital = REGIONS.filter(region => region.country === country.name && region.kind === 'city')
        .sort((a, b) => (b.to - b.from) - (a.to - a.from))[0];
      const center = (capital.from + capital.to) / 2;
      const x = this.projectX(center);
      const y = this.projectY(center);
      node('path', { d: `M${x},91V${y - 8}`, stroke: '#b6c9d8', 'stroke-opacity': '.35' }, labels);
      node('circle', { cx: x, cy: y - 5, r: 3, fill: '#d6e6ed' }, labels);
      node('text', { x, y: 83, 'text-anchor': 'middle' }, labels, capital.name);
      const from = this.projectX(country.from);
      const to = this.projectX(country.to);
      const group = node('g', { fill: colors[i], opacity: '.6' }, svg);
      node('path', { d: `M${from},184v4H${to}v-4`, fill: 'none', stroke: colors[i], 'stroke-width': '1.5' }, group);
      node('text', { x: (from + to) / 2, y: 213, 'text-anchor': 'middle', 'font-size': '18', 'letter-spacing': '1.8',
        'font-family': "'DM Mono', monospace" }, group, country.name.toUpperCase());
      return { name: country.name, group };
    });
    this.marker = node('g', { fill: '#ffda76' }, svg);
    this.markerLine = node('path', { stroke: '#ffda76', 'stroke-width': '1.5', 'stroke-dasharray': '3 4', opacity: '.75' }, this.marker);
    node('circle', { cx: 0, cy: 32, r: 14, opacity: '.1' }, this.marker);
    node('path', { d: 'M0,24L7,32L0,40L-7,32Z', stroke: '#172a3a', 'stroke-width': '2' }, this.marker);
    this.surfaceMarker = node('circle', { cx: 0, r: 4, stroke: '#172a3a', 'stroke-width': '2' }, this.marker);
  }

  update(worldX) {
    if (!this.svg || this.lastX === worldX) return;
    this.lastX = worldX;
    const x = wrapX(worldX);
    const region = regionAt(x);
    const y = Math.min(126, this.projectY(x));
    this.marker.setAttribute('transform', `translate(${this.projectX(x).toFixed(2)},0)`);
    this.markerLine.setAttribute('d', `M0,44V${y.toFixed(2)}`);
    this.surfaceMarker.setAttribute('cy', y.toFixed(2));
    if (this.region === region) return;
    this.region = region;
    this.regionBand.setAttribute('x', this.projectX(region.from));
    this.regionBand.setAttribute('width', this.projectX(region.to) - this.projectX(region.from));
    for (const country of this.countries) country.group.setAttribute('opacity', country.name === region.country ? '1' : '.6');
    this.svg.setAttribute('aria-label', `Full equatorial terrain profile. You are in ${region.name}. Both edges connect.`);
  }
}
