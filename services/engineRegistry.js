const path = require('path');

const engines = [
  {
    id: 'replka',
    displayName: 'ريبلكا',
    legacyField: 'replkaEnabled',
    eventsPath: path.join(__dirname, '..', 'tokensHandler', 'Replka', 'events'),
  },
  {
    id: 'karasi',
    displayName: 'كراسي',
    legacyField: 'karasiEnabled',
    eventsPath: path.join(__dirname, '..', 'tokensHandler', 'Karasi', 'events'),
  },
];

const engineMap = new Map(engines.map(engine => [engine.id, engine]));
const legacyFieldMap = new Map(engines.filter(engine => engine.legacyField).map(engine => [engine.legacyField, engine]));

function getEngines() {
  return engines.map(engine => ({ ...engine }));
}

function getEngine(engineId) {
  return engineMap.get(engineId) || null;
}

function getEngineByLegacyField(field) {
  return legacyFieldMap.get(field) || null;
}

function requireEngine(engineId) {
  const engine = getEngine(engineId);
  if (!engine) throw new Error(`Unknown engine: ${engineId}`);
  return engine;
}

module.exports = {
  getEngines,
  getEngine,
  getEngineByLegacyField,
  requireEngine,
};
