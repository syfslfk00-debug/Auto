const { connectDatabase } = require('../handlers/database');
const EngineLog = require('../models/EngineLog');

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

async function recordEvent(event) {
  try {
    await ensureDatabase();
    const document = await EngineLog.create({
      type: event.type,
      engineId: event.engineId,
      engineName: event.engineName,
      accountName: event.accountName,
      status: event.status,
      result: event.result,
      serverName: event.serverName,
      channelName: event.channelName,
      gameName: event.gameName,
      message: event.message,
      details: event.details || {},
      createdAt: event.createdAt || new Date(),
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
    if (filters.status) query.status = filters.status;

    return EngineLog.find(query)
      .sort({ createdAt: -1 })
      .limit(cleanLimit(filters.limit))
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
      createdAt: { $gte: since },
      $or: [
        { status: 'error' },
        { type: /error|failed|failure/i },
      ],
    });
  } catch (error) {
    console.error('[LogService] Failed to count errors:', error.message);
    return 0;
  }
}

module.exports = {
  recordEvent,
  getLogs,
  countRecentErrors,
};
