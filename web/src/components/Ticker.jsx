import { useMemo } from 'react';
import { gameSlots, byTip } from '../lib/bracket';
import { formatDay, formatTime } from '../lib/format';
import { TeamLogo } from './TeamLogo';

const RANK = { in: 0, pre: 1, post: 2 };

function Item({ entry, onOpen }) {
  const { slot, event } = entry;
  const g = slot.game;
  const s = g.status;
  return (
    <button className={`tick tick--${s.state}`} onClick={() => onOpen(slot, event)}>
      <span className="tick__tag">
        {s.state === 'in' ? (
          <>
            <span className="pulse-dot" /> {s.shortDetail}
          </>
        ) : s.state === 'post' ? (
          s.shortDetail
        ) : (
          `${formatDay(g.date)} ${formatTime(g.date)}`
        )}
      </span>
      {slot.sides.map((side, i) => (
        <span key={i} className={`tick__team ${s.state === 'post' && !side.winner ? 'is-loser' : ''}`}>
          {side.team ? <TeamLogo team={side.team} size={16} /> : null}
          <span>{side.team ? side.team.abbr : 'TBD'}</span>
          {side.score != null && <b>{side.score}</b>}
        </span>
      ))}
      <span className="tick__ev">{event.name.replace('Players Era ', 'PE')}</span>
    </button>
  );
}

// Scrolling scoreboard: live games, then the next few tips, then recent finals.
export function Ticker({ data, onOpen }) {
  const entries = useMemo(() => {
    const all = data.events.flatMap((event) =>
      gameSlots(event)
        .filter((s) => s.sides.some((x) => x.team))
        .map((slot) => ({ slot, event })),
    );
    const live = all.filter((e) => e.slot.game.status.state === 'in');
    const next = all
      .filter((e) => e.slot.game.status.state === 'pre')
      .sort((a, b) => byTip(a.slot, b.slot))
      .slice(0, 8);
    const done = all
      .filter((e) => e.slot.game.status.state === 'post')
      .sort((a, b) => byTip(b.slot, a.slot))
      .slice(0, 10);
    return [...live, ...next, ...done].sort((a, b) => RANK[a.slot.game.status.state] - RANK[b.slot.game.status.state]);
  }, [data]);

  if (!entries.length) return null;
  const duration = Math.max(30, entries.length * 5);
  return (
    <div className="ticker" aria-label="Scoreboard">
      <div className="ticker__track" style={{ animationDuration: `${duration}s` }}>
        {[0, 1].map((copy) => (
          <div className="ticker__set" key={copy} aria-hidden={copy === 1}>
            {entries.map((e) => (
              <Item key={`${copy}-${e.slot.id}`} entry={e} onOpen={onOpen} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
