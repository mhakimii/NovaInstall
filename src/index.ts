/**
 * NovaInstall — Cloudflare Worker
 * Bilingual admin panel with authentication (FA / EN)
 */

import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  APP_NAME: string;
  APP_VERSION: string;
  SESSION_SECRET?: string;
  INITIAL_ADMIN_PASSWORD?: string;
  INSTALL_COUNTER_URL?: string;
}

type Variables = {
  user?: {
    id: number;
    username: string;
    display_name: string | null;
    role: string;
    must_change_password: number;
  };
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => chars[b % chars.length]).join('');
}

async function createSessionToken(userId: number, secret: string): Promise<string> {
  const payload = {
    uid: userId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const data = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${data}.${sigHex}`;
}

async function verifySessionToken(token: string, secret: string): Promise<number | null> {
  try {
    const [data, sigHex] = token.split('.');
    if (!data || !sigHex) return null;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sig = new Uint8Array(sigHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(atob(data));
    if (payload.exp < Date.now()) return null;
    return payload.uid as number;
  } catch {
    return null;
  }
}

app.use('/api/*', cors({ origin: '*', credentials: true }));

app.use('/api/*', async (c, next) => {
  const secret = c.env.SESSION_SECRET || 'nova-install-dev-secret-change-me';
  const token = getCookie(c, 'nova_session');
  if (token) {
    const uid = await verifySessionToken(token, secret);
    if (uid) {
      const row = await c.env.DB.prepare(
        'SELECT id, username, display_name, role, must_change_password FROM users WHERE id = ? AND is_active = 1'
      )
        .bind(uid)
        .first<{
          id: number;
          username: string;
          display_name: string | null;
          role: string;
          must_change_password: number;
        }>();
      if (row) c.set('user', row);
    }
  }
  await next();
});

function requireAuth() {
  return async (c: any, next: any) => {
    if (!c.get('user')) {
      return json({ error: 'unauthorized', message: 'Authentication required' }, 401);
    }
    await next();
  };
}

async function ensureBootstrap(env: Env): Promise<{ created: boolean; password?: string }> {
  const count = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  if (count && count.c > 0) return { created: false };

  const password = env.INITIAL_ADMIN_PASSWORD || generatePassword(18);
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);

  await env.DB.prepare(
    `INSERT INTO users (username, password_hash, salt, display_name, role, must_change_password)
     VALUES (?, ?, ?, ?, 'admin', 1)`
  )
    .bind('admin', hash, salt, 'Administrator')
    .run();

  await env.DB.prepare(
    `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('bootstrapped', '1', datetime('now'))`
  ).run();

  if (env.INSTALL_COUNTER_URL) {
    try {
      await fetch(env.INSTALL_COUNTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'install', app: 'NovaInstall', version: env.APP_VERSION || '1.0.0' }),
      });
    } catch {}
  }

  return { created: true, password };
}

app.get('/api/health', (c) => {
  return json({
    ok: true,
    app: c.env.APP_NAME || 'NovaInstall',
    version: c.env.APP_VERSION || '1.0.0',
    env: c.env.ENVIRONMENT || 'production',
  });
});

app.get('/api/status', async (c) => {
  try {
    const userCount = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
    const installed = await c.env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'installed_at'`
    ).first<{ value: string }>();
    return json({
      ready: true,
      hasUsers: (userCount?.c || 0) > 0,
      installedAt: installed?.value || null,
      version: c.env.APP_VERSION || '1.0.0',
      app: c.env.APP_NAME || 'NovaInstall',
    });
  } catch (e: any) {
    return json({ ready: false, error: e.message }, 500);
  }
});

app.post('/api/bootstrap', async (c) => {
  const result = await ensureBootstrap(c.env);
  if (!result.created) {
    return json({ ok: false, message: 'Already bootstrapped' }, 400);
  }
  return json({
    ok: true,
    message: 'Admin created',
    username: 'admin',
    password: result.password,
    mustChange: true,
  });
});

