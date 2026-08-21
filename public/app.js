export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // API Endpoint: Registration
        if (url.pathname === '/api/auth/register' && request.method === 'POST') {
            const { username, password } = await request.json();
            if (!username || !password) {
                return Response.json({ error: 'Username and password required' }, { status: 400 });
            }

            const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
            if (existing) {
                return Response.json({ error: 'Username already in use' }, { status: 409 });
            }

            const userId = crypto.randomUUID();
            await env.DB.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)').bind(userId, username, password).run();

            const token = crypto.randomUUID();
            await env.DB.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').bind(token, userId).run();

            return new Response(JSON.stringify({ user: { id: userId, username } }), {
                status: 201,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`
                }
            });
        }

        // API Endpoint: Login
        if (url.pathname === '/api/auth/login' && request.method === 'POST') {
            const { username, password } = await request.json();
            const user = await env.DB.prepare('SELECT id, username, password FROM users WHERE username = ?').bind(username).first();

            if (!user || user.password !== password) {
                return Response.json({ error: 'Invalid credentials' }, { status: 401 });
            }

            const token = crypto.randomUUID();
            await env.DB.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').bind(token, user.id).run();

            return new Response(JSON.stringify({ user: { id: user.id, username: user.username } }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`
                }
            });
        }

        // API Endpoint: Session Verification
        if (url.pathname === '/api/auth/me' && request.method === 'GET') {
            const cookieHeader = request.headers.get('Cookie') || '';
            const match = cookieHeader.match(/session=([^;]+)/);
            const token = match ? match[1] : null;

            if (!token) {
                return Response.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const session = await env.DB.prepare(
                'SELECT u.id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?'
            ).bind(token).first();

            if (!session) {
                return Response.json({ error: 'Invalid or expired session' }, { status: 401 });
            }

            return Response.json({ user: session });
        }

        // API Endpoint: Logout
        if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
                }
            });
        }

        return new Response('Not Found', { status: 404 });
    }
};