const fs = require('fs');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');
const tokenService = require('./tokenService');
const eventBus = require('./eventBus');
const gamePolicyService = require('./gamePolicyService');
const channelConfigService = require('./channelConfigService');
const { getEngines, requireEngine } = require('./engineRegistry');

const activeClients = new Map();
const activeRounds = new Map();

const WIN_PHRASES = ['فاز باللعبة', 'فاز'];
const LOSS_PHRASES = ['خسرت', 'خسر', 'تم طرد'];
const processedOutcomeMessages = new Set();
const MAX_PROCESSED_OUTCOME_MESSAGES = 1000;

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

function outcomeMessageFromArgs(args = []) {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const item = args[index];
    if (item && item.author && (item.guild || item.channel || item.content || Array.isArray(item.embeds))) return item;
  }
  return messageFromArgs(args);
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

function rememberProcessedOutcomeMessage(messageId) {
  if (!messageId) return;
  processedOutcomeMessages.add(messageId);
  if (processedOutcomeMessages.size > MAX_PROCESSED_OUTCOME_MESSAGES) {
    const oldestMessageId = processedOutcomeMessages.values().next().value;
    processedOutcomeMessages.delete(oldestMessageId);
  }
}

function playerIdentifiers(account, client, settings) {
  return [
    settings && settings.playerId,
    account && account.playerId,
    account && account.name,
    client && client.user && client.user.id ? `<@${client.user.id}>` : null,
    client && client.user && client.user.id ? `<@!${client.user.id}>` : null,
    client && client.user && client.user.id,
  ].map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
}

function outcomeFromArgs(args = [], account, client, settings, policy, engine) {
  const message = outcomeMessageFromArgs(args);
  if (!message || !message.author || !message.author.bot) return null;
  if (!gamePolicyService.isBotAllowed(policy, engine.id, message.author.id)) return null;
  if (message.id && processedOutcomeMessages.has(message.id)) return null;

  const text = textFromMessage(message);
  if (!text) return null;

  const identifiers = playerIdentifiers(account, client, settings);
  if (identifiers.length === 0 || !identifiers.some(identifier => text.includes(identifier))) return null;

  const winPhrase = WIN_PHRASES.find(phrase => text.includes(phrase));
  if (winPhrase) {
    rememberProcessedOutcomeMessage(message.id);
    return { type: 'game_result', result: 'win', level: 'نجاح', reason: `رسالة بوت مسموح تحتوي: ${winPhrase}`, messageId: message.id };
  }

  const lossPhrase = LOSS_PHRASES.find(phrase => text.includes(phrase));
  if (lossPhrase) {
    rememberProcessedOutcomeMessage(message.id);
    return { type: 'game_result', result: 'loss', level: 'خسارة', reason: `رسالة بوت مسموح تحتوي: ${lossPhrase}`, messageId: message.id };
  }

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

function scheduleRoundTimeout(engine, token) {
  clearRound(engine.id, token);
}

function eventFromHandlerResult(result, event, engine, token, args, settings, account, lockInfo) {
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
      lockKey: lockInfo && lockInfo.key,
    },
  };

  if (['game_join', 'game_play'].includes(gameEvent.type)) scheduleRoundTimeout(engine, token, gameEvent, settings);
  if (gameEvent.type === 'game_result') clearRound(engine.id, token);
  return gameEvent;
}

function outcomeEventFromMessage(event, engine, token, args, account, client, settings, policy) {
  const outcome = outcomeFromArgs(args, account, client, settings, policy, engine);
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
    details: { file: event.fileName, reason: outcome.reason, messageId: outcome.messageId },
  };
}


function isLikelyGameMessage(message, event) {
  if (!message || !message.author) return true;
  const text = textFromMessage(message);
  const gameName = String(event.gameName || '').toLowerCase();
  if (event.eventType === 'game_join') {
    const hasGameName = !gameName || text.includes(gameName);
    const hasComponents = Array.isArray(message.components) && message.components.length > 0;
    return hasGameName && (hasComponents || text.length > 0);
  }
  if (event.eventType === 'game_play') {
    const hasComponents = Array.isArray(message.components) && message.components.length > 0;
    return hasComponents || text.includes('لديك') || text.includes('اضغط');
  }
  return true;
}

async function runtimeGate(args, event, engine, token, settings, account) {
  const policy = await gamePolicyService.getPolicy();
  const message = outcomeMessageFromArgs(args);
  const context = contextFromArgs(args);

  if (message && message.author) {
    if (!message.author.bot) return { allowed: false, policy };
    if (!gamePolicyService.isBotAllowed(policy, engine.id, message.author.id)) return { allowed: false, policy };
    if (!isLikelyGameMessage(message, event)) return { allowed: false, policy };
  }

  if (context.serverId && !gamePolicyService.isServerAllowed(policy, account, engine.id, context.serverId)) return { allowed: false, policy };

  if (event.eventType === 'game_join' || event.eventType === 'game_play') {
    const lock = gamePolicyService.acquireLock({
      policy,
      engineId: engine.id,
      serverId: context.serverId,
      gameName: event.gameName || engine.displayName,
      token,
      accountName: account ? account.name : undefined,
    });
    if (!lock.acquired) return { allowed: false, policy, lock };
    return { allowed: true, policy, lock };
  }

  return { allowed: true, policy };
}

function loadEngineEvents(client, engine, token, settings, account) {
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
        const gate = await runtimeGate(args, event, engine, token, settings, account);
        if (!gate.allowed) return null;

        const result = await event.execute(...args, client);
        if ((!result || result.handled === false) && gate.lock && gate.lock.key) gamePolicyService.releaseLock(gate.lock.key, token);
        const semanticEvent = eventFromHandlerResult(result, event, engine, token, args, settings, account, gate.lock) || outcomeEventFromMessage(event, engine, token, args, account, client, settings, gate.policy);
        if (semanticEvent) {
          if (semanticEvent.type === 'game_result') gamePolicyService.releaseLockFromEvent(semanticEvent);
          await publishRuntimeEvent(semanticEvent);
        }
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
    gamePolicyService.releaseLocksForToken(token, engine.id);
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

  const account = await tokenService.getTokenByValue(token).catch(() => null);
  const settings = account && account.engineSettings ? account.engineSettings[engine.id] : await tokenService.getEngineSettings(token, engine.id).catch(() => null);
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

  const runtimeSettings = { ...(settings || {}) };
  if (engine.id === 'zar' && account && account.name) {
    runtimeSettings.zarChannel = await channelConfigService.getZarChannelForAccount(account.name).catch(() => null);
  }
  client.engineContext = { engine, token, settings: runtimeSettings, account };

  loadEngineEvents(client, engine, token, runtimeSettings, account);

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
      details: { settings: runtimeSettings || {} },
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
