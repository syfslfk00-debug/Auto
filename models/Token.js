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

module.exports = mongoose.models.Token || mongoose.model('Token', tokenSchema);
