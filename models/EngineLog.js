const mongoose = require('mongoose');

const engineLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
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
  },
  serverName: {
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

module.exports = mongoose.models.EngineLog || mongoose.model('EngineLog', engineLogSchema);
