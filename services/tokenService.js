const { connectDatabase } = require('../handlers/database');
const Token = require('../models/Token');
const { getEngine, getEngineByLegacyField, getEngines } = require('./engineRegistry');

async function ensureDatabase() {
  const connection = await connectDatabase();
  if (!connection) throw new Error('MongoDB connection is not available.');
  return connection;
}

function normalizeName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

function normalizeToken(token) {
  return typeof token === 'string' ? token.trim() : '';
}

function mapToObject(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...value };
}

function enginePath(engineId) {
  return `engines.${engineId}`;
}

function settingsPath(engineId) {
  return `engineSettings.${engineId}`;
}

function statsPath(engineId) {
  return `engineStats.${engineId}`;
}

function runtimePath(engineId) {
  return `runtime.${engineId}`;
}

function engineEnabledConditions(engine) {
  const conditions = [{ [enginePath(engine.id)]: true }];
  if (engine.legacyField) conditions.push({ [engine.legacyField]: true });
  return conditions;
}

function engineEnabledUpdate(engine, enabled) {
  const update = { [enginePath(engine.id)]: enabled };
  if (engine.legacyField) update[engine.legacyField] = enabled;
  return update;
}

function defaultEngineSettings(engine) {
  return { ...(engine.defaultSettings || {}) };
}

function normalizeTokenDocument(document) {
  if (!document) return document;
  const token = { ...document };
  const engines = mapToObject(token.engines);
  const engineSettings = mapToObject(token.engineSettings);
  const engineStats = mapToObject(token.engineStats);
  const runtime = mapToObject(token.runtime);

  if (typeof token.replkaEnabled === 'boolean' && engines.replka === undefined) engines.replka = token.replkaEnabled;
  if (typeof token.karasiEnabled === 'boolean' && engines.karasi === undefined) engines.karasi = token.karasiEnabled;

  for (const engine of getEngines()) {
    engineSettings[engine.id] = {
      ...defaultEngineSettings(engine),
      ...(engineSettings[engine.id] || {}),
      enabled: Boolean(engines[engine.id]),
    };
    engineStats[engine.id] = {
      events: 0,
      starts: 0,
      stops: 0,
      loginFailures: 0,
      errors: 0,
      wins: 0,
      losses: 0,
      joins: 0,
      ...(engineStats[engine.id] || {}),
    };
    runtime[engine.id] = {
      status: engines[engine.id] ? 'متوقف' : 'غير مفعل',
      ...(runtime[engine.id] || {}),
    };
  }

  token.engines = engines;
  token.engineSettings = engineSettings;
  token.engineStats = engineStats;
  token.runtime = runtime;
  return token;
}

