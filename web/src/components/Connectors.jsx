import { useEffect, useState } from 'react';
import { palette } from '../lib/colors';

// Edges for every "winner advances" feeder among `slots`. Losers' paths
// (consolation / 3rd place) are left as labels, which keeps the tree readable.
export function winnerEdges(slots) {
  const edges = [];
  for (const slot of slots) {
    slot.feeders.forEach((f, side) => {
      if (f.take !== 'W') return;
      const adv = slot.sides[side];
      edges.push({ id: `${f.from}>${slot.id}:${side}`, from: f.from, to: slot.id, side, team: adv && adv.team });
    });
  }
  return edges;
}

function path(x1, y1, x2, y2) {
  if (Math.abs(y2 - y1) < 1) return `M${x1},${y1} H${x2}`;
  const xm = x1 + (x2 - x1) / 2;
  const sx = x2 > x1 ? 1 : -1;
  const sy = y2 > y1 ? 1 : -1;
  const r = Math.min(12, Math.abs(y2 - y1) / 2, Math.abs(xm - x1));
  return `M${x1},${y1} H${xm - sx * r} Q${xm},${y1} ${xm},${y1 + sy * r} V${y2 - sy * r} Q${xm},${y2} ${xm + sx * r},${y2} H${x2}`;
}

// Draws bracket lines between cards rendered inside `containerRef`, found by
// their data-card / data-anchor attributes. Recomputes on resize and when the
// edge set changes. Uses a passive effect on purpose: this component renders
// inside the container, and a child's layout effect runs before the parent's
// ref is attached.
export function Connectors({ containerRef, edges, focus }) {
  const [geo, setGeo] = useState({ w: 0, h: 0, paths: [] });
  const key = edges.map((e) => `${e.id}=${e.team ? e.team.id : ''}`).join('|');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let alive = true;
    const compute = () => {
      if (!alive) return;
      const base = el.getBoundingClientRect();
      const paths = [];
      for (const e of edges) {
        const src = el.querySelector(`[data-card="${e.from}"]`);
        const row = el.querySelector(`[data-anchor="${e.to}:${e.side}"]`);
        const dst = row && row.closest('[data-card]');
        if (!src || !dst) continue;
        const a = src.getBoundingClientRect();
        const b = dst.getBoundingClientRect();
        const r = row.getBoundingClientRect();
        const ltr = a.left + a.width / 2 < b.left + b.width / 2;
        const x1 = (ltr ? a.right : a.left) - base.left;
        const y1 = a.top + a.height / 2 - base.top;
        const x2 = (ltr ? b.left : b.right) - base.left;
        const y2 = r.top + r.height / 2 - base.top;
        paths.push({ ...e, d: path(x1, y1, x2, y2), x2, y2 });
      }
      setGeo({ w: el.scrollWidth, h: el.scrollHeight, paths });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    if (document.fonts) document.fonts.ready.then(compute);
    return () => {
      alive = false;
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, containerRef]);

  const hot = (e) => e.team && (e.team.id === focus.hoverTeam || e.team.id === focus.favoriteId);

  return (
    <svg className="connectors" width={geo.w} height={geo.h} aria-hidden="true">
      {geo.paths.map((e) => (
        <path key={`${e.id}-base`} d={e.d} className="edge" />
      ))}
      {geo.paths
        .filter((e) => e.team)
        .map((e) => {
          const p = palette(e.team);
          return (
            <g key={`${e.id}-lit`} style={{ '--ta': p.accent }} className={hot(e) ? 'edge-group is-hot' : 'edge-group'}>
              <path d={e.d} className="edge edge--glow" />
              <path d={e.d} className="edge edge--lit" />
              {hot(e) && <path d={e.d} className="edge edge--flow" />}
              <circle cx={e.x2} cy={e.y2} r="3" className="edge__dot" />
            </g>
          );
        })}
    </svg>
  );
}
