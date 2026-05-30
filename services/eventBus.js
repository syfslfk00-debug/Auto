const logService = require('./logService');
const statsService = require('./statsService');
const tokenService = require('./tokenService');
const { getEngine } = require('./engineRegistry');

const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function extractDiscordContext(args = []) {
  const message = args.find(item => item && item.guild && item.channel) || args.find(item => item && item.channel);
  if (!message) return {};

  return {
    serverId: message.guild ? message.guild.id : undefined,
    serverName: message.guild ? message.guild.name : undefined,
    channelId: message.channel ? message.channel.id : undefined,
    channelName: message.channel ? message.channel.name : undefined,
    message: typeof message.content === 'string' && message.content.length > 0 ? message.content.slice(0, 300) : undefined,
  };
}

async function enrichEvent(event) {
  const engine = event.engineId ? getEngine(event.engineId) : null;
  const context = extractDiscordContext(event.args);
  let accountName = event.accountName;

  if (!accountName && event.token) {
    const account = await tokenService.getTokenByValue(event.token).catch(() => null);
    if (account) accountName = account.name;
  }

  const { token, args, ...safeEvent } = event;
  return {
    ...context,
    ...safeEvent,
    engineName: event.engineName || (engine ? engine.displayName : event.engineId),
    accountName,
    status: event.status || 'info',
    details: event.details || {},
    createdAt: event.createdAt || new Date(),
    token,
  };
}

function runtimePatch(event) {
  const now = event.createdAt || new Date();
  switch (event.type) {
    case 'engine_token_started':
      return { status: 'يعمل', lastStartedAt: now, lastActivityAt: now, lastError: null };
    case 'engine_token_stopped':
    case 'engine_token_restarted':
      return { status: 'متوقف', lastStoppedAt: now, lastActivityAt: now };
    case 'engine_login_failed':
    case 'engine_client_error':
    case 'engine_event_error':
      return { status: 'خطأ', lastError: event.message || event.result || event.type, lastErrorAt: now, lastActivityAt: now, lastServer: event.serverName, lastGame: event.gameName };
    case 'game_join':
      return { status: 'داخل اللعبة', lastActivityAt: now, lastJoinAt: now, lastEventType: event.type, lastServer: event.serverName, lastGame: event.gameName };
    case 'game_play':
      return { status: 'يلعب', lastActivityAt: now, lastPlayAt: now, lastEventType: event.type, lastServer: event.serverName, lastGame: event.gameName };
    case 'game_result':
    case 'game_timeout':
      return { status: event.result === 'win' ? 'فاز' : 'خسر', lastActivityAt: now, lastResultAt: now, lastResult: event.result, lastEventType: event.type, lastServer: event.serverName, lastGame: event.gameName };
    default:
      return { lastActivityAt: now, lastEventType: event.type, lastServer: event.serverName, lastGame: event.gameName };
  }
}

async function publish(event) {
  const normalized = await enrichEvent(event);

  await logService.recordEvent(normalized);
  await statsService.applyEvent(normalized);

  if (normalized.token && normalized.engineId) {
    await tokenService.updateEngineRuntime(normalized.token, normalized.engineId, runtimePatch(normalized)).catch(error => {
      console.error('[EventBus] Failed to update runtime state:', error.message);
    });
  }

  for (const listener of listeners) {
    await Promise.resolve(listener(normalized)).catch(error => {
      console.error('[EventBus] Listener failed:', error.message);
    });
  }

  return normalized;
}

module.exports = {
  publish,
  subscribe,
};
