const fs = require('fs');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');
const tokenService = require('./tokenService');
const eventBus = require('./eventBus');
const { getEngines, requireEngine } = require('./engineRegistry');

const activeClients = new Map();
const activeRounds = new Map();

const winPatterns = ['فوز', 'فزت', 'ربحت', 'نجحت', 'victory', 'won', 'win', 'success'];
const lossPatterns = ['خسرت', 'خسارة', 'لم تفز', 'fail', 'lost', 'loss', 'game over', 'انتهت المحاولة'];

function engineClients(engineId) {
  if (!activeClients.has(engineId)) activeClients.set(engineId, new Map());
  return activeClients.get(engineId);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeError(error) {
  return error && error.message ? error.message : String(error);
}

async function publishRuntimeEvent(event) {
  return eventBus.publish(event).catch(error => {
    console.error('[EngineRuntime] Failed to publish runtime event:', error.message);
  });
}

function messageFromArgs(args = []) {
  return args.find(item => item && item.guild && item.channel)
    || args.find(item => item && item.channel)
    || args.find(item => item && item.content);
}

function textFromMessage(message) {
  if (!message) return '';
  const parts = [];
  if (message.content) parts.push(message.content);
  if (Array.isArray(message.embeds)) {
    for (const embed of message.embeds) {
      if (embed.title) parts.push(embed.title);
      if (embed.description) parts.push(embed.description);
    }
  }
  return parts.join(' ').toLowerCase();
}

function contextFromArgs(args = []) {
  const message = messageFromArgs(args);
  if (!message) return {};
  return {
    serverId: message.guild ? message.guild.id : undefined,
    serverName: message.guild ? message.guild.name : undefined,
    channelId: message.channel ? message.channel.id : undefined,
    channelName: message.channel ? message.channel.name : undefined,
    message: typeof message.content === 'string' ? message.content.slice(0, 300) : undefined,
  };
}

function outcomeFromArgs(args = []) {
  const text = textFromMessage(messageFromArgs(args));
  if (!text) return null;
  if (winPatterns.some(pattern => text.includes(pattern))) return { type: 'game_result', result: 'win', level: 'نجاح', reason: 'رسالة تدل على الفوز' };
  if (lossPatterns.some(pattern => text.includes(pattern))) return { type: 'game_result', result: 'loss', level: 'خسارة', reason: 'رسالة تدل على الخسارة' };
  return null;
}

function roundKey(engineId, token) {
  return `${engineId}:${token}`;
}

function clearRound(engineId, token) {
  const key = roundKey(engineId, token);
  const timeout = activeRounds.get(key);
  if (timeout) clearTimeout(timeout);
  activeRounds.delete(key);
}

function scheduleRoundTimeout(engine, token, baseEvent, settings) {
  clearRound(engine.id, token);
  const timeoutSeconds = Number(settings && settings.roundTimeout ? settings.roundTimeout : engine.defaultSettings && engine.defaultSettings.roundTimeout ? engine.defaultSettings.roundTimeout : 60);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) return;

  const timeout = setTimeout(() => {
    publishRuntimeEvent({
      ...baseEvent,
      type: 'game_timeout',
      level: 'خسارة',
      result: 'loss',
      status: 'timeout',
      message: 'انتهت المهلة دون ظهور رسالة فوز.',
      details: { reason: 'timeout' },
    });
    activeRounds.delete(roundKey(engine.id, token));
  }, Math.min(timeoutSeconds, 600) * 1000);

  activeRounds.set(roundKey(engine.id, token), timeout);
}

function eventFromHandlerResult(result, event, engine, token, args, settings) {
  if (!result || result.handled === false) return null;
  const context = contextFromArgs(args);
  const eventType = result.type || event.eventType || 'game_event';
  const gameEvent = {
    ...context,
    type: eventType,
    level: result.level || event.level || (eventType === 'game_result' && result.result === 'win' ? 'نجاح' : eventType === 'game_result' && result.result === 'loss' ? 'خسارة' : 'لعب'),
    engineId: engine.id,
    engineName: engine.displayName,
    token,
    status: result.status || 'info',
    result: result.result || event.result || eventType,
    gameName: result.gameName || event.gameName || engine.displayName,
    message: result.message || context.message,
    details: {
      file: event.fileName,
      ...(result.details || {}),
    },
  };

  if (['game_join', 'game_play'].includes(gameEvent.type)) scheduleRoundTimeout(engine, token, gameEvent, settings);
  if (gameEvent.type === 'game_result') clearRound(engine.id, token);
  return gameEvent;
}

function outcomeEventFromMessage(event, engine, token, args) {
  const outcome = outcomeFromArgs(args);
  if (!outcome) return null;
  clearRound(engine.id, token);
  return {
    ...contextFromArgs(args),
    type: outcome.type,
    level: outcome.level,
    engineId: engine.id,
    engineName: engine.displayName,
    token,
    status: 'info',
    result: outcome.result,
    gameName: event.gameName || engine.displayName,
    details: { file: event.fileName, reason: outcome.reason },
  };
}

