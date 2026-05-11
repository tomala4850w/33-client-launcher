const crypto = require('node:crypto');
const config = require('./config');

const sessions = new Map();

function createSession(discordUser) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + config.sessionTtlMinutes * 60_000;
  sessions.set(token, {
    token,
    discordId: discordUser.id,
    username: discordUser.username,
    globalName: discordUser.global_name || discordUser.username,
    expiresAt
  });
  return sessions.get(token);
}

function getSession(token) {
  if (!token) {
    return null;
  }

  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

module.exports = {
  createSession,
  getSession,
  cleanupSessions
};
