const { connectDatabase } = require('../handlers/database');
const EngineLog = require('../models/EngineLog');

const retentionPolicies = {
  تشغيلي: 14,
  لعب: 30,
  نجاح: 30,
  خسارة: 45,
  خطأ: 90,
  تحذير: 45,
  إداري: 180,
  أمني: 180,
  تشخيصي: 30,
};

const sensitiveKeys = new Set(['token', 'توكن', 'authorization', 'password', 'secret']);
const persistentLevels = new Set(['خطأ', 'تحذير', 'إداري', 'أمني']);

async function ensureDatabase() {
  const connection = await connectDatabase();
  if (!connection) throw new Error('MongoDB connection is not available.');
  return connection;
}

function cleanLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

function cleanPage(page) {
  const parsed = Number(page);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function shortText(value, max = 300) {
  if (typeof value !== 'string') return value;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function sanitizeDetails(value, depth = 0) {
  if (!value || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 10).map(item => sanitizeDetails(item, depth + 1));
  if (typeof value !== 'object') return shortText(value, 500);

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (sensitiveKeys.has(String(key).toLowerCase())) continue;
    output[key] = sanitizeDetails(item, depth + 1);
  }
  return output;
}

function levelForEvent(event) {
  if (event.level) return event.level;
  const type = String(event.type || '');
  const result = String(event.result || '');
  if (event.status === 'error' || type.includes('error') || type.includes('failed')) return 'خطأ';
  if (type.includes('security')) return 'أمني';
  if (type.includes('admin')) return 'إداري';
  if (result === 'win' || type.includes('win')) return 'نجاح';
  if (result === 'loss' || type.includes('loss') || type.includes('timeout')) return 'خسارة';
  if (type.startsWith('game_')) return 'لعب';
  return 'تشغيلي';
}

function expiresAtForLevel(level, createdAt) {
  if (persistentLevels.has(level)) return undefined;
  const days = retentionPolicies[level];
  if (!days || days <= 0) return undefined;
  return new Date(new Date(createdAt).getTime() + days * 24 * 60 * 60 * 1000);
}

function shouldPersist(event, level) {
  if (event.persist === true) return true;
  if (event.persist === false) return false;
  const type = String(event.type || '');
  if (['خطأ', 'تحذير', 'إداري', 'أمني', 'نجاح', 'خسارة'].includes(level)) return true;
  if (type.startsWith('game_')) return true;
  return [
    'engine_token_started',
    'engine_token_stopped',
    'engine_token_restarted',
    'engine_login_failed',
    'engine_client_error',
    'engine_event_error',
    'admin_action',
  ].includes(type);
}

async function recordEvent(event) {
  try {
    const level = levelForEvent(event);
    if (!shouldPersist(event, level)) return null;

    await ensureDatabase();
    const createdAt = event.createdAt || new Date();
    const document = await EngineLog.create({
      type: event.type,
      level,
      engineId: event.engineId,
      engineName: event.engineName,
      accountName: event.accountName,
      status: event.status,
      result: event.result,
      serverId: event.serverId,
      serverName: shortText(event.serverName, 120),
      channelId: event.channelId,
      channelName: shortText(event.channelName, 120),
      gameName: shortText(event.gameName, 120),
      message: shortText(event.message, 300),
      details: sanitizeDetails(event.details || {}),
      archived: Boolean(event.archived),
      expiresAt: event.expiresAt || expiresAtForLevel(level, createdAt),
      createdAt,
    });
    return document.toObject();
  } catch (error) {
    console.error('[LogService] Failed to record event:', error.message);
    return null;
  }
}

async function getLogs(filters = {}) {
  try {
    await ensureDatabase();
    const query = {};
    if (filters.accountName) query.accountName = filters.accountName;
    if (filters.engineId) query.engineId = filters.engineId;
    if (filters.type) query.type = filters.type;
    if (filters.level) query.level = filters.level;
    if (filters.status) query.status = filters.status;
    if (filters.result) query.result = filters.result;
    if (filters.archived !== undefined) query.archived = Boolean(filters.archived);
    else query.archived = false;

    const limit = cleanLimit(filters.limit);
    const page = cleanPage(filters.page);
    return EngineLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('[LogService] Failed to fetch logs:', error.message);
    return [];
  }
}

async function countRecentErrors(minutes = 60) {
  try {
    await ensureDatabase();
    const since = new Date(Date.now() - Math.max(1, minutes) * 60 * 1000);
    return EngineLog.countDocuments({
      archived: false,
      createdAt: { $gte: since },
      $or: [
        { level: 'خطأ' },
        { status: 'error' },
        { type: /error|failed|failure/i },
      ],
    });
  } catch (error) {
    console.error('[LogService] Failed to count errors:', error.message);
    return 0;
  }
}

function buildMutationQuery(filters = {}) {
  const query = {};
  if (filters.accountName) query.accountName = filters.accountName;
  if (filters.engineId) query.engineId = filters.engineId;
  if (filters.type) query.type = filters.type;
  if (filters.level) query.level = filters.level;
  if (filters.status) query.status = filters.status;
  if (filters.result) query.result = filters.result;
  if (filters.olderThanDays) {
    query.createdAt = { $lt: new Date(Date.now() - Number(filters.olderThanDays) * 24 * 60 * 60 * 1000) };
  }
  return query;
}

async function deleteLogs(filters = {}) {
  try {
    await ensureDatabase();
    const result = await EngineLog.deleteMany(buildMutationQuery(filters));
    return result.deletedCount || 0;
  } catch (error) {
    console.error('[LogService] Failed to delete logs:', error.message);
    return 0;
  }
}

async function archiveLogs(filters = {}) {
  try {
    await ensureDatabase();
    const result = await EngineLog.updateMany(buildMutationQuery(filters), { $set: { archived: true } });
    return result.modifiedCount || 0;
  } catch (error) {
    console.error('[LogService] Failed to archive logs:', error.message);
    return 0;
  }
}

async function cleanupLogs(filters = {}) {
  if (filters.mode === 'حذف' || filters.mode === 'delete') return deleteLogs(filters);
  return archiveLogs(filters);
}

function getRetentionPolicies() {
  return { ...retentionPolicies };
}

function setRetentionPolicy(level, days) {
  const cleanDays = Math.max(1, Math.min(3650, Number(days) || 1));
  retentionPolicies[level] = cleanDays;
  return getRetentionPolicies();
}

module.exports = {
  recordEvent,
  getLogs,
  countRecentErrors,
  deleteLogs,
  archiveLogs,
  cleanupLogs,
  getRetentionPolicies,
  setRetentionPolicy,
  shouldPersist,
};
