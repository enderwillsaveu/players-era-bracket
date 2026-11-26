// Thin client for ESPN's public (undocumented, keyless) site API.

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';

async function fetchJson(url, timeoutMs = 8000) {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`ESPN responded ${res.status} for ${url}`);
  return res.json();
}

// groups=50 is Division I. ESPN rejects multi-day ranges on this endpoint, so
// callers fetch one day at a time.
function fetchScoreboard(date) {
  return fetchJson(`${BASE}/scoreboard?dates=${date}&groups=50&limit=400`);
}

function fetchSummary(eventId) {
  return fetchJson(`${BASE}/summary?event=${encodeURIComponent(eventId)}`);
}

module.exports = { fetchScoreboard, fetchSummary };
