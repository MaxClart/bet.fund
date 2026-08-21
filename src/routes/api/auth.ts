export interface Env {
    DB: D1Database;
}

export async function handleAuth(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        });
    }

    try {
        // REGISTER ENDPOINT
        if (path === "/api/auth/register" && request.method === "POST") {
            const body = (await request.json()) as { username?: string; password?: string };
            const username = body.username?.trim();
            const password = body.password;

            if (!username || !password) {
                return new Response(JSON.stringify({ error: "Username and password are required." }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            // Check if user already exists
            const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
            if (existing) {
                return new Response(JSON.stringify({ error: "Username is already taken." }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            const userId = crypto.randomUUID();

            // Insert using the correct 'password' column matching D1 database schema
            await env.DB.prepare(
                "INSERT INTO users (id, username, password, bio, status, avatar_url, banner_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).bind(userId, username, password, "", "", "", "").run();

            const token = btoa(JSON.stringify({ userId, username, exp: Date.now() + 86400000 * 7 }));

            return new Response(JSON.stringify({
                token,
                user: { id: userId, username, bio: "", status: "", avatar_url: "", banner_url: "" }
            }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
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
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            // Query user and the 'password' column directly
            const user = await env.DB.prepare(
                "SELECT id, username, password, bio, status, avatar_url, banner_url FROM users WHERE username = ?"
            ).bind(username).first<{
                id: string;
                username: string;
                password: string;
                bio: string;
                status: string;
                avatar_url: string;
                banner_url: string;
            }>();

            if (!user || user.password !== password) {
                return new Response(JSON.stringify({ error: "Invalid username or password." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
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
                    avatar_url: user.avatar_url,
                    banner_url: user.banner_url
                }
            }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        // ME / SESSION ENDPOINT
        if (path === "/api/auth/me" && request.method === "GET") {
            const authHeader = request.headers.get("Authorization");
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            try {
                const token = authHeader.split(" ")[1];
                const decoded = JSON.parse(atob(token));
                if (decoded.exp < Date.now()) {
                    return new Response(JSON.stringify({ error: "Token expired" }), {
                        status: 401,
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }

                const user = await env.DB.prepare(
                    "SELECT id, username, bio, status, avatar_url, banner_url FROM users WHERE id = ?"
                ).bind(decoded.userId).first();

                if (!user) {
                    return new Response(JSON.stringify({ error: "User not found" }), {
                        status: 404,
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }

                return new Response(JSON.stringify({ user }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            } catch {
                return new Response(JSON.stringify({ error: "Invalid token format" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }
        }

        return new Response(JSON.stringify({ error: "Not Found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}