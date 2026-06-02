const mongoose = require('mongoose');

const guildSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  channels: {
    general: { type: String },
    engines: { type: Map, of: String, default: () => ({}) },
    accounts: { type: Map, of: String, default: () => ({}) },
    zarAccounts: { type: Map, of: String, default: () => ({}) },
  },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = mongoose.models.GuildSettings || mongoose.model('GuildSettings', guildSettingsSchema);
