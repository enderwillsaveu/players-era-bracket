import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { placementOf, teamPath } from '../lib/bracket';
import { ordinal } from '../lib/format';
import { teamVars } from '../lib/colors';
import { TeamLogo } from './TeamLogo';

export function Teams({ event, focus, setFavorite, onOpen }) {
  const rows = useMemo(() => {
    return event.teams
      .map((team) => ({
        team,
        rec: event.records[team.id] || { w: 0, l: 0 },
        place: placementOf(event, team.id),
        path: teamPath(event, team.id),
      }))
      .sort(
        (a, b) =>
          (a.place ? a.place.place : 99) - (b.place ? b.place.place : 99) ||
          b.rec.w - a.rec.w ||
          a.rec.l - b.rec.l ||
          a.team.short.localeCompare(b.team.short),
      );
  }, [event]);

  return (
    <div className="teams">
      {rows.map(({ team, rec, place, path }, i) => (
        <motion.article
          key={team.id}
          className={`tcard ${focus.favoriteId === team.id ? 'is-fav' : ''}`}
          style={teamVars(team)}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.4) }}
          onPointerEnter={(e) => e.pointerType === 'mouse' && focus.onHoverTeam(team.id)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && focus.onHoverTeam(null)}
        >
          <div className="tcard__bg">
            <TeamLogo team={team} size={180} />
          </div>
          <div className="tcard__top">
            <TeamLogo team={team} size={46} />
            <div className="tcard__id">
              <strong>{team.short}</strong>
              <span>{team.mascot}</span>
            </div>
            <button
              className={`iconbtn tcard__fav ${focus.favoriteId === team.id ? 'is-on' : ''}`}
              onClick={() => setFavorite(focus.favoriteId === team.id ? null : team.id)}
              aria-label={focus.favoriteId === team.id ? `Stop repping ${team.short}` : `Rep ${team.short}`}
              title="Rep this team"
            >
              <Heart size={15} />
            </button>
          </div>
          <div className="tcard__stats">
            <div>
              <b>
                {rec.w}-{rec.l}
              </b>
              <span>In Vegas</span>
            </div>
            <div>
              <b>{place ? ordinal(place.place) : '—'}</b>
              <span>{place && place.of !== 'overall' ? place.of.replace(' Bracket', '') : 'Finish'}</span>
            </div>
          </div>
          <div className="tcard__path">
            {path.map((s) => {
              const me = s.sides.find((x) => x.team && x.team.id === team.id);
              const them = s.sides.find((x) => x !== me);
              const st = s.game.status.state;
              return (
                <button key={s.id} className="tgame" onClick={() => onOpen(s)}>
                  <span className={`tgame__res tgame__res--${st === 'post' ? (me.winner ? 'w' : 'l') : st}`}>
                    {st === 'post' ? (me.winner ? 'W' : 'L') : st === 'in' ? 'LIVE' : 'NEXT'}
                  </span>
                  <span className="tgame__opp">
                    {them && them.team ? <TeamLogo team={them.team} size={16} /> : null}
                    {them && them.team ? them.team.abbr : them ? them.label : 'TBD'}
                  </span>
                  <span className="tgame__score">
                    {st !== 'pre' && me.score != null ? `${me.score}-${them.score}` : s.short}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.article>
      ))}
    </div>
  );
}
