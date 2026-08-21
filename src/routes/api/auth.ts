export interface Env {
  DB: D1Database; // Bound to D1 ID: 57f76835-3ec2-4b94-99f1-bd645b4bd1c5
  JWT_SECRET?: string;
}

const JWT_SECRET_KEY = 'bet-fund-luxury-secret-key-change-in-prod';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function generateToken(payload: object): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64UrlHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const base64UrlPayload = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (86400 * 7) })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(JWT_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(`${base64UrlHeader}.${base64UrlPayload}`));
  const base64UrlSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${base64UrlHeader}.${base64UrlPayload}.${base64UrlSignature}`;
}

async function verifyToken(token: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(JWT_SECRET_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBuf = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBuf, enc.encode(`${header}.${payload}`));

    if (!valid) return null;

    const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) return null;

    return decodedPayload;
  } catch (err) {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Ensure D1 table schema exists on database 57f76835-3ec2-4b94-99f1-bd645b4bd1c5
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();
    } catch (dbInitErr: any) {
      console.error('D1 Table Initialization Error:', dbInitErr);
      return jsonResponse({ error: 'Database initialization failed.' }, 500);
    }

    try {
      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        const body: any = await request.json();
        const { email, password, username } = body;

        if (!email || !password || !username) {
          return jsonResponse({ error: 'Missing required fields.' }, 400);
        }

        const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email.toLowerCase()).first();
        if (existingUser) {
          return jsonResponse({ error: 'User with this email already exists.' }, 409);
        }

        const userId = crypto.randomUUID();
        const salt = crypto.randomUUID();
        const passwordHash = await hashPassword(password, salt);

        await env.DB.prepare(
          'INSERT INTO users (id, email, username, password_hash, salt) VALUES (?1, ?2, ?3, ?4, ?5)'
        )
          .bind(userId, email.toLowerCase(), username, passwordHash, salt)
          .run();

        const user = { id: userId, email: email.toLowerCase(), username };
        const token = await generateToken({ id: userId, email: user.email });

        return jsonResponse({ user, token }, 201);
      }

      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body: any = await request.json();
        const { email, password } = body;

        if (!email || !password) {
          return jsonResponse({ error: 'Email and password are required.' }, 400);
        }

        const record: any = await env.DB.prepare(
          'SELECT id, email, username, password_hash, salt FROM users WHERE email = ?1'
        )
          .bind(email.toLowerCase())
          .first();

        if (!record) {
          return jsonResponse({ error: 'Invalid email or password.' }, 401);
        }

        const inputHash = await hashPassword(password, record.salt);
        if (inputHash !== record.password_hash) {
          return jsonResponse({ error: 'Invalid email or password.' }, 401);
        }

        const user = { id: record.id, email: record.email, username: record.username };
        const token = await generateToken({ id: record.id, email: record.email });

        return jsonResponse({ user, token }, 200);
      }

      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return jsonResponse({ error: 'Unauthorized.' }, 401);
        }

        const token = authHeader.split(' ')[1];
        const payload = await verifyToken(token);

        if (!payload) {
          return jsonResponse({ error: 'Invalid or expired token.' }, 401);
        }

        const record: any = await env.DB.prepare(
          'SELECT id, email, username FROM users WHERE id = ?1'
        )
          .bind(payload.id)
          .first();

        if (!record) {
          return jsonResponse({ error: 'User not found.' }, 404);
        }

        return jsonResponse({ user: record }, 200);
      }

      return jsonResponse({ error: 'Endpoint not found' }, 404);
    } catch (err: any) {
      console.error('Worker API Error:', err);
      return jsonResponse({ error: err.message || 'Internal Server Error' }, 500);
    }
  },
};