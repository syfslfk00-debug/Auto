const { connectDatabase } = require('../handlers/database');
const Token = require('../models/Token');
const { getEngine, getEngineByLegacyField } = require('./engineRegistry');

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

function enginePath(engineId) {
  return `engines.${engineId}`;
}

function normalizeTokenDocument(document) {
  if (!document) return document;
  const token = { ...document };
  const engines = token.engines instanceof Map ? Object.fromEntries(token.engines) : token.engines || {};

  if (typeof token.replkaEnabled === 'boolean' && engines.replka === undefined) engines.replka = token.replkaEnabled;
  if (typeof token.karasiEnabled === 'boolean' && engines.karasi === undefined) engines.karasi = token.karasiEnabled;

  token.engines = engines;
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
      $setOnInsert: { createdAt: new Date(), engines: {} },
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
      $or: [
        { [enginePath(engine.id)]: true },
        { [engine.legacyField]: true },
      ],
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
      $or: [
        { [enginePath(engine.id)]: true },
        { [engine.legacyField]: true },
      ],
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
      [enginePath(engine.id)]: enabled,
      [engine.legacyField]: enabled,
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
  getAllTokens,
  getAllTokensForSelectMenu,
  getEngineTokens,
  getAccountsByEngine,
  setEngineEnabled,
  enableEngine,
  disableEngine,
  getReplkaTokens,
  getKarasiTokens,
  enableReplka,
  disableReplka,
  enableKarasi,
  disableKarasi,
};
