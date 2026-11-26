// Team colors come straight from ESPN, and many are too dark to read on a
// near-black page (navy, deep purple). These helpers pick legible variants.

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

export function luminance(hex) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function saturation(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

const legible = (c) => c && luminance(c) > 0.075 && luminance(c) < 0.8 && saturation(c) > 0.25;

function lighten(c) {
  let out = c;
  for (let i = 0; i < 12 && luminance(out) < 0.12; i++) out = mix(out, '#ffffff', 0.14);
  return out;
}

const cache = new Map();

// { primary, accent, accent2 }: primary is the raw brand color (for fills),
// accent/accent2 are readable on dark backgrounds (for text, lines, glows).
export function palette(team) {
  if (!team) return null;
  if (cache.has(team.id)) return cache.get(team.id);
  const accent = legible(team.color) ? team.color : legible(team.alt) ? team.alt : lighten(team.color);
  const other = accent === team.color ? team.alt : team.color;
  const accent2 = legible(other) ? other : luminance(other) >= 0.8 ? '#f4f4f6' : lighten(other);
  const p = { primary: team.color, accent, accent2 };
  cache.set(team.id, p);
  return p;
}

export function teamVars(team) {
  const p = palette(team);
  if (!p) return undefined;
  return { '--t': p.primary, '--ta': p.accent, '--ta2': p.accent2 };
}