app.post('/api/login', async (c) => {
  await ensureBootstrap(c.env);
  let body: { username?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const username = (body.username || '').trim().toLowerCase();
  const password = body.password || '';
  if (!username || !password) {
    return json({ error: 'missing_fields', message: 'Username and password required' }, 400);
  }
  const user = await c.env.DB.prepare(
    'SELECT id, username, password_hash, salt, display_name, role, must_change_password FROM users WHERE username = ? AND is_active = 1'
  )
    .bind(username)
    .first<{
      id: number;
      username: string;
      password_hash: string;
      salt: string;
      display_name: string | null;
      role: string;
      must_change_password: number;
    }>();
  if (!user) {
    return json({ error: 'invalid_credentials', message: 'Invalid username or password' }, 401);
  }
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) {
    return json({ error: 'invalid_credentials', message: 'Invalid username or password' }, 401);
  }
  const secret = c.env.SESSION_SECRET || 'nova-install-dev-secret-change-me';
  const token = await createSessionToken(user.id, secret);
  setCookie(c, 'nova_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  await c.env.DB.prepare(
    `INSERT INTO activity_log (user_id, action, ip) VALUES (?, 'login', ?)`
  )
    .bind(user.id, c.req.header('CF-Connecting-IP') || null)
    .run();
  return json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      mustChangePassword: !!user.must_change_password,
    },
  });
});

app.post('/api/logout', requireAuth(), async (c) => {
  const user = c.get('user')!;
  deleteCookie(c, 'nova_session', { path: '/' });
  await c.env.DB.prepare(
    `INSERT INTO activity_log (user_id, action) VALUES (?, 'logout')`
  )
    .bind(user.id)
    .run();
  return json({ ok: true });
});

app.get('/api/me', requireAuth(), async (c) => {
  const user = c.get('user')!;
  return json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    mustChangePassword: !!user.must_change_password,
  });
});

app.post('/api/change-password', requireAuth(), async (c) => {
  const user = c.get('user')!;
  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await c.req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const current = body.currentPassword || '';
  const next = body.newPassword || '';
  if (next.length < 8) {
    return json({ error: 'weak_password', message: 'Password must be at least 8 characters' }, 400);
  }
  const row = await c.env.DB.prepare(
    'SELECT password_hash, salt FROM users WHERE id = ?'
  )
    .bind(user.id)
    .first<{ password_hash: string; salt: string }>();
  if (!row) return json({ error: 'not_found' }, 404);
  const currentHash = await hashPassword(current, row.salt);
  if (currentHash !== row.password_hash) {
    return json({ error: 'wrong_password', message: 'Current password is incorrect' }, 400);
  }
  const newSalt = generateSalt();
  const newHash = await hashPassword(next, newSalt);
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, salt = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(newHash, newSalt, user.id)
    .run();
  await c.env.DB.prepare(
    `INSERT INTO activity_log (user_id, action) VALUES (?, 'change_password')`
  )
    .bind(user.id)
    .run();
  return json({ ok: true, message: 'Password changed successfully' });
});

app.get('/api/dashboard', requireAuth(), async (c) => {
  const installed = await c.env.DB.prepare(
    `SELECT value FROM settings WHERE key = 'installed_at'`
  ).first<{ value: string }>();
  const installId = await c.env.DB.prepare(
    `SELECT value FROM settings WHERE key = 'install_id'`
  ).first<{ value: string }>();
  const logCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as c FROM activity_log'
  ).first<{ c: number }>();
  return json({
    app: c.env.APP_NAME || 'NovaInstall',
    version: c.env.APP_VERSION || '1.0.0',
    installedAt: installed?.value || null,
    installId: installId?.value || null,
    activityCount: logCount?.c || 0,
    user: c.get('user'),
  });
});

app.get('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('NovaInstall is running. Frontend assets not configured.', 200);
});

export default app;
