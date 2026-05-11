const path = require('node:path');
require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordClientSecret: required('DISCORD_CLIENT_SECRET'),
  guildId: optional('DISCORD_GUILD_ID', '1484513417317580840'),
  licenseRoleId: optional('DISCORD_LICENSE_ROLE_ID', '1502002061309513758'),
  apiPort: Number(optional('PORT', optional('API_PORT', '33333'))),
  publicBaseUrl: optional('PUBLIC_BASE_URL', 'http://localhost:33333').replace(/\/+$/, ''),
  sessionTtlMinutes: Number(optional('SESSION_TTL_MINUTES', '10')),
  clientJarPath: optional('CLIENT_JAR_PATH', path.join(__dirname, '..', '..', 'build', 'libs', '33client-1.0.0.jar')),
  clientJarBase64: optional('CLIENT_JAR_BASE64', ''),
  dataDir: optional('DATA_DIR', path.join(__dirname, '..', 'data'))
};
