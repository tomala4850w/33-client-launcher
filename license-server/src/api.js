const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');
const config = require('./config');
const store = require('./store');
const sessions = require('./sessions');
const discordBot = require('./discordBot');

function html(message) {
  return `<!doctype html>
<html lang="pl">
<head><meta charset="utf-8"><title>33 Client</title></head>
<body style="font-family: Arial, sans-serif; background: #101720; color: white; padding: 32px;">
${message}
</body>
</html>`;
}

function startApi() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (req, res) => {
    res.json({ ok: true, name: '33-client-license-server' });
  });

  app.post('/admin/client', express.raw({ type: 'application/java-archive', limit: '64mb' }), (req, res) => {
    if (!config.adminKey) {
      res.status(403).json({ ok: false, reason: 'ADMIN_UPLOAD_DISABLED' });
      return;
    }

    if (String(req.header('x-admin-key') || '') !== config.adminKey) {
      res.status(401).json({ ok: false, reason: 'INVALID_ADMIN_KEY' });
      return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length <= 0) {
      res.status(400).json({ ok: false, reason: 'EMPTY_FILE' });
      return;
    }

    fs.mkdirSync(require('node:path').dirname(config.clientJarPath), { recursive: true });
    fs.writeFileSync(config.clientJarPath, req.body);
    res.json({ ok: true, bytes: req.body.length, path: config.clientJarPath });
  });

  app.get('/auth/login', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: config.discordClientId,
      redirect_uri: `${config.publicBaseUrl}/auth/callback`,
      response_type: 'code',
      scope: 'identify',
      state
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  app.get('/auth/callback', async (req, res) => {
    const code = String(req.query.code || '');
    if (!code) {
      res.status(400).send(html('<h1>Brak kodu Discord.</h1>'));
      return;
    }

    try {
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.discordClientId,
          client_secret: config.discordClientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${config.publicBaseUrl}/auth/callback`
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Discord token error: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { authorization: `Bearer ${tokenData.access_token}` }
      });

      if (!userResponse.ok) {
        throw new Error(`Discord user error: ${userResponse.status}`);
      }

      const user = await userResponse.json();
      const session = sessions.createSession(user);

      res.send(html(`
        <h1>Zalogowano do 33 Client</h1>
        <p>Discord: <b>${session.globalName}</b></p>
        <p>Skopiuj ten token do launchera lokalnego:</p>
        <pre style="background:#0b1018;padding:16px;border-radius:8px;white-space:pre-wrap;">${session.token}</pre>
        <p>Token wygasa za ${config.sessionTtlMinutes} minut.</p>
      `));
    } catch (error) {
      console.error(error);
      res.status(500).send(html(`<h1>Blad logowania</h1><p>${error.message}</p>`));
    }
  });

  app.post('/api/verify', async (req, res) => {
    const sessionToken = String(req.body.sessionToken || '');
    const hwidHash = String(req.body.hwidHash || '');
    const result = await verifyAccess(sessionToken, hwidHash);

    if (!result.ok) {
      res.status(result.status).json({ ok: false, reason: result.reason });
      return;
    }

    res.json({
      ok: true,
      assignedHwid: result.assignedHwid,
      type: result.license.type || 'temporary',
      expiresAt: result.license.expiresAt
    });
  });

  app.post('/api/client', async (req, res) => {
    const sessionToken = String(req.body.sessionToken || '');
    const hwidHash = String(req.body.hwidHash || '');
    const result = await verifyAccess(sessionToken, hwidHash);

    if (!result.ok) {
      res.status(result.status).json({ ok: false, reason: result.reason });
      return;
    }

    if (fs.existsSync(config.clientJarPath)) {
      res.setHeader('content-type', 'application/java-archive');
      res.setHeader('content-disposition', 'attachment; filename="33client-1.0.0.jar"');
      fs.createReadStream(config.clientJarPath).pipe(res);
      return;
    }

    if (config.clientJarBase64) {
      try {
        const jar = Buffer.from(config.clientJarBase64, 'base64');
        if (jar.length > 0) {
          res.setHeader('content-type', 'application/java-archive');
          res.setHeader('content-disposition', 'attachment; filename="33client-1.0.0.jar"');
          res.send(jar);
          return;
        }
      } catch (error) {
        console.error('Invalid CLIENT_JAR_BASE64:', error.message);
      }
    }

    if (!fs.existsSync(config.clientJarPath)) {
      res.status(500).json({ ok: false, reason: 'CLIENT_JAR_MISSING' });
      return;
    }
  });

  async function verifyAccess(sessionToken, hwidHash) {
    const session = sessions.getSession(sessionToken);

    if (!session) {
      return { ok: false, status: 401, reason: 'SESSION_EXPIRED' };
    }

    if (!/^[a-f0-9]{64}$/i.test(hwidHash)) {
      return { ok: false, status: 400, reason: 'INVALID_HWID' };
    }

    const license = store.getLicense(session.discordId);
    if (!store.isActive(license)) {
      return { ok: false, status: 403, reason: 'NO_ACTIVE_LICENSE' };
    }

    const hasRole = await discordBot.hasLicenseRole(session.discordId).catch(() => false);
    if (!hasRole) {
      return { ok: false, status: 403, reason: 'MISSING_DISCORD_ROLE' };
    }

    if (!license.hwidHash) {
      const updated = store.setLicense(session.discordId, { ...license, hwidHash });
      return { ok: true, assignedHwid: true, license: updated };
    }

    if (license.hwidHash !== hwidHash) {
      return { ok: false, status: 403, reason: 'HWID_MISMATCH' };
    }

    return { ok: true, assignedHwid: false, license };
  }

  setInterval(sessions.cleanupSessions, 60_000);

  app.listen(config.apiPort, '0.0.0.0', () => {
    console.log(`License API listening on ${config.publicBaseUrl}`);
  });
}

module.exports = {
  startApi
};
