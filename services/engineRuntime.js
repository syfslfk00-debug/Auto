const fs = require('fs');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');
const tokenService = require('./tokenService');
const eventBus = require('./eventBus');
const { getEngines, requireEngine } = require('./engineRegistry');

const activeClients = new Map();

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

function loadEngineEvents(client, engine, token) {
  if (!fs.existsSync(engine.eventsPath)) {
    console.warn(`[EngineRuntime] Events folder not found for ${engine.id}: ${engine.eventsPath}`);
    return;
  }

  const eventFiles = fs.readdirSync(engine.eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const eventPath = path.join(engine.eventsPath, file);
    delete require.cache[require.resolve(eventPath)];
    const event = require(eventPath);
    const handler = async (...args) => {
      await publishRuntimeEvent({
        type: 'engine_event',
        engineId: engine.id,
        engineName: engine.displayName,
        token,
        result: event.name,
        details: { file },
        args,
      });

      try {
        return await event.execute(...args, client);
      } catch (error) {
        await publishRuntimeEvent({
          type: 'engine_event_error',
          engineId: engine.id,
          engineName: engine.displayName,
          token,
          status: 'error',
          result: event.name,
          message: safeError(error),
          details: { file },
          args,
        });
        console.error(`[EngineRuntime] Event ${file} failed for ${engine.id}:`, safeError(error));
        return null;
      }
    };

    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }
  }
}

async function stopEngineToken(engineId, token) {
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
  }

  await publishRuntimeEvent({
    type: 'engine_token_stopped',
    engineId: engine.id,
    engineName: engine.displayName,
    token,
    status: 'stopped',
    result: 'stopped',
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
  if (Number.isFinite(delay) && delay > 0) {
    await wait(Math.min(delay, 60) * 1000);
  }

  const client = new Client();
  client.on('error', error => {
    publishRuntimeEvent({
      type: 'engine_client_error',
      engineId: engine.id,
      engineName: engine.displayName,
      token,
      status: 'error',
      message: safeError(error),
    });
    console.error(`[EngineRuntime] ${engine.id} client error:`, safeError(error));
  });

  loadEngineEvents(client, engine, token);

  try {
    await client.login(token);
    clients.set(token, client);
    await publishRuntimeEvent({
      type: 'engine_token_started',
      engineId: engine.id,
      engineName: engine.displayName,
      token,
      status: 'running',
      result: 'started',
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
      engineId: engine.id,
      engineName: engine.displayName,
      token,
      status: 'error',
      result: 'failed',
      message: safeError(error),
    });
    console.error(`[EngineRuntime] Failed to login with ${engine.id} token ${token.substring(0, 10)}...:`, safeError(error));
    return null;
  }
}

async function restartEngineToken(engineId, token) {
  await stopEngineToken(engineId, token);
  return startEngineToken(engineId, token);
}

async function startEngine(engineId) {
  const engine = requireEngine(engineId);
  const tokens = await tokenService.getEngineTokens(engine.id);

  for (const token of tokens) {
    await startEngineToken(engine.id, token);
  }

  console.log(`[EngineRuntime] ${engine.id} loading process completed.`);
}

async function stopEngine(engineId) {
  const engine = requireEngine(engineId);
  const clients = engineClients(engine.id);
  for (const token of [...clients.keys()]) {
    await stopEngineToken(engine.id, token);
  }
}

async function startAllEngines() {
  for (const engine of getEngines()) {
    await startEngine(engine.id);
  }
}

async function stopAllEngines() {
  for (const engine of getEngines()) {
    await stopEngine(engine.id);
  }
}

async function stopTokenEverywhere(token) {
  for (const engine of getEngines()) {
    await stopEngineToken(engine.id, token);
  }
}

function getActiveEnginesForToken(token) {
  return getEngines()
    .filter(engine => engineClients(engine.id).has(token))
    .map(engine => engine.id);
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
