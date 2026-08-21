export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Helper: Define CORS Headers
        const origin = request.headers.get('Origin') || '*';
        const corsHeaders = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
            'Access-Control-Allow-Credentials': 'true',
        };

        // 0. HANDLE CORS PREFLIGHT (OPTIONS)
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // Helper: Response wrapper with CORS
        function jsonResponse(data, status = 200, extraHeaders = {}) {
            return new Response(JSON.stringify(data), {
                status,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                    ...extraHeaders,
                },
            });
        }

        const cookieHeader = request.headers.get('Cookie') || '';
        const match = cookieHeader.match(/session=([^;]+)/);
        const token = match ? match[1] : null;

        // Session Authenticator Helper
        async function getAuthUser() {
            if (!token) return null;
            try {
                return await env.DB.prepare(
                    `SELECT u.id, u.username, u.bio, u.status, u.avatar_url, u.banner_url, 
                            u.avatar_transform, u.banner_transform 
                     FROM sessions s 
                     JOIN users u ON s.user_id = u.id 
                     WHERE s.token = ?`
                ).bind(token).first();
            } catch (err) {
                console.error("D1 Auth Query Error:", err);
                return null;
            }
        }

        try {
            // 1. REGISTER
            if (url.pathname === '/api/auth/register' && request.method === 'POST') {
                const body = await request.json().catch(() => null);
                if (!body || !body.username || !body.password) {
                    return jsonResponse({ error: 'Username and password required' }, 400);
                }

                const { username, password } = body;

                // Check duplicate user
                const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
                    .bind(username)
                    .first();

                if (existing) {
                    return jsonResponse({ error: 'Username already taken' }, 409);
                }

                const userId = crypto.randomUUID();
                await env.DB.prepare(
                    'INSERT INTO users (id, username, password, bio, status) VALUES (?, ?, ?, ?, ?)'
                ).bind(userId, username, password, '', '').run();

                const sessionToken = crypto.randomUUID();
                await env.DB.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)')
                    .bind(sessionToken, userId)
                    .run();

                return jsonResponse(
                    { user: { id: userId, username, bio: '', status: '', avatar_url: '', banner_url: '' } },
                    201,
                    { 'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=None; Path=/` }
                );
            }

            // 2. LOGIN
            if (url.pathname === '/api/auth/login' && request.method === 'POST') {
                const body = await request.json().catch(() => null);
                if (!body || !body.username || !body.password) {
                    return jsonResponse({ error: 'Username and password required' }, 400);
                }

                const { username, password } = body;
                const user = await env.DB.prepare('SELECT id, username, password FROM users WHERE username = ?')
                    .bind(username)
                    .first();

                if (!user || user.password !== password) {
                    return jsonResponse({ error: 'Invalid credentials' }, 401);
                }

                const sessionToken = crypto.randomUUID();
                await env.DB.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)')
                    .bind(sessionToken, user.id)
                    .run();

                const fullUser = await env.DB.prepare(
                    'SELECT id, username, bio, status, avatar_url, banner_url, avatar_transform, banner_transform FROM users WHERE id = ?'
                ).bind(user.id).first();

                return jsonResponse(
                    { user: fullUser },
                    200,
                    { 'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=None; Path=/` }
                );
            }

            // 3. GET CURRENT USER SESSION
            if (url.pathname === '/api/auth/me' && request.method === 'GET') {
                const user = await getAuthUser();
                if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
                return jsonResponse({ user });
            }

            // 4. LOGOUT
            if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
                if (token) {
                    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
                }
                return jsonResponse(
                    { success: true },
                    200,
                    { 'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0' }
                );
            }

            // 5. UPDATE PROFILE DETAILS & TRANSFORMS
            if (url.pathname === '/api/user/profile' && request.method === 'PUT') {
                const user = await getAuthUser();
                if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

                const body = await request.json().catch(() => ({}));
                const { name, status, bio, avatarTransform, bannerTransform } = body;

                await env.DB.prepare(
                    `UPDATE users 
                     SET username = ?, status = ?, bio = ?, avatar_transform = ?, banner_transform = ? 
                     WHERE id = ?`
                ).bind(
                    name || user.username,
                    status || '',
                    bio || '',
                    JSON.stringify(avatarTransform || { zoom: 100, x: 0, y: 0 }),
                    JSON.stringify(bannerTransform || { zoom: 100, x: 0, y: 0 }),
                    user.id
                ).run();

                return jsonResponse({ success: true });
            }

            // 6. R2 MEDIA UPLOAD
            if (url.pathname === '/api/user/upload' && request.method === 'POST') {
                const user = await getAuthUser();
                if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

                const formData = await request.formData();
                const file = formData.get('file');
                const targetType = formData.get('type');

                if (!file || !['avatar', 'banner'].includes(targetType)) {
                    return jsonResponse({ error: 'Invalid file or target type' }, 400);
                }

                const ext = file.name ? file.name.split('.').pop() : 'png';
                const objectKey = `${user.id}/${targetType}_${Date.now()}.${ext}`;

                await env.MEDIA_BUCKET.put(objectKey, file.stream(), {
                    httpMetadata: { contentType: file.type || 'image/png' }
                });

                const publicUrl = `/api/media/${objectKey}`;
                const targetColumn = targetType === 'avatar' ? 'avatar_url' : 'banner_url';

                await env.DB.prepare(`UPDATE users SET ${targetColumn} = ? WHERE id = ?`)
                    .bind(publicUrl, user.id)
                    .run();

                return jsonResponse({ url: publicUrl, type: targetType });
            }

            // 7. SERVE MEDIA FROM R2
            if (url.pathname.startsWith('/api/media/') && request.method === 'GET') {
                const key = url.pathname.replace('/api/media/', '');
                const object = await env.MEDIA_BUCKET.get(key);

                if (!object) return new Response('Media Not Found', { status: 404, headers: corsHeaders });

                const headers = new Headers(corsHeaders);
                object.writeHttpMetadata(headers);
                headers.set('etag', object.httpEtag);
                headers.set('Cache-Control', 'public, max-age=31536000');

                return new Response(object.body, { headers });
            }

            // 8. SERVE STATIC ASSETS FOR NON-API ROUTES
            if (env.ASSETS) {
                return await env.ASSETS.fetch(request);
            }

            return jsonResponse({ error: 'Not Found' }, 404);

        } catch (err) {
            console.error("Worker Execution Error:", err);
            return jsonResponse({ error: 'Internal Server Error', details: err.message }, 500);
        }
    }
};