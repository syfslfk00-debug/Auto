const { connectDatabase } = require('../handlers/database');
const GuildSettings = require('../models/GuildSettings');
const { getEngine } = require('./engineRegistry');

async function ensureDatabase() { const c = await connectDatabase(); if (!c) throw new Error('MongoDB connection is not available.'); return c; }
function mapToObject(value) { if (!value) return {}; if (value instanceof Map) return Object.fromEntries(value); return { ...value }; }
function normalize(doc) { if (!doc) return { channels: { general: null, engines: {}, accounts: {}, zarAccounts: {} } }; const channels = doc.channels || {}; return { guildId: doc.guildId, channels: { general: channels.general || null, engines: mapToObject(channels.engines), accounts: mapToObject(channels.accounts), zarAccounts: mapToObject(channels.zarAccounts) }, updatedAt: doc.updatedAt }; }
async function getSettings(guildId) { await ensureDatabase(); return normalize(await GuildSettings.findOne({ guildId }).lean()); }
async function setChannel(guildId, scope, channelId, key) {
  await ensureDatabase();
  const $set = { updatedAt: new Date() };
  if (scope === 'general') $set['channels.general'] = channelId;
  else if (scope === 'engine') { if (!getEngine(key)) throw new Error('Unknown engine.'); $set[`channels.engines.${key}`] = channelId; }
  else if (scope === 'account') { if (!key) throw new Error('Account name is required.'); $set[`channels.accounts.${key}`] = channelId; }
  else throw new Error('Unknown channel scope.');
  return normalize(await GuildSettings.findOneAndUpdate({ guildId }, { $set }, { new: true, upsert: true }).lean());
}
async function removeChannel(guildId, scope, key) {
  await ensureDatabase();
  const $unset = {}; const $set = { updatedAt: new Date() };
  if (scope === 'general') $unset['channels.general'] = '';
  else if (scope === 'engine') $unset[`channels.engines.${key}`] = '';
  else if (scope === 'account') $unset[`channels.accounts.${key}`] = '';
  else throw new Error('Unknown channel scope.');
  return normalize(await GuildSettings.findOneAndUpdate({ guildId }, { $unset, $set }, { new: true, upsert: true }).lean());
}
async function setZarChannel(guildId, accountName, channelId) {
  await ensureDatabase();
  if (!guildId) throw new Error('Guild ID is required.');
  if (!accountName) throw new Error('Account name is required.');
  if (!channelId) throw new Error('Channel ID is required.');
  return normalize(await GuildSettings.findOneAndUpdate({ guildId }, { $set: { [`channels.zarAccounts.${accountName}`]: channelId, updatedAt: new Date() } }, { new: true, upsert: true }).lean());
}
async function getZarChannelForAccount(accountName) {
  await ensureDatabase();
  if (!accountName) return null;
  const doc = await GuildSettings.findOne({ [`channels.zarAccounts.${accountName}`]: { $exists: true } }).sort({ updatedAt: -1 }).lean();
  if (!doc || !doc.channels) return null;
  const zarAccounts = mapToObject(doc.channels.zarAccounts);
  return zarAccounts[accountName] ? { guildId: doc.guildId, channelId: zarAccounts[accountName] } : null;
}
function resolveChannel(settings, event) {
  const c = settings.channels || {};
  if (event.accountName && c.accounts && c.accounts[event.accountName]) return { channelId: c.accounts[event.accountName], scope: 'account' };
  if (event.engineId && c.engines && c.engines[event.engineId]) return { channelId: c.engines[event.engineId], scope: 'engine' };
  if (c.general) return { channelId: c.general, scope: 'general' };
  return null;
}
module.exports = { getSettings, setChannel, removeChannel, setZarChannel, getZarChannelForAccount, resolveChannel };