async function addToken(name, token) {
  await ensureDatabase();

  const cleanName = normalizeName(name);
  const cleanToken = normalizeToken(token);

  if (!cleanName) throw new Error('Token name is required.');
  if (!cleanToken) throw new Error('Token value is required.');

  const document = await Token.findOneAndUpdate(
    { name: cleanName },
    {
      $set: { name: cleanName, token: cleanToken, status: 'active' },
      $setOnInsert: { createdAt: new Date(), engines: {}, engineSettings: {}, engineStats: {}, runtime: {} },
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  return normalizeTokenDocument(document);
}

async function removeToken(name) {
  await ensureDatabase();

  const cleanName = normalizeName(name);
  if (!cleanName) throw new Error('Token name is required.');

  const removedToken = await Token.findOneAndDelete({ name: cleanName }).lean();
  return normalizeTokenDocument(removedToken);
}

async function getToken(name) {
  await ensureDatabase();

  const cleanName = normalizeName(name);
  if (!cleanName) throw new Error('Token name is required.');

  const token = await Token.findOne({ name: cleanName }).lean();
  return normalizeTokenDocument(token);
}

async function getTokenByValue(token) {
  await ensureDatabase();

  const cleanToken = normalizeToken(token);
  if (!cleanToken) throw new Error('Token value is required.');

  const document = await Token.findOne({ token: cleanToken }).lean();
  return normalizeTokenDocument(document);
}

async function getAllTokens() {
  try {
    await ensureDatabase();
    const tokens = await Token.find({}).sort({ createdAt: 1, name: 1 }).lean();
    return tokens.map(normalizeTokenDocument);
  } catch (error) {
    console.error('[TokenService] Failed to fetch all tokens:', error.message);
    return [];
  }
}

async function getAllTokensForSelectMenu() {
  const tokens = await getAllTokens();
  return tokens.map(token => ({ key: token.name, value: token.token }));
}

async function getEngineTokens(engineId) {
  try {
    await ensureDatabase();
    const engine = getEngine(engineId);
    if (!engine) throw new Error(`Unknown engine: ${engineId}`);

    const query = {
      status: { $ne: 'disabled' },
      $or: engineEnabledConditions(engine),
    };

    const tokens = await Token.find(query).select('token').sort({ createdAt: 1 }).lean();
    return tokens.map(item => item.token);
  } catch (error) {
    console.error(`[TokenService] Failed to fetch ${engineId} tokens:`, error.message);
    return [];
  }
}

async function getAccountsByEngine(engineId) {
  try {
    await ensureDatabase();
    const engine = getEngine(engineId);
    if (!engine) throw new Error(`Unknown engine: ${engineId}`);

    const tokens = await Token.find({
      $or: engineEnabledConditions(engine),
    }).sort({ createdAt: 1, name: 1 }).lean();

    return tokens.map(normalizeTokenDocument);
  } catch (error) {
    console.error(`[TokenService] Failed to fetch accounts for ${engineId}:`, error.message);
    return [];
  }
}

async function setEngineEnabled(token, fieldOrEngineId, enabled) {
  await ensureDatabase();

  const cleanToken = normalizeToken(token);
  if (!cleanToken) throw new Error('Token value is required.');

  const engine = getEngine(fieldOrEngineId) || getEngineByLegacyField(fieldOrEngineId);
  if (!engine) throw new Error(`Unknown engine: ${fieldOrEngineId}`);

  const update = {
    $set: {
      ...engineEnabledUpdate(engine, enabled),
      [`${settingsPath(engine.id)}.enabled`]: enabled,
      [`${runtimePath(engine.id)}.status`]: enabled ? 'متوقف' : 'غير مفعل',
      [`${runtimePath(engine.id)}.updatedAt`]: new Date(),
    },
  };

  const updatedToken = await Token.findOneAndUpdate({ token: cleanToken }, update, { new: true, runValidators: true }).lean();
  return normalizeTokenDocument(updatedToken);
}

async function enableEngine(token, engineId) {
  return setEngineEnabled(token, engineId, true);
}

async function disableEngine(token, engineId) {
  return setEngineEnabled(token, engineId, false);
}

async function getEngineSettings(token, engineId) {
  const account = await getTokenByValue(token);
  const engine = getEngine(engineId);
  if (!account || !engine) return null;

  return {
    ...defaultEngineSettings(engine),
    ...(account.engineSettings[engine.id] || {}),
    enabled: Boolean(account.engines[engine.id]),
  };
}

async function updateEngineSetting(token, engineId, key, value) {
  await ensureDatabase();

  const cleanToken = normalizeToken(token);
  const engine = getEngine(engineId);
  if (!cleanToken) throw new Error('Token value is required.');
  if (!engine) throw new Error(`Unknown engine: ${engineId}`);
  if (!key) throw new Error('Setting key is required.');

  if (key === 'enabled') {
    return setEngineEnabled(cleanToken, engine.id, value === true || value === 'true' || value === 'نعم' || value === 'مفعل');
  }

  const updatedToken = await Token.findOneAndUpdate(
    { token: cleanToken },
    { $set: { [`${settingsPath(engine.id)}.${key}`]: value } },
    { new: true, runValidators: true }
  ).lean();

  return normalizeTokenDocument(updatedToken);
}

async function resetEngineSettings(token, engineId) {
  await ensureDatabase();

  const cleanToken = normalizeToken(token);
  const engine = getEngine(engineId);
  if (!cleanToken) throw new Error('Token value is required.');
  if (!engine) throw new Error(`Unknown engine: ${engineId}`);

  const enabledAccount = await getTokenByValue(cleanToken);
  const enabled = Boolean(enabledAccount && enabledAccount.engines && enabledAccount.engines[engine.id]);
  const updatedToken = await Token.findOneAndUpdate(
    { token: cleanToken },
    { $set: { [settingsPath(engine.id)]: { ...defaultEngineSettings(engine), enabled } } },
    { new: true, runValidators: true }
  ).lean();

  return normalizeTokenDocument(updatedToken);
}

async function updateEngineRuntime(token, engineId, patch) {
  await ensureDatabase();

  const cleanToken = normalizeToken(token);
  if (!cleanToken || !engineId) return null;

  const update = {};
  for (const [key, value] of Object.entries(patch || {})) {
    update[`${runtimePath(engineId)}.${key}`] = value;
  }
  update[`${runtimePath(engineId)}.updatedAt`] = new Date();

  const updatedToken = await Token.findOneAndUpdate(
    { token: cleanToken },
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  return normalizeTokenDocument(updatedToken);
}

async function incrementEngineStats(token, engineId, increments, patch = {}) {
  await ensureDatabase();

  const cleanToken = normalizeToken(token);
  if (!cleanToken || !engineId) return null;

  const $inc = {};
  for (const [key, value] of Object.entries(increments || {})) {
    $inc[`${statsPath(engineId)}.${key}`] = value;
  }

  const $set = {};
  for (const [key, value] of Object.entries(patch || {})) {
    $set[`${statsPath(engineId)}.${key}`] = value;
  }

  const update = {};
  if (Object.keys($inc).length > 0) update.$inc = $inc;
  if (Object.keys($set).length > 0) update.$set = $set;
  if (Object.keys(update).length === 0) return getTokenByValue(cleanToken);

  const updatedToken = await Token.findOneAndUpdate({ token: cleanToken }, update, { new: true, runValidators: true }).lean();
  return normalizeTokenDocument(updatedToken);
}

async function enableReplka(token) {
  return enableEngine(token, 'replka');
}

async function disableReplka(token) {
  return disableEngine(token, 'replka');
}

async function enableKarasi(token) {
  return enableEngine(token, 'karasi');
}

async function disableKarasi(token) {
  return disableEngine(token, 'karasi');
}

async function getReplkaTokens() {
  return getEngineTokens('replka');
}

async function getKarasiTokens() {
  return getEngineTokens('karasi');
}

module.exports = {
  addToken,
  removeToken,
  getToken,
  getTokenByValue,
  getAllTokens,
  getAllTokensForSelectMenu,
  getEngineTokens,
  getAccountsByEngine,
  setEngineEnabled,
  enableEngine,
  disableEngine,
  getEngineSettings,
  updateEngineSetting,
  resetEngineSettings,
  updateEngineRuntime,
  incrementEngineStats,
  getReplkaTokens,
  getKarasiTokens,
  enableReplka,
  disableReplka,
  enableKarasi,
  disableKarasi,
};
