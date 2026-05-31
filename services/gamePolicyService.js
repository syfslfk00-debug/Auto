const { connectDatabase } = require('../handlers/database');
const GamePolicy = require('../models/GamePolicy');
const { getEngines } = require('./engineRegistry');

const DEFAULT_KEY = 'default';
const activeLocks = new Map();

async function ensureDatabase() {
  const connection = await connectDatabase();
  if (!connection) throw new Error('MongoDB connection is not available.');
  return connection;
}

function mapToObject(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...value };
}

function uniqueList(items) {
  return [...new Set((Array.isArray(items) ? items : String(items || '').split(/[\s,\n]+/)).map(item => String(item || '').trim()).filter(Boolean))];
}

function defaultBotFilters(value) {
  return getEngines().reduce((filters, engine) => {
    filters[engine.id] = value && value[engine.id] !== undefined ? Boolean(value[engine.id]) : true;
    return filters;
  }, {});
}

function normalize(doc) {
  const base = doc || {};
  const engineBotFilters = mapToObject(base.engineBotFilters);
  return {
    key: base.key || DEFAULT_KEY,
    overlapLockEnabled: Boolean(base.overlapLockEnabled),
    engineOverlapLocks: mapToObject(base.engineOverlapLocks),
    allowedServers: uniqueList(base.allowedServers || []),
    engineAllowedServers: mapToObject(base.engineAllowedServers),
    engineAllowedBots: mapToObject(base.engineAllowedBots),
    engineBotFilters: defaultBotFilters(engineBotFilters),
    updatedAt: base.updatedAt,
  };
}

async function getPolicy() {
  await ensureDatabase();
  const doc = await GamePolicy.findOneAndUpdate(
    { key: DEFAULT_KEY },
    { $setOnInsert: { key: DEFAULT_KEY, engineBotFilters: defaultBotFilters({}), updatedAt: new Date() } },
    { new: true, upsert: true }
  ).lean();
  return normalize(doc);
}

async function setOverlapLock(enabled, engineId) {
  await ensureDatabase();
  const $set = { updatedAt: new Date() };
  if (engineId) $set[`engineOverlapLocks.${engineId}`] = Boolean(enabled);
  else $set.overlapLockEnabled = Boolean(enabled);
  return normalize(await GamePolicy.findOneAndUpdate({ key: DEFAULT_KEY }, { $set }, { new: true, upsert: true }).lean());
}

async function setAllowedServers(scope, ids, engineId) {
  await ensureDatabase();
  const $set = { updatedAt: new Date() };
  if (scope === 'general') $set.allowedServers = uniqueList(ids);
  else if (scope === 'engine') $set[`engineAllowedServers.${engineId}`] = uniqueList(ids);
  else throw new Error('Unsupported server scope.');
  return normalize(await GamePolicy.findOneAndUpdate({ key: DEFAULT_KEY }, { $set }, { new: true, upsert: true }).lean());
}

async function setAllowedBots(engineId, ids) {
  await ensureDatabase();
  return normalize(await GamePolicy.findOneAndUpdate(
    { key: DEFAULT_KEY },
    { $set: { [`engineAllowedBots.${engineId}`]: uniqueList(ids), updatedAt: new Date() } },
    { new: true, upsert: true }
  ).lean());
}

function isBotFilterEnabled(policy, engineId) {
  const value = policy.engineBotFilters && policy.engineBotFilters[engineId];
  return value === undefined ? true : Boolean(value);
}

async function setBotFilterEnabled(engineId, enabled) {
  await ensureDatabase();
  return normalize(await GamePolicy.findOneAndUpdate(
    { key: DEFAULT_KEY },
    { $set: { [`engineBotFilters.${engineId}`]: Boolean(enabled), updatedAt: new Date() } },
    { new: true, upsert: true }
  ).lean());
}

async function toggleBotFilter(engineId) {
  const policy = await getPolicy();
  const next = !isBotFilterEnabled(policy, engineId);
  const updated = await setBotFilterEnabled(engineId, next);
  return { policy: updated, enabled: next };
}

function getEngineList(map, engineId) {
  const item = map && map[engineId];
  return uniqueList(item || []);
}

function serverListFor(policy, account, engineId) {
  const accountList = uniqueList(account && account.engineSettings && account.engineSettings[engineId] && account.engineSettings[engineId].allowedServers || []);
  if (accountList.length > 0) return accountList;
  const engineList = getEngineList(policy.engineAllowedServers, engineId);
  if (engineList.length > 0) return engineList;
  return uniqueList(policy.allowedServers || []);
}

function isServerAllowed(policy, account, engineId, serverId) {
  const list = serverListFor(policy, account, engineId);
  if (list.length === 0) return true;
  return Boolean(serverId && list.includes(String(serverId)));
}

function isBotAllowed(policy, engineId, botId) {
  if (!isBotFilterEnabled(policy, engineId)) return true;
  const list = getEngineList(policy.engineAllowedBots, engineId);
  if (list.length === 0) return false;
  return Boolean(botId && list.includes(String(botId)));
}

function isOverlapLockEnabled(policy, engineId) {
  const engineValue = policy.engineOverlapLocks && policy.engineOverlapLocks[engineId];
  if (engineValue !== undefined) return Boolean(engineValue);
  return Boolean(policy.overlapLockEnabled);
}

function lockKey(engineId, serverId, gameName) {
  return `${engineId}:${serverId || 'unknown'}:${gameName || engineId}`;
}

function acquireLock({ policy, engineId, serverId, gameName, token, accountName }) {
  if (!isOverlapLockEnabled(policy, engineId)) return { acquired: true, locked: false };
  const key = lockKey(engineId, serverId, gameName);
  const existing = activeLocks.get(key);
  if (existing && existing.token !== token) return { acquired: false, locked: true, owner: existing, key };
  const lock = { key, engineId, serverId, gameName, token, accountName, acquiredAt: new Date() };
  activeLocks.set(key, lock);
  return { acquired: true, locked: true, owner: lock, key };
}

function releaseLock(key, token) {
  const lock = activeLocks.get(key);
  if (!lock || (token && lock.token !== token)) return false;
  activeLocks.delete(key);
  return true;
}

function releaseLocksForToken(token, engineId) {
  let released = 0;
  for (const [key, lock] of activeLocks.entries()) {
    if (lock.token === token && (!engineId || lock.engineId === engineId)) {
      activeLocks.delete(key);
      released += 1;
    }
  }
  return released;
}

function releaseLockFromEvent(event) {
  const key = lockKey(event.engineId, event.serverId, event.gameName);
  const lock = activeLocks.get(key);
  if (lock && lock.token === event.token) {
    activeLocks.delete(key);
    return true;
  }
  return false;
}

function getLocks() {
  return [...activeLocks.values()];
}

function clearLocks(engineId) {
  let cleared = 0;
  for (const [key, lock] of activeLocks.entries()) {
    if (!engineId || lock.engineId === engineId) {
      activeLocks.delete(key);
      cleared += 1;
    }
  }
  return cleared;
}

module.exports = {
  getPolicy,
  setOverlapLock,
  setAllowedServers,
  setAllowedBots,
  setBotFilterEnabled,
  toggleBotFilter,
  uniqueList,
  serverListFor,
  isServerAllowed,
  isBotAllowed,
  isBotFilterEnabled,
  isOverlapLockEnabled,
  acquireLock,
  releaseLock,
  releaseLocksForToken,
  releaseLockFromEvent,
  getLocks,
  clearLocks,
};