function loadEngineEvents(client, engine, token, settings) {
  if (!fs.existsSync(engine.eventsPath)) {
    console.warn(`[EngineRuntime] Events folder not found for ${engine.id}: ${engine.eventsPath}`);
    return;
  }

  const eventFiles = fs.readdirSync(engine.eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const eventPath = path.join(engine.eventsPath, file);
    delete require.cache[require.resolve(eventPath)];
    const event = require(eventPath);
    event.fileName = file;

    const handler = async (...args) => {
      try {
        const result = await event.execute(...args, client);
        const semanticEvent = eventFromHandlerResult(result, event, engine, token, args, settings) || outcomeEventFromMessage(event, engine, token, args);
        if (semanticEvent) await publishRuntimeEvent(semanticEvent);
        return result;
      } catch (error) {
        await publishRuntimeEvent({
          ...contextFromArgs(args),
          type: 'engine_event_error',
          level: 'خطأ',
          engineId: engine.id,
          engineName: engine.displayName,
          token,
          status: 'error',
          result: event.eventType || event.name,
          gameName: event.gameName || engine.displayName,
          message: safeError(error),
          details: { file, stack: error && error.stack ? error.stack.slice(0, 1000) : undefined },
        });
        console.error(`[EngineRuntime] Event ${file} failed for ${engine.id}:`, safeError(error));
        return null;
      }
    };

    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);
  }
}

async function stopEngineToken(engineId, token, reason = 'stopped') {
  const engine = requireEngine(engineId);
  const clients = engineClients(engine.id);
  const client = clients.get(token);
  if (!client) return false;

  try {
    await client.destroy();
  } catch (error) {
    console.error(`[EngineRuntime] Failed to stop ${engine.id} token ${token.substring(0, 10)}...:`, safeError(error));
  } finally {
    clients.delete(token);
    clearRound(engine.id, token);
  }

  await publishRuntimeEvent({
    type: reason === 'restarted' ? 'engine_token_restarted' : 'engine_token_stopped',
    level: 'تشغيلي',
    engineId: engine.id,
    engineName: engine.displayName,
    token,
    status: 'stopped',
    result: reason,
  });

  console.log(`[EngineRuntime] ${engine.id} token ${token.substring(0, 10)}... stopped.`);
  return true;
}

async function startEngineToken(engineId, token) {
  const engine = requireEngine(engineId);
  const clients = engineClients(engine.id);

  if (!token) throw new Error('Token value is required.');
  if (clients.has(token)) return clients.get(token);

  const settings = await tokenService.getEngineSettings(token, engine.id).catch(() => null);
  const delay = Number(settings && settings.delay ? settings.delay : 0);
  if (Number.isFinite(delay) && delay > 0) await wait(Math.min(delay, 60) * 1000);

  const client = new Client();
  client.on('error', error => {
    publishRuntimeEvent({
      type: 'engine_client_error',
      level: 'خطأ',
      engineId: engine.id,
      engineName: engine.displayName,
      token,
      status: 'error',
      gameName: engine.displayName,
      message: safeError(error),
    });
    console.error(`[EngineRuntime] ${engine.id} client error:`, safeError(error));
  });

  loadEngineEvents(client, engine, token, settings);

  try {
    await client.login(token);
    clients.set(token, client);
    await publishRuntimeEvent({
      type: 'engine_token_started',
      level: 'تشغيلي',
      engineId: engine.id,
      engineName: engine.displayName,
      token,
      status: 'running',
      result: 'started',
      gameName: engine.displayName,
      details: { settings: settings || {} },
    });
    console.log(`[EngineRuntime] ${engine.id} token ${token.substring(0, 10)}... started successfully.`);
    return client;
  } catch (error) {
    try {
      await client.destroy();
    } catch (_) {
      // Ignore cleanup errors after a failed login.
    }
    await publishRuntimeEvent({
      type: 'engine_login_failed',
      level: 'خطأ',
      engineId: engine.id,
      engineName: engine.displayName,
      token,
      status: 'error',
      result: 'failed',
      gameName: engine.displayName,
      message: safeError(error),
    });
    console.error(`[EngineRuntime] Failed to login with ${engine.id} token ${token.substring(0, 10)}...:`, safeError(error));
    return null;
  }
}

async function restartEngineToken(engineId, token) {
  await stopEngineToken(engineId, token, 'restarted');
  return startEngineToken(engineId, token);
}

async function startEngine(engineId) {
  const engine = requireEngine(engineId);
  const tokens = await tokenService.getEngineTokens(engine.id);
  for (const token of tokens) await startEngineToken(engine.id, token);
  console.log(`[EngineRuntime] ${engine.id} loading process completed.`);
}

async function stopEngine(engineId) {
  const engine = requireEngine(engineId);
  const clients = engineClients(engine.id);
  for (const token of [...clients.keys()]) await stopEngineToken(engine.id, token);
}

async function startAllEngines() {
  for (const engine of getEngines()) await startEngine(engine.id);
}

async function stopAllEngines() {
  for (const engine of getEngines()) await stopEngine(engine.id);
}

async function stopTokenEverywhere(token) {
  for (const engine of getEngines()) await stopEngineToken(engine.id, token);
}

function getActiveEnginesForToken(token) {
  return getEngines().filter(engine => engineClients(engine.id).has(token)).map(engine => engine.id);
}

function getActiveTokensForEngine(engineId) {
  return [...engineClients(engineId).keys()];
}

function getEngineClientMap(engineId) {
  return engineClients(engineId);
}

module.exports = {
  activeClients,
  startAllEngines,
  stopAllEngines,
  startEngine,
  stopEngine,
  startEngineToken,
  stopEngineToken,
  restartEngineToken,
  stopTokenEverywhere,
  getActiveEnginesForToken,
  getActiveTokensForEngine,
  getEngineClientMap,
};
