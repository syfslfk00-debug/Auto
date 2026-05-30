const tokenService = require('./tokenService');

function incrementsForEvent(event) {
  const type = String(event.type || '');
  const result = String(event.result || '');
  const increments = { events: 1 };

  if (type === 'engine_token_started') increments.starts = 1;
  if (type === 'engine_token_stopped' || type === 'engine_token_restarted') increments.stops = 1;
  if (type === 'engine_login_failed') increments.loginFailures = 1;
  if (type.includes('error') || type.includes('failed')) increments.errors = 1;
  if (type === 'game_join' || type.includes('join') || type.includes('دخل')) increments.joins = 1;
  if (type === 'game_play') increments.plays = 1;
  if (type === 'game_timeout') increments.timeouts = 1;
  if (result === 'win' || type.includes('win') || type.includes('فوز')) increments.wins = 1;
  if (result === 'loss' || type.includes('loss') || type.includes('خسارة') || type === 'game_timeout') increments.losses = 1;

  return increments;
}

function statsPatchForEvent(event) {
  const now = event.createdAt || new Date();
  const patch = {
    lastActivityAt: now,
    lastEventType: event.type,
  };

  if (event.gameName) patch.lastGame = event.gameName;
  if (event.serverName) patch.lastServer = event.serverName;
  if (event.channelName) patch.lastChannel = event.channelName;
  if (event.result) patch.lastResult = event.result;
  if (event.status === 'error' || String(event.type || '').includes('error') || String(event.type || '').includes('failed')) {
    patch.lastError = event.message || event.result || event.type;
    patch.lastErrorAt = now;
  }

  return patch;
}

async function applyEvent(event) {
  if (!event || !event.token || !event.engineId) return null;
  return tokenService.incrementEngineStats(
    event.token,
    event.engineId,
    incrementsForEvent(event),
    statsPatchForEvent(event)
  );
}

function collectAccountStats(account) {
  const stats = account.engineStats || {};
  return Object.values(stats).reduce((total, item) => {
    total.events += Number(item.events || 0);
    total.starts += Number(item.starts || 0);
    total.stops += Number(item.stops || 0);
    total.errors += Number(item.errors || 0);
    total.wins += Number(item.wins || 0);
    total.losses += Number(item.losses || 0);
    total.joins += Number(item.joins || 0);
    total.plays += Number(item.plays || 0);
    total.timeouts += Number(item.timeouts || 0);
    return total;
  }, { events: 0, starts: 0, stops: 0, errors: 0, wins: 0, losses: 0, joins: 0, plays: 0, timeouts: 0 });
}

module.exports = {
  applyEvent,
  collectAccountStats,
};
