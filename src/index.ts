export interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // ================= AUTH ROUTES =================
            if (path.startsWith("/api/auth")) {
                return await handleAuth(request, env, corsHeaders);
            }

            // ================= PROFILE UPDATE ROUTE =================
            if (path === "/api/profile" && request.method === "PUT") {
                const authHeader = request.headers.get("Authorization");
                if (!authHeader || !authHeader.startsWith("Bearer ")) {
                    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
                const token = authHeader.split(" ")[1];
                let decoded: any;
                try { decoded = JSON.parse(atob(token)); } catch {
                    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }

                const body = (await request.json()) as { bio?: string; status?: string; avatar_url?: string; banner_url?: string };
                await env.DB.prepare(
                    "UPDATE users SET bio = ?, status = ?, avatar_url = ?, banner_url = ? WHERE id = ?"
                ).bind(body.bio || "", body.status || "", body.avatar_url || "", body.banner_url || "", decoded.userId).run();

                return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // ================= R2 UPLOAD ROUTE =================
            if (path === "/api/upload" && request.method === "POST") {
                const formData = await request.formData();
                const file = formData.get("file") as File;
                const folder = (formData.get("folder") as string) || "general";

                if (!file) {
                    return new Response(JSON.stringify({ error: "No file provided" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                const ext = file.name.split(".").pop() || "bin";
                const key = `${folder}/${crypto.randomUUID()}.${ext}`;
                const arrayBuffer = await file.arrayBuffer();

                await env.BUCKET.put(key, arrayBuffer, {
                    httpMetadata: { contentType: file.type },
                });

                const fileUrl = `/cdn-cgi/storage/public/${key}`;

                return new Response(JSON.stringify({ url: fileUrl, key }), {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // ================= STORIES ROUTES =================
            if (path === "/api/stories") {
                if (request.method === "GET") {
                    const { results } = await env.DB.prepare(
                        `SELECT stories.*, users.username, users.avatar_url 
                         FROM stories 
                         JOIN users ON stories.user_id = users.id 
                         WHERE stories.created_at >= datetime('now', '-24 hours') 
                         ORDER BY stories.created_at DESC`
                    ).all();

                    return new Response(JSON.stringify({ stories: results }), {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                if (request.method === "POST") {
                    const body = (await request.json()) as { userId: string; mediaUrl: string; mediaType: string; caption?: string };
                    if (!body.userId || !body.mediaUrl) {
                        return new Response(JSON.stringify({ error: "Missing required fields" }), {
                            status: 400,
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    }

                    const storyId = crypto.randomUUID();
                    await env.DB.prepare(
                        "INSERT INTO stories (id, user_id, media_url, media_type, caption) VALUES (?, ?, ?, ?, ?)"
                    ).bind(storyId, body.userId, body.mediaUrl, body.mediaType || "image", body.caption || "").run();

                    return new Response(JSON.stringify({ success: true, storyId }), {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
            }

            // ================= FRIENDS & SEARCH ROUTES =================
            if (path.startsWith("/api/friends")) {
                const authHeader = request.headers.get("Authorization");
                if (!authHeader || !authHeader.startsWith("Bearer ")) {
                    return new Response(JSON.stringify({ error: "Unauthorized" }), {
                        status: 401,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                const token = authHeader.split(" ")[1];
                let decoded: any;
                try {
                    decoded = JSON.parse(atob(token));
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid token" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                const userId = decoded.userId;

                // SEARCH USERS ROUTE
                if (path === "/api/friends/search" && request.method === "GET") {
                    const searchQuery = url.searchParams.get("query") || "";
                    const { results } = await env.DB.prepare(
                        `SELECT id, username, avatar_url, bio, status 
                         FROM users 
                         WHERE id != ? AND username LIKE ? 
                         LIMIT 20`
                    ).bind(userId, `%${searchQuery}%`).all();

                    return new Response(JSON.stringify({ users: results }), {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                if (path === "/api/friends" && request.method === "GET") {
                    const { results } = await env.DB.prepare(
                        `SELECT u.id, u.username, u.avatar_url, u.status 
                         FROM friends f 
                         JOIN users u ON (f.friend_id = u.id) 
                         WHERE f.user_id = ?`
                    ).bind(userId).all();

                    return new Response(JSON.stringify({ friends: results }), {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                if (path === "/api/friends/requests" && request.method === "GET") {
                    const { results } = await env.DB.prepare(
                        `SELECT fr.id, u.id as sender_id, u.username, u.avatar_url 
                         FROM friend_requests fr 
                         JOIN users u ON fr.sender_id = u.id 
                         WHERE fr.receiver_id = ? AND fr.status = 'pending'`
                    ).bind(userId).all();

                    return new Response(JSON.stringify({ requests: results }), {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                if (path === "/api/friends/request" && request.method === "POST") {
                    const body = (await request.json()) as { targetUsername?: string; targetUserId?: string };
                    let targetUser: any = null;

                    if (body.targetUserId) {
                        targetUser = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(body.targetUserId).first();
                    } else if (body.targetUsername) {
                        targetUser = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(body.targetUsername).first();
                    }

                    if (!targetUser) {
                        return new Response(JSON.stringify({ error: "User not found" }), {
                            status: 404,
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    }

                    if (targetUser.id === userId) {
                        return new Response(JSON.stringify({ error: "Cannot add yourself" }), {
                            status: 400,
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    }

                    const existingReq = await env.DB.prepare(
                        "SELECT id FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)"
                    ).bind(userId, targetUser.id, targetUser.id, userId).first();

                    if (existingReq) {
                        return new Response(JSON.stringify({ error: "Friend request already exists or already friends" }), {
                            status: 400,
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    }

                    const requestId = crypto.randomUUID();
                    await env.DB.prepare(
                        "INSERT INTO friend_requests (id, sender_id, receiver_id, status) VALUES (?, ?, ?, 'pending')"
                    ).bind(requestId, userId, targetUser.id).run();

                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                if (path === "/api/friends/accept" && request.method === "POST") {
                    const body = (await request.json()) as { requestId: string; senderId: string };
                    
                    await env.DB.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").bind(body.requestId).run();
                    
                    await env.DB.prepare("INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), userId, body.senderId).run();
                    await env.DB.prepare("INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), body.senderId, userId).run();

                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
            }

            return new Response(JSON.stringify({ error: "Not Found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });

        } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    },
};

async function handleAuth(request: Request, env: Env, corsHeaders: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/auth/register" && request.method === "POST") {
        const body = (await request.json()) as { username?: string; password?: string };
        const username = body.username?.trim();
        const password = body.password;

        if (!username || !password) {
            return new Response(JSON.stringify({ error: "Username and password required." }), { status: 400, headers: corsHeaders });
        }

        const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
        if (existing) {
            return new Response(JSON.stringify({ error: "Username already taken." }), { status: 400, headers: corsHeaders });
        }

        const userId = crypto.randomUUID();
        await env.DB.prepare(
            "INSERT INTO users (id, username, password, bio, status, avatar_url, banner_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(userId, username, password, "", "", "", "").run();

        const token = btoa(JSON.stringify({ userId, username, exp: Date.now() + 86400000 * 7 }));
        return new Response(JSON.stringify({ token, user: { id: userId, username, bio: "", status: "", avatar_url: "", banner_url: "" } }), { status: 200, headers: corsHeaders });
    }

    if (path === "/api/auth/login" && request.method === "POST") {
        const body = (await request.json()) as { username?: string; password?: string };
        const username = body.username?.trim();
        const password = body.password;

        if (!username || !password) {
            return new Response(JSON.stringify({ error: "Username and password required." }), { status: 400, headers: corsHeaders });
        }

        const user = await env.DB.prepare(
            "SELECT id, username, password, bio, status, avatar_url, banner_url FROM users WHERE username = ?"
        ).bind(username).first<any>();

        if (!user || user.password !== password) {
            return new Response(JSON.stringify({ error: "Invalid credentials." }), { status: 401, headers: corsHeaders });
        }

        const token = btoa(JSON.stringify({ userId: user.id, username: user.username, exp: Date.now() + 86400000 * 7 }));
        return new Response(JSON.stringify({ token, user: { id: user.id, username: user.username, bio: user.bio, status: user.status, avatar_url: user.avatar_url, banner_url: user.banner_url } }), { status: 200, headers: corsHeaders });
    }

    if (path === "/api/auth/me" && request.method === "GET") {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }
        try {
            const token = authHeader.split(" ")[1];
            const decoded = JSON.parse(atob(token));
            const user = await env.DB.prepare("SELECT id, username, bio, status, avatar_url, banner_url FROM users WHERE id = ?").bind(decoded.userId).first();
            return new Response(JSON.stringify({ user }), { status: 200, headers: corsHeaders });
        } catch {
            return new Response(JSON.stringify({ error: "Invalid token" }), { status: 400, headers: corsHeaders });
        }
    }

    return new Response(JSON.stringify({ error: "Auth route not found" }), { status: 404, headers: corsHeaders });
}