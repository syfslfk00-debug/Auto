const fs = require('fs');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');
const tokenService = require('./tokenService');
const { getEngines, requireEngine } = require('./engineRegistry');

const activeClients = new Map();

function engineClients(engineId) {
  if (!activeClients.has(engineId)) activeClients.set(engineId, new Map());
  return activeClients.get(engineId);
}

function loadEngineEvents(client, engine) {
  if (!fs.existsSync(engine.eventsPath)) {
    console.warn(`[EngineRuntime] Events folder not found for ${engine.id}: ${engine.eventsPath}`);
    return;
  }

  const eventFiles = fs.readdirSync(engine.eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const eventPath = path.join(engine.eventsPath, file);
    delete require.cache[require.resolve(eventPath)];
    const event = require(eventPath);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

async function stopEngineToken(engineId, token) {
  const clients = engineClients(engineId);
  const client = clients.get(token);
  if (!client) return false;

  try {
    await client.destroy();
  } catch (error) {
    console.error(`[EngineRuntime] Failed to stop ${engineId} token ${token.substring(0, 10)}...:`, error.message);
  } finally {
    clients.delete(token);
  }

  console.log(`[EngineRuntime] ${engineId} token ${token.substring(0, 10)}... stopped.`);
  return true;
}

async function startEngineToken(engineId, token) {
  const engine = requireEngine(engineId);
  const clients = engineClients(engine.id);

  if (!token) throw new Error('Token value is required.');
  if (clients.has(token)) return clients.get(token);

  const client = new Client();
  client.on('error', error => {
    console.error(`[EngineRuntime] ${engine.id} client error:`, error.message);
  });

  loadEngineEvents(client, engine);

  try {
    await client.login(token);
    clients.set(token, client);
    console.log(`[EngineRuntime] ${engine.id} token ${token.substring(0, 10)}... started successfully.`);
    return client;
  } catch (error) {
    try {
      await client.destroy();
    } catch (_) {
      // Ignore cleanup errors after a failed login.
    }
    console.error(`[EngineRuntime] Failed to login with ${engine.id} token ${token.substring(0, 10)}...:`, error.message);
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
  const clients = engineClients(engineId);
  for (const token of [...clients.keys()]) {
    await stopEngineToken(engineId, token);
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
