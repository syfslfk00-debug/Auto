const { getEngines, getEngine } = require('./engineRegistry');
const engineRuntime = require('./engineRuntime');
const tokenService = require('./tokenService');
const logService = require('./logService');
const statsService = require('./statsService');

function engineStatusForAccount(account, engine) {
  const enabled = Boolean(account.engines && account.engines[engine.id]);
  const running = engineRuntime.getActiveTokensForEngine(engine.id).includes(account.token);
  const runtime = account.runtime && account.runtime[engine.id] ? account.runtime[engine.id] : {};
  const stats = account.engineStats && account.engineStats[engine.id] ? account.engineStats[engine.id] : {};
  const settings = account.engineSettings && account.engineSettings[engine.id] ? account.engineSettings[engine.id] : {};

  return {
    engineId: engine.id,
    engineName: engine.displayName,
    enabled,
    running,
    status: running ? 'يعمل' : (enabled ? (runtime.status || 'متوقف') : 'غير مفعل'),
    runtime,
    stats,
    settings,
  };
}

async function getSystemOverview() {
  const engines = getEngines();
  const accounts = await tokenService.getAllTokens();
  const recentLogs = await logService.getLogs({ limit: 5 });
  const recentErrors = await logService.countRecentErrors(60);

  const engineSummaries = engines.map(engine => {
    const activeTokens = engineRuntime.getActiveTokensForEngine(engine.id);
    const enabledAccounts = accounts.filter(account => account.engines && account.engines[engine.id]);
    return {
      id: engine.id,
      name: engine.displayName,
      activeCount: activeTokens.length,
      enabledCount: enabledAccounts.length,
      stoppedCount: Math.max(enabledAccounts.length - activeTokens.length, 0),
    };
  });

  const accountSummaries = accounts.map(account => {
    const engineStatuses = engines.map(engine => engineStatusForAccount(account, engine));
    const activeEngines = engineStatuses.filter(item => item.running).length;
    const totals = statsService.collectAccountStats(account);
    const lastActivity = engineStatuses
      .map(item => item.runtime.lastActivityAt || item.stats.lastActivityAt)
      .filter(Boolean)
      .sort()
      .pop();

    return {
      name: account.name,
      status: activeEngines > 0 ? 'يعمل' : account.status,
      activeEngines,
      engineStatuses,
      totals,
      lastActivity,
    };
  });

  return {
    engines: engineSummaries,
    accounts: accountSummaries,
    totalAccounts: accounts.length,
    activeAccounts: accountSummaries.filter(account => account.activeEngines > 0).length,
    stoppedAccounts: accountSummaries.filter(account => account.activeEngines === 0).length,
    recentLogs,
    recentErrors,
  };
}

async function getAccountDetails(name) {
  const account = await tokenService.getToken(name);
  if (!account) return null;

  const engines = getEngines();
  const logs = await logService.getLogs({ accountName: account.name, limit: 5 });
  return {
    account,
    engines: engines.map(engine => engineStatusForAccount(account, engine)),
    totals: statsService.collectAccountStats(account),
    logs,
  };
}

async function getEngineDetails(engineId) {
  const engine = getEngine(engineId);
  if (!engine) return null;

  const accounts = await tokenService.getAllTokens();
  const activeTokens = engineRuntime.getActiveTokensForEngine(engine.id);
  const relatedAccounts = accounts
    .filter(account => account.engines && account.engines[engine.id])
    .map(account => ({
      name: account.name,
      running: activeTokens.includes(account.token),
      runtime: account.runtime[engine.id] || {},
      stats: account.engineStats[engine.id] || {},
    }));
  const logs = await logService.getLogs({ engineId: engine.id, limit: 5 });

  return {
    engine,
    activeCount: activeTokens.length,
    enabledCount: relatedAccounts.length,
    stoppedCount: Math.max(relatedAccounts.length - activeTokens.length, 0),
    accounts: relatedAccounts,
    logs,
  };
}

async function getGeneralStats() {
  const overview = await getSystemOverview();
  return overview.accounts.reduce((total, account) => {
    total.events += account.totals.events;
    total.starts += account.totals.starts;
    total.stops += account.totals.stops;
    total.errors += account.totals.errors;
    total.wins += account.totals.wins;
    total.losses += account.totals.losses;
    total.joins += account.totals.joins;
    return total;
  }, {
    events: 0,
    starts: 0,
    stops: 0,
    errors: 0,
    wins: 0,
    losses: 0,
    joins: 0,
    totalAccounts: overview.totalAccounts,
    activeAccounts: overview.activeAccounts,
    stoppedAccounts: overview.stoppedAccounts,
    recentErrors: overview.recentErrors,
  });
}

module.exports = {
  getSystemOverview,
  getAccountDetails,
  getEngineDetails,
  getGeneralStats,
};
