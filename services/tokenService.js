const { connectDatabase } = require('../handlers/database');
const Token = require('../models/Token');

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

async function addToken(name, token) {
  await ensureDatabase();

  const cleanName = normalizeName(name);
  const cleanToken = normalizeToken(token);

  if (!cleanName) throw new Error('Token name is required.');
  if (!cleanToken) throw new Error('Token value is required.');

  return Token.findOneAndUpdate(
    { name: cleanName },
    { $set: { name: cleanName, token: cleanToken }, $setOnInsert: { createdAt: new Date() } },
    { new: true, upsert: true, runValidators: true }
  ).lean();
}

async function removeToken(name) {
  await ensureDatabase();

  const cleanName = normalizeName(name);
  if (!cleanName) throw new Error('Token name is required.');

  const removedToken = await Token.findOneAndDelete({ name: cleanName }).lean();
  return removedToken;
}

async function getToken(name) {
  await ensureDatabase();

  const cleanName = normalizeName(name);
  if (!cleanName) throw new Error('Token name is required.');

  return Token.findOne({ name: cleanName }).lean();
}

async function getAllTokens() {
  try {
    await ensureDatabase();
    return await Token.find({}).sort({ createdAt: 1, name: 1 }).lean();
  } catch (error) {
    console.error('[TokenService] Failed to fetch all tokens:', error.message);
    return [];
  }
}

async function getAllTokensForSelectMenu() {
  const tokens = await getAllTokens();
  return tokens.map(token => ({ key: token.name, value: token.token }));
}

async function getReplkaTokens() {
  try {
    await ensureDatabase();
    const tokens = await Token.find({ replkaEnabled: true }).select('token').sort({ createdAt: 1 }).lean();
    return tokens.map(item => item.token);
  } catch (error) {
    console.error('[TokenService] Failed to fetch Replka tokens:', error.message);
    return [];
  }
}

async function getKarasiTokens() {
  try {
    await ensureDatabase();
    const tokens = await Token.find({ karasiEnabled: true }).select('token').sort({ createdAt: 1 }).lean();
    return tokens.map(item => item.token);
  } catch (error) {
    console.error('[TokenService] Failed to fetch Karasi tokens:', error.message);
    return [];
  }
}

async function setEngineEnabled(token, field, enabled) {
  await ensureDatabase();

  const cleanToken = normalizeToken(token);
  if (!cleanToken) throw new Error('Token value is required.');

  const update = { $set: { [field]: enabled } };
  return Token.findOneAndUpdate({ token: cleanToken }, update, { new: true, runValidators: true }).lean();
}

async function enableReplka(token) {
  return setEngineEnabled(token, 'replkaEnabled', true);
}

async function disableReplka(token) {
  return setEngineEnabled(token, 'replkaEnabled', false);
}

async function enableKarasi(token) {
  return setEngineEnabled(token, 'karasiEnabled', true);
}

async function disableKarasi(token) {
  return setEngineEnabled(token, 'karasiEnabled', false);
}

module.exports = {
  addToken,
  removeToken,
  getToken,
  getAllTokens,
  getAllTokensForSelectMenu,
  getReplkaTokens,
  getKarasiTokens,
  enableReplka,
  disableReplka,
  enableKarasi,
  disableKarasi,
};
