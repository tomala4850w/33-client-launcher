const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');

const dbPath = path.join(config.dataDir, 'licenses.json');

function ensureDb() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ licenses: {} }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function getLicense(discordId) {
  const db = readDb();
  return db.licenses[String(discordId)] || null;
}

function setLicense(discordId, license) {
  const db = readDb();
  db.licenses[String(discordId)] = {
    ...license,
    discordId: String(discordId),
    updatedAt: new Date().toISOString()
  };
  writeDb(db);
  return db.licenses[String(discordId)];
}

function removeLicense(discordId) {
  const db = readDb();
  delete db.licenses[String(discordId)];
  writeDb(db);
}

function listLicenses() {
  return Object.values(readDb().licenses);
}

function isActive(license) {
  if (!license) {
    return false;
  }

  if (license.type === 'lifetime') {
    return true;
  }

  return Boolean(license.expiresAt && Date.parse(license.expiresAt) > Date.now());
}

module.exports = {
  getLicense,
  setLicense,
  removeLicense,
  listLicenses,
  isActive
};
