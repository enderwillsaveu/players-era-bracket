import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { teamVars } from '../lib/colors';
import { TeamLogo } from './TeamLogo';

const KICKER = { tip: 'Tip-off', final: 'Final', score: 'Score update', crown: 'Champions' };

export function Toasts({ toasts, dismiss, onOpen }) {
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const lead = t.team || (t.slot && t.slot.sides.find((s) => s.winner && s.team)) || null;
          return (
            <motion.div
              key={t.id}
              layout
              className={`toast toast--${t.kind}`}
              style={teamVars(lead && (lead.team || lead))}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <button className="toast__body" onClick={() => t.slot && onOpen(t.slot, t.event)}>
                <span className="toast__kicker">
                  {KICKER[t.kind]} · {t.event.name}
                </span>
                {t.slot ? (
                  <span className="toast__line">
                    {t.slot.sides.map((s, i) => (
                      <span key={i} className={`toast__team ${t.kind === 'final' && !s.winner ? 'is-loser' : ''}`}>
                        {s.team && <TeamLogo team={s.team} size={20} />}
                        <b>{s.team ? s.team.abbr : 'TBD'}</b>
                        {s.score != null && <em>{s.score}</em>}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="toast__line">
                    <TeamLogo team={t.team} size={22} />
                    <b>{t.team.name}</b>
                  </span>
                )}
              </button>
              <button className="iconbtn toast__x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
