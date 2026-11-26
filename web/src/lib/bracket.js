// Helpers over the /api/tournament event shape (see server/bracket.js).

export function bracketSlots(b) {
  const s = b.slots;
  return [...s.qf, ...s.sf, ...s.csf, s.final, s.third, s.fifth, s.seventh];
}

export function eventSlots(event) {
  const all = event.brackets.flatMap(bracketSlots);
  if (event.championship) all.push(event.championship);
  return all;
}

export const gameSlots = (event) => eventSlots(event).filter((s) => s.game);

export const byTip = (a, b) => new Date(a.game.date) - new Date(b.game.date);

export const hasTeam = (slot, teamId) => Boolean(teamId) && slot.sides.some((s) => s.team && s.team.id === teamId);

// Final placement for a team (1 = champion), or null if not decided yet.
// In two-bracket events only the title game decides 1st/2nd; the rest of a
// bracket's placements are within that bracket.
export function placementOf(event, teamId) {
  if (event.champion && event.champion.id === teamId) return { place: 1, of: 'overall' };
  if (event.runnerUp && event.runnerUp.id === teamId) return { place: 2, of: 'overall' };
  for (const b of event.brackets) {
    const p = b.placements.find((x) => x.team && x.team.id === teamId);
    if (!p) continue;
    if (event.brackets.length > 1 && p.place <= 1) return null;
    return { place: p.place, of: event.brackets.length > 1 ? b.name : 'overall' };
  }
  return null;
}

export function findTeam(data, teamId) {
  if (!data || !teamId) return null;
  for (const e of data.events) {
    const t = e.teams.find((x) => x.id === teamId);
    if (t) return t;
  }
  return null;
}

// The team's games in an event, in tip order.
export const teamPath = (event, teamId) => gameSlots(event).filter((s) => hasTeam(s, teamId)).sort(byTip);
