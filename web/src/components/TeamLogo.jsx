import { useState } from 'react';
import { palette } from '../lib/colors';

export function TeamLogo({ team, size = 24, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!team) return <span className={`logo logo--empty ${className}`} style={{ width: size, height: size }} />;
  const src = team.logoDark || team.logo;
  if (!src || failed) {
    const p = palette(team);
    return (
      <span
        className={`logo logo--mono ${className}`}
        style={{ width: size, height: size, background: p.primary, color: p.accent2, fontSize: size * 0.34 }}
        aria-hidden="true"
      >
        {team.abbr}
      </span>
    );
  }
  return (
    <img
      className={`logo ${className}`}
      src={src}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
