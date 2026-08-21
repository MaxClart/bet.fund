export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const cookieHeader = request.headers.get('Cookie') || '';
        const match = cookieHeader.match(/session=([^;]+)/);
        const token = match ? match[1] : null;

        // Session Authenticator Helper
        async function getAuthUser() {
            if (!token) return null;
            return await env.DB.prepare(
                `SELECT u.id, u.username, u.bio, u.status, u.avatar_url, u.banner_url, 
                        u.avatar_transform, u.banner_transform 
                 FROM sessions s 
                 JOIN users u ON s.user_id = u.id 
                 WHERE s.token = ?`
            ).bind(token).first();
        }

        // 1. REGISTER (Clean initialization, bio strictly empty)
        if (url.pathname === '/api/auth/register' && request.method === 'POST') {
            const { username, password } = await request.json();
            if (!username || !password) {
                return Response.json({ error: 'Username and password required' }, { status: 400 });
            }

            const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
            if (existing) {
                return Response.json({ error: 'Username already taken' }, { status: 409 });
            }

            const userId = crypto.randomUUID();
            await env.DB.prepare(
                'INSERT INTO users (id, username, password, bio, status) VALUES (?, ?, ?, ?, ?)'
            ).bind(userId, username, password, '', '').run();

            const sessionToken = crypto.randomUUID();
            await env.DB.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').bind(sessionToken, userId).run();

            return new Response(JSON.stringify({ 
                user: { id: userId, username, bio: '', status: '', avatar_url: '', banner_url: '' } 
            }), {
                status: 201,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/`
                }
            });
        }

        // 2. LOGIN
        if (url.pathname === '/api/auth/login' && request.method === 'POST') {
            const { username, password } = await request.json();
            const user = await env.DB.prepare('SELECT id, username, password FROM users WHERE username = ?').bind(username).first();

            if (!user || user.password !== password) {
                return Response.json({ error: 'Invalid credentials' }, { status: 401 });
            }

            const sessionToken = crypto.randomUUID();
            await env.DB.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').bind(sessionToken, user.id).run();

            const fullUser = await env.DB.prepare(
                'SELECT id, username, bio, status, avatar_url, banner_url, avatar_transform, banner_transform FROM users WHERE id = ?'
            ).bind(user.id).first();

            return new Response(JSON.stringify({ user: fullUser }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/`
                }
            });
        }

        // 3. GET CURRENT USER SESSION (State Hydration on Reload)
        if (url.pathname === '/api/auth/me' && request.method === 'GET') {
            const user = await getAuthUser();
            if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
            return Response.json({ user });
        }

        // 4. LOGOUT
        if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
            if (token) {
                await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
            }
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
                }
            });
        }

        // 5. UPDATE PROFILE DETAILS & TRANSFORMS
        if (url.pathname === '/api/user/profile' && request.method === 'PUT') {
            const user = await getAuthUser();
            if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

            const { name, status, bio, avatarTransform, bannerTransform } = await request.json();

            await env.DB.prepare(
                `UPDATE users 
                 SET username = ?, status = ?, bio = ?, avatar_transform = ?, banner_transform = ? 
                 WHERE id = ?`
            ).bind(
                name,
                status,
                bio,
                JSON.stringify(avatarTransform),
                JSON.stringify(bannerTransform),
                user.id
            ).run();

            return Response.json({ success: true });
        }

        // 6. R2 MEDIA UPLOAD (Avatar / Banner)
        if (url.pathname === '/api/user/upload' && request.method === 'POST') {
            const user = await getAuthUser();
            if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

            const formData = await request.formData();
            const file = formData.get('file');
            const targetType = formData.get('type');

            if (!file || !['avatar', 'banner'].includes(targetType)) {
                return Response.json({ error: 'Invalid file or target type' }, { status: 400 });
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

            return Response.json({ url: publicUrl, type: targetType });
        }

        // 7. SERVE MEDIA FROM R2
        if (url.pathname.startsWith('/api/media/') && request.method === 'GET') {
            const key = url.pathname.replace('/api/media/', '');
            const object = await env.MEDIA_BUCKET.get(key);

            if (!object) return new Response('Media Not Found', { status: 404 });

            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            headers.set('Cache-Control', 'public, max-age=31536000');

            return new Response(object.body, { headers });
        }

        // 8. SERVE STATIC FRONTEND ASSETS FOR NON-API ROUTES (Fallback)
        return env.ASSETS 
            ? await env.ASSETS.fetch(request) 
            : new Response('Not Found', { status: 404 });
    }
};