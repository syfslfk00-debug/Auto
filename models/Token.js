const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true,
  },
  replkaEnabled: {
    type: Boolean,
    default: false,
    index: true,
  },
  karasiEnabled: {
    type: Boolean,
    default: false,
    index: true,
  },
  engines: {
    type: Map,
    of: Boolean,
    default: () => ({}),
  },
  status: {
    type: String,
    default: 'active',
    index: true,
  },
  engineSettings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  engineStats: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  runtime: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  versionKey: false,
});

tokenSchema.index({ replkaEnabled: 1, token: 1 });
tokenSchema.index({ karasiEnabled: 1, token: 1 });
tokenSchema.index({ 'engines.$**': 1 });
tokenSchema.index({ 'engineSettings.$**': 1 });
tokenSchema.index({ 'engineStats.$**': 1 });
tokenSchema.index({ 'runtime.$**': 1 });

module.exports = mongoose.models.Token || mongoose.model('Token', tokenSchema);
