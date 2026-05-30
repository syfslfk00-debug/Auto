const fs = require('fs');
const path = require('path');
const { connectDatabase, disconnectDatabase } = require('./handlers/database');
const tokenService = require('./services/tokenService');

const FILES = ['tokens.json', 'replka-tokens.json', 'karasi-tokens.json'];

function readJson(file) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return {};

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`[Migration] Failed to read ${file}:`, error.message);
    return {};
  }
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups', `json-backup-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  for (const file of FILES) {
    const source = path.join(__dirname, file);
    if (!fs.existsSync(source)) continue;
    fs.copyFileSync(source, path.join(backupDir, file));
  }

  console.log(`[Migration] Backup created at ${backupDir}`);
}

function getTokenEntries(tokensData) {
  return Object.entries(tokensData)
    .filter(([name, token]) => name !== 'tokens' && typeof name === 'string' && typeof token === 'string' && name.trim() && token.trim())
    .map(([name, token]) => ({ name: name.trim(), token: token.trim() }));
}

function getEnabledTokens(data) {
  if (!data || !Array.isArray(data.tokens)) return [];
  return [...new Set(data.tokens.filter(token => typeof token === 'string' && token.trim()).map(token => token.trim()))];
}

function generatedNameForToken(token, index) {
  const safe = token.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || index;
  return `migrated-${safe}`;
}

async function migrate() {
  const connection = await connectDatabase();
  if (!connection) throw new Error('Cannot run migration without MONGODB_URI.');

  createBackup();

  const tokensData = readJson('tokens.json');
  const replkaData = readJson('replka-tokens.json');
  const karasiData = readJson('karasi-tokens.json');

  const tokenEntries = getTokenEntries(tokensData);
  const replkaTokens = getEnabledTokens(replkaData);
  const karasiTokens = getEnabledTokens(karasiData);
  const knownTokens = new Map(tokenEntries.map(entry => [entry.token, entry.name]));

  [...replkaTokens, ...karasiTokens].forEach((token, index) => {
    if (!knownTokens.has(token)) knownTokens.set(token, generatedNameForToken(token, index + 1));
  });

  let migratedCount = 0;
  for (const [token, name] of knownTokens.entries()) {
    await tokenService.addToken(name, token);
    if (replkaTokens.includes(token)) await tokenService.enableReplka(token);
    if (karasiTokens.includes(token)) await tokenService.enableKarasi(token);
    migratedCount += 1;
  }

  console.log(`[Migration] Completed successfully. Migrated/updated ${migratedCount} token(s).`);
}

migrate()
  .catch(error => {
    console.error('[Migration] Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
