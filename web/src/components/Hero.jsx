import { motion } from 'motion/react';
import { MapPin, Radio, Sparkles, Trophy } from 'lucide-react';
import { gameSlots, byTip, placementOf, teamPath } from '../lib/bracket';
import { countdown, formatDay, formatTime, ordinal, shortVenue, vegasRange } from '../lib/format';
import { teamVars } from '../lib/colors';
import { TeamLogo } from './TeamLogo';
import { useNow } from '../lib/usePolling';
import { StatusChip } from './GameCard';

function Matchup({ slot }) {
  return (
    <span className="mini">
      {slot.sides.map((s, i) => (
        <span key={i} className="mini__team">
          {s.team ? <TeamLogo team={s.team} size={20} /> : null}
          <b>{s.team ? s.team.abbr : 'TBD'}</b>
          {s.score != null && <em>{s.score}</em>}
          {i === 0 && <i>vs</i>}
        </span>
      ))}
    </span>
  );
}

// Owns the 1s clock for the countdown so only this panel re-renders each tick.
function NowPanel({ event, onOpen }) {
  const now = useNow(1000);
  const slots = gameSlots(event);
  const live = slots.filter((s) => s.game.status.state === 'in').sort(byTip);
  const next = slots.filter((s) => s.game.status.state === 'pre').sort(byTip)[0];

  if (live.length) {
    return (
      <div className="now now--live">
        <div className="now__head">
          <Radio size={15} /> Live now
        </div>
        {live.map((s) => (
          <button key={s.id} className="now__game" onClick={() => onOpen(s)}>
            <Matchup slot={s} />
            <StatusChip game={s.game} />
          </button>
        ))}
      </div>
    );
  }
  if (next) {
    return (
      <button className="now" onClick={() => onOpen(next)}>
        <div className="now__head">Next tip-off</div>
        <div className="now__count">{countdown(new Date(next.game.date).getTime() - now)}</div>
        <Matchup slot={next} />
        <div className="now__meta">
          {next.title} · {formatDay(next.game.date)} {formatTime(next.game.date)} ·{' '}
          {shortVenue(next.game.venue && next.game.venue.name)}
          {next.game.broadcast ? ` · ${next.game.broadcast}` : ''}
        </div>
      </button>
    );
  }
  return null;
}

function YourTeam({ event, team, onOpen }) {
  const path = teamPath(event, team.id);
  if (!path.length) {
    return (
      <div className="yours" style={teamVars(team)}>
        <TeamLogo team={team} size={44} />
        <div>
          <span className="yours__kicker">Your team</span>
          <strong>{team.short}</strong>
          <span className="yours__line">Not in the {event.name} field — check the other event.</span>
        </div>
      </div>
    );
  }
  const rec = event.records[team.id] || { w: 0, l: 0 };
  const place = placementOf(event, team.id);
  const upcoming = path.find((s) => s.game.status.state !== 'post');
  const opp = upcoming && upcoming.sides.find((s) => !s.team || s.team.id !== team.id);
  return (
    <div className="yours" style={teamVars(team)}>
      <TeamLogo team={team} size={44} />
      <div className="yours__body">
        <span className="yours__kicker">
          Your team · {rec.w}-{rec.l} in Vegas
        </span>
        <strong>{team.short}</strong>
        <span className="yours__line">
          {place
            ? `Finished ${ordinal(place.place)}${place.of !== 'overall' ? ` in ${place.of}` : ''}`
            : upcoming
              ? `${upcoming.game.status.state === 'in' ? 'Playing now' : 'Next'}: ${upcoming.title} vs ${
                  opp && opp.team ? opp.team.short : opp ? opp.label : 'TBD'
                }${upcoming.game.status.state === 'pre' ? ` · ${formatDay(upcoming.game.date)} ${formatTime(upcoming.game.date)}` : ''}`
              : ''}
        </span>
        <div className="yours__path">
          {path.map((s) => {
            const me = s.sides.find((x) => x.team && x.team.id === team.id);
            const them = s.sides.find((x) => x !== me);
            const st = s.game.status.state;
            const tag = st === 'post' ? (me.winner ? 'W' : 'L') : st === 'in' ? 'LIVE' : '•';
            return (
              <button
                key={s.id}
                className={`pill pill--${st === 'post' ? (me.winner ? 'w' : 'l') : st}`}
                onClick={() => onOpen(s)}
                title={s.title}
              >
                <b>{tag}</b> {them && them.team ? them.team.abbr : 'TBD'}
                {st !== 'pre' && me.score != null ? ` ${me.score}-${them.score}` : ''}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Hero({ data, event, favoriteTeam, onOpen, onCelebrate }) {
  const [main, num] = event.name.match(/^(.*?)\s*(\d+)?$/).slice(1);
  const two = event.brackets.length > 1;
  return (
    <section className="hero">
      <div className="hero__left">
        <motion.div
          className="hero__kicker"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <MapPin size={13} /> {data.location} · {vegasRange(event.start, event.end)},{' '}
          {new Date(event.start).getFullYear()}
        </motion.div>
        <motion.h1
          className="hero__title"
          key={event.key}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        >
          <span>{main}</span>
          {num && <span className="hero__num">{num}</span>}
        </motion.h1>
        <div className="hero__chips">
          <span className="hchip">{event.teams.length} teams</span>
          {two && <span className="hchip">2 arenas · 2 brackets</span>}
          <span className="hchip">
            {event.counts.final}/{event.counts.total} final
          </span>
          {event.counts.live > 0 && (
            <span className="hchip hchip--live">
              <span className="pulse-dot" /> {event.counts.live} live
            </span>
          )}
        </div>
        {event.champion && (
          <motion.button
            className="crown"
            style={teamVars(event.champion)}
            onClick={() => onCelebrate(event.champion)}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            title="Celebrate"
          >
            <TeamLogo team={event.champion} size={52} />
            <span className="crown__text">
              <span className="crown__kicker">
                <Trophy size={13} /> {new Date(event.start).getFullYear()} {event.name} champions
              </span>
              <strong>{event.champion.name}</strong>
              <span className="crown__sub">
                {(event.records[event.champion.id] || {}).w}-{(event.records[event.champion.id] || {}).l} in Vegas
                {event.runnerUp ? ` · beat ${event.runnerUp.short} in the final` : ''}
              </span>
            </span>
            <Sparkles size={18} className="crown__spark" />
          </motion.button>
        )}
      </div>
      <div className="hero__right">
        {favoriteTeam && <YourTeam event={event} team={favoriteTeam} onOpen={onOpen} />}
        <NowPanel event={event} onOpen={onOpen} />
      </div>
    </section>
  );
}
