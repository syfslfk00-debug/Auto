const mongoose = require('mongoose');

let connectionPromise = null;
let listenersRegistered = false;

function registerConnectionListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] Connected successfully.');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected. Mongoose will retry when possible.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Reconnected successfully.');
  });

  mongoose.connection.on('error', error => {
    console.error('[MongoDB] Connection error:', error.message);
  });
}

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('[MongoDB] MONGODB_URI is missing. Database operations will be unavailable.');
    return null;
  }

  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  registerConnectionListeners();

  connectionPromise = mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  }).then(() => mongoose.connection).catch(error => {
    connectionPromise = null;
    console.error('[MongoDB] Failed to connect:', error.message);
    return null;
  });

  return connectionPromise;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  connectionPromise = null;
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  mongoose,
};
