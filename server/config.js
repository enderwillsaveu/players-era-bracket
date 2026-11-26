// Which ESPN games belong to which tournament.
//
// Games are matched by the competition note headline ESPN attaches
// (e.g. "Players Era 16 - Bracket Final"): the part before " - " must equal
// `name`. `dates` are ESPN scoreboard dates (US Eastern calendar days).
// `brackets` is how many parallel 8-team brackets the event runs; with 2, the
// bracket winners meet in a separate "Championship" game.

module.exports = {
  title: 'Players Era',
  location: 'Las Vegas, NV',
  events: [
    {
      key: 'pe16',
      name: 'Players Era 16',
      brackets: 2,
      dates: ['20261124', '20261125', '20261126', '20261127', '20261128'],
    },
    {
      key: 'pe8',
      name: 'Players Era 8',
      brackets: 1,
      dates: ['20261117', '20261118', '20261119'],
    },
  ],
};
