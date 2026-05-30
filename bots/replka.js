const engineRuntime = require('../services/engineRuntime');

async function startTokens() {
  return engineRuntime.startEngine('replka');
}

async function stopAllTokens() {
  return engineRuntime.stopEngine('replka');
}

module.exports = {
  startTokens,
  stopAllTokens,
  activeClients: engineRuntime.getEngineClientMap('replka'),
};

startTokens().catch(console.error);
