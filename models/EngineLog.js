const mongoose = require('mongoose');

const engineLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    index: true,
  },
  level: {
    type: String,
    default: 'تشغيلي',
    index: true,
  },
  engineId: {
    type: String,
    index: true,
  },
  engineName: {
    type: String,
  },
  accountName: {
    type: String,
    index: true,
  },
  status: {
    type: String,
    index: true,
  },
  result: {
    type: String,
    index: true,
  },
  serverId: {
    type: String,
  },
  serverName: {
    type: String,
  },
  channelId: {
    type: String,
  },
  channelName: {
    type: String,
  },
  gameName: {
    type: String,
  },
  message: {
    type: String,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  archived: {
    type: Boolean,
    default: false,
    index: true,
  },
  expiresAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  versionKey: false,
});

engineLogSchema.index({ engineId: 1, createdAt: -1 });
engineLogSchema.index({ accountName: 1, createdAt: -1 });
engineLogSchema.index({ type: 1, createdAt: -1 });
engineLogSchema.index({ level: 1, createdAt: -1 });
engineLogSchema.index({ archived: 1, createdAt: -1 });
engineLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.EngineLog || mongoose.model('EngineLog', engineLogSchema);
