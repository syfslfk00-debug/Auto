const mongoose = require('mongoose');

const gamePolicySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default', index: true },
  overlapLockEnabled: { type: Boolean, default: false },
  engineOverlapLocks: { type: Map, of: Boolean, default: () => ({}) },
  allowedServers: { type: [String], default: () => [] },
  engineAllowedServers: { type: Map, of: [String], default: () => ({}) },
  engineAllowedBots: { type: Map, of: [String], default: () => ({}) },
  engineBotFilters: { type: Map, of: Boolean, default: () => ({}) },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = mongoose.models.GamePolicy || mongoose.model('GamePolicy', gamePolicySchema);
