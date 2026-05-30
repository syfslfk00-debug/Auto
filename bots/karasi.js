const engineRuntime = require('../services/engineRuntime');

async function startTokens() {
  return engineRuntime.startEngine('karasi');
}

async function stopAllTokens() {
  return engineRuntime.stopEngine('karasi');
}

module.exports = {
  startTokens,
  stopAllTokens,
  activeClients: engineRuntime.getEngineClientMap('karasi'),
};

startTokens().catch(console.error);
