export interface Env {
    DB: D1Database;
}

export async function handleAuth(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json",
    };

    try {
        // REGISTER ENDPOINT
        if (path === "/api/auth/register" && request.method === "POST") {
            const body = (await request.json()) as { username?: string; password?: string };
            const username = body.username?.trim();
            const password = body.password;

            if (!username || !password) {
                return new Response(JSON.stringify({ error: "Username and password are required." }), {
                    status: 400,
                    headers: corsHeaders,
                });
            }

            // Check if username already exists
            const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
            if (existing) {
                return new Response(JSON.stringify({ error: "Username is already taken." }), {
                    status: 400,
                    headers: corsHeaders,
                });
            }

            const userId = crypto.randomUUID();

            // Insert using exact D1 schema columns: id, username, password, bio, status, avatar_url
            await env.DB.prepare(
                "INSERT INTO users (id, username, password, bio, status, avatar_url) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(userId, username, password, "", "", "").run();

            const token = btoa(JSON.stringify({ userId, username, exp: Date.now() + 86400000 * 7 }));

            return new Response(JSON.stringify({
                token,
                user: { id: userId, username, bio: "", status: "", avatar_url: "" }
            }), {
                status: 200,
                headers: corsHeaders,
            });
        }

        // LOGIN ENDPOINT
        if (path === "/api/auth/login" && request.method === "POST") {
            const body = (await request.json()) as { username?: string; password?: string };
            const username = body.username?.trim();
            const password = body.password;

            if (!username || !password) {
                return new Response(JSON.stringify({ error: "Username and password are required." }), {
                    status: 400,
                    headers: corsHeaders,
                });
            }

            // Query using the correct 'password' column (completely purged of password_hash)
            const user = await env.DB.prepare(
                "SELECT id, username, password, bio, status, avatar_url FROM users WHERE username = ?"
            ).bind(username).first<{
                id: string;
                username: string;
                password: string;
                bio: string;
                status: string;
                avatar_url: string;
            }>();

            if (!user || user.password !== password) {
                return new Response(JSON.stringify({ error: "Invalid username or password." }), {
                    status: 401,
                    headers: corsHeaders,
                });
            }

            const token = btoa(JSON.stringify({ userId: user.id, username: user.username, exp: Date.now() + 86400000 * 7 }));

            return new Response(JSON.stringify({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    bio: user.bio,
                    status: user.status,
                    avatar_url: user.avatar_url
                }
            }), {
                status: 200,
                headers: corsHeaders,
            });
        }

        // ME / SESSION ENDPOINT
        if (path === "/api/auth/me" && request.method === "GET") {
            const authHeader = request.headers.get("Authorization");
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: corsHeaders,
                });
            }

            try {
                const token = authHeader.split(" ")[1];
                const decoded = JSON.parse(atob(token));
                if (decoded.exp < Date.now()) {
                    return new Response(JSON.stringify({ error: "Token expired" }), {
                        status: 401,
                        headers: corsHeaders,
                    });
                }

                const user = await env.DB.prepare(
                    "SELECT id, username, bio, status, avatar_url FROM users WHERE id = ?"
                ).bind(decoded.userId).first();

                if (!user) {
                    return new Response(JSON.stringify({ error: "User not found" }), {
                        status: 404,
                        headers: corsHeaders,
                    });
                }

                return new Response(JSON.stringify({ user }), {
                    status: 200,
                    headers: corsHeaders,
                });
            } catch {
                return new Response(JSON.stringify({ error: "Invalid token format" }), {
                    status: 400,
                    headers: corsHeaders,
                });
            }
        }

        return new Response(JSON.stringify({ error: "Authentication Route Not Found" }), {
            status: 404,
            headers: corsHeaders,
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
            status: 500,
            headers: corsHeaders,
        });
    }
}