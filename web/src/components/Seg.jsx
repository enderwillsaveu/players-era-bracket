import { useLayoutEffect, useRef, useState } from 'react';

// Segmented tabs with one sliding pill. The pill is placed from the active
// button's offsetLeft/offsetWidth inside this control, so it only moves when
// the selection or the control's own size changes, never when content above
// it pushes the page around. The first placement skips the transition so it
// doesn't slide in from the left on load.
export function Seg({ items, value, onChange, label, className = '' }) {
  const ref = useRef(null);
  const [pill, setPill] = useState(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const btn = el.querySelector('[aria-selected="true"]');
      if (!btn) return setPill(null);
      setPill({ x: btn.offsetLeft, w: btn.offsetWidth, animate: placed.current });
      placed.current = true;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.querySelectorAll('.seg__btn').forEach((b) => ro.observe(b)); // labels can change width (live dot, web fonts)
    return () => ro.disconnect();
  }, [value, items.length]);

  return (
    <div className={`seg ${className}`} role="tablist" aria-label={label} ref={ref}>
      {pill && (
        <span
          className={`seg__pill ${pill.animate ? 'is-animated' : ''}`}
          style={{ width: pill.w, transform: `translateX(${pill.x}px)` }}
          aria-hidden="true"
        />
      )}
      {items.map((item) => (
        <button
          key={item.key}
          role="tab"
          aria-selected={item.key === value}
          className={`seg__btn ${item.key === value ? 'is-on' : ''}`}
          onClick={() => onChange(item.key)}
        >
          <span className="seg__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
