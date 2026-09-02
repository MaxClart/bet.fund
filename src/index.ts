/// <reference types="@cloudflare/workers-types" />

export interface Env {
    DB: D1Database;
    MEDIA_BUCKET: R2Bucket;
    ASSETS: Fetcher;
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}, cors: Record<string, string> = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...cors, ...extraHeaders },
    });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        const origin = request.headers.get("Origin") || "*";
        const corsHeaders: Record<string, string> = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
            "Access-Control-Allow-Credentials": "true",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // ---- resolve session token: Authorization: Bearer <token>, else Cookie ----
        const authHeader = request.headers.get("Authorization") || "";
        const cookieHeader = request.headers.get("Cookie") || "";
        let token: string | null = null;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.slice(7).trim();
        } else {
            const match = cookieHeader.match(/session=([^;]+)/);
            if (match) token = match[1];
        }

        async function getAuthUser(): Promise<any | null> {
            if (!token) return null;
            try {
                return await env.DB.prepare(
                    `SELECT u.id, u.username, u.display_name, u.bio, u.status, u.avatar_url, u.banner_url,
                            u.avatar_transform, u.banner_transform, u.is_elite, u.wallet_address
                     FROM sessions s
                     JOIN users u ON s.user_id = u.id
                     WHERE s.token = ?`
                ).bind(token).first();
            } catch (err) {
                console.error("Auth lookup failed:", err);
                return null;
            }
        }

        // Live Solana wallet snapshot: current SOL balance + USD value.
        // This is NOT profit/loss — that would require reconstructing full
        // trade history with cost basis, a much bigger feature. This is a
        // real-time balance check against Solana's public RPC.
        async function fetchWalletSnapshot(address: string): Promise<{ solBalance: number; usdValue: number | null; error?: string } | null> {
            // Basic Solana pubkey shape check (base58, 32-44 chars) so a bad
            // address gives a clear error instead of a generic RPC failure.
            if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
                return { solBalance: 0, usdValue: null, error: "Invalid Solana address format" };
            }

            const rpcEndpoints = [
                "https://api.mainnet-beta.solana.com",
                "https://rpc.ankr.com/solana",
            ];

            let lamports: number | null = null;
            let lastError = "";

            for (const endpoint of rpcEndpoints) {
                try {
                    const rpcRes = await fetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
                    });
                    if (!rpcRes.ok) { lastError = `RPC HTTP ${rpcRes.status}`; continue; }
                    const rpcData = await rpcRes.json<any>();
                    if (rpcData?.error) { lastError = rpcData.error.message || "RPC error"; continue; }
                    if (typeof rpcData?.result?.value === "number") {
                        lamports = rpcData.result.value;
                        break;
                    }
                    lastError = "Unexpected RPC response shape";
                } catch (err: any) {
                    lastError = err.message || "Network error";
                }
            }

            if (lamports === null) {
                console.error("Wallet snapshot: all RPC endpoints failed:", lastError);
                return { solBalance: 0, usdValue: null, error: lastError || "Balance temporarily unavailable" };
            }

            const solBalance = lamports / 1_000_000_000;

            let usdValue: number | null = null;
            try {
                const priceRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
                if (priceRes.ok) {
                    const priceData = await priceRes.json<any>();
                    const solPrice = priceData?.solana?.usd;
                    if (typeof solPrice === "number") usdValue = solBalance * solPrice;
                }
            } catch {
                // Price lookup failing shouldn't hide the balance itself
            }

            return { solBalance, usdValue };
        }

        try {
            // ================= AUTH =================


            if (path === "/api/auth/register" && request.method === "POST") {
                const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
                const rawUsername = body?.username?.trim();
                const password = body?.password;
                if (!rawUsername || !password) return json({ error: "Username and password required" }, 400, {}, corsHeaders);
                // Usernames are stored lowercased so "y" and "Y" can't become two
                // different accounts. display_name keeps whatever casing they typed.
                const username = rawUsername.toLowerCase();

                const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
                if (existing) return json({ error: "Username already taken" }, 409, {}, corsHeaders);

                const userId = crypto.randomUUID();
                await env.DB.prepare(
                    `INSERT INTO users (id, username, display_name, password, bio, status, avatar_url, banner_url, is_elite)
                     VALUES (?, ?, ?, ?, '', '', '', '', 0)`
                ).bind(userId, username, rawUsername, password).run();

                const sessionToken = crypto.randomUUID();
                await env.DB.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").bind(sessionToken, userId).run();

                const user = { id: userId, username, display_name: rawUsername, bio: "", status: "", avatar_url: "", banner_url: "", is_elite: 0 };
                return json({ token: sessionToken, user }, 201,
                    { "Set-Cookie": `session=${sessionToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=2592000` },
                    corsHeaders);
            }

            if (path === "/api/auth/login" && request.method === "POST") {
                const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
                const username = body?.username?.trim().toLowerCase();
                const password = body?.password;
                if (!username || !password) return json({ error: "Username and password required" }, 400, {}, corsHeaders);

                const user = await env.DB.prepare("SELECT id, username, password FROM users WHERE username = ?").bind(username).first<any>();
                if (!user || user.password !== password) return json({ error: "Invalid username or password" }, 401, {}, corsHeaders);

                const sessionToken = crypto.randomUUID();
                await env.DB.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").bind(sessionToken, user.id).run();

                const fullUser = await env.DB.prepare(
                    `SELECT id, username, display_name, bio, status, avatar_url, banner_url, avatar_transform, banner_transform, is_elite
                     FROM users WHERE id = ?`
                ).bind(user.id).first();

                return json({ token: sessionToken, user: fullUser }, 200,
                    { "Set-Cookie": `session=${sessionToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=2592000` },
                    corsHeaders);
            }

            if (path === "/api/auth/me" && request.method === "GET") {
                const user = await getAuthUser();
                if (!user) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);
                return json({ user }, 200, {}, corsHeaders);
            }

            if (path === "/api/auth/logout" && request.method === "POST") {
                if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
                return json({ success: true }, 200, { "Set-Cookie": "session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0" }, corsHeaders);
            }

            if (path === "/api/auth/logout-all" && request.method === "POST") {
                const user = await getAuthUser();
                if (!user) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);
                await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
                return json({ success: true }, 200, { "Set-Cookie": "session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0" }, corsHeaders);
            }

            // ================= PROFILE =================

            if (path === "/api/user/profile" && request.method === "PUT") {
                const user = await getAuthUser();
                if (!user) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);

                const body = await request.json().catch(() => ({} as any)) as any;
                const { displayName, status, bio, avatarTransform, bannerTransform, walletAddress, tradingPlatforms } = body;

                await env.DB.prepare(
                    `UPDATE users SET display_name = ?, status = ?, bio = ?, avatar_transform = ?, banner_transform = ?, wallet_address = ?, trading_platforms = ? WHERE id = ?`
                ).bind(
                    (displayName ?? user.display_name ?? user.username) || user.username,
                    status ?? "",
                    bio ?? "",
                    JSON.stringify(avatarTransform || { zoom: 1, x: 0, y: 0 }),
                    JSON.stringify(bannerTransform || { zoom: 1, x: 0, y: 0 }),
                    (walletAddress ?? "").trim() || null,
                    JSON.stringify(Array.isArray(tradingPlatforms) ? tradingPlatforms : []),
                    user.id
                ).run();

                return json({ success: true }, 200, {}, corsHeaders);
            }

            // ================= R2 UPLOAD (avatar / banner / story) =================

            if (path === "/api/user/upload" && request.method === "POST") {
                const user = await getAuthUser();
                if (!user) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);

                const formData = await request.formData();
                const file = formData.get("file") as File | null;
                const targetType = formData.get("type") as string | null;

                if (!file || !targetType || !["avatar", "banner", "story"].includes(targetType)) {
                    return json({ error: "Invalid file or target type" }, 400, {}, corsHeaders);
                }

                const ext = file.name ? file.name.split(".").pop() : "png";
                const objectKey = `${user.id}/${targetType}_${Date.now()}.${ext}`;

                await env.MEDIA_BUCKET.put(objectKey, file.stream(), {
                    httpMetadata: { contentType: file.type || "image/png" },
                });

                const publicUrl = `/api/media/${objectKey}`;

                // avatar/banner immediately update the user row; story media does not
                // (the story record itself is created via a separate POST /api/stories call)
                if (targetType === "avatar" || targetType === "banner") {
                    const column = targetType === "avatar" ? "avatar_url" : "banner_url";
                    await env.DB.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).bind(publicUrl, user.id).run();
                }

                return json({ url: publicUrl, type: targetType }, 200, {}, corsHeaders);
            }

            if (path.startsWith("/api/media/") && request.method === "GET") {
                const key = path.replace("/api/media/", "");
                const object = await env.MEDIA_BUCKET.get(key);
                if (!object) return new Response("Media Not Found", { status: 404, headers: corsHeaders });

                const headers = new Headers(corsHeaders);
                object.writeHttpMetadata(headers);
                headers.set("etag", object.httpEtag);
                headers.set("Cache-Control", "public, max-age=31536000");
                return new Response(object.body, { headers });
            }

            // ================= STORIES =================
            // Public stories are visible to people who follow the poster.
            // Private stories are visible to the poster's friends only.
            // The poster can always see their own.

            if (path === "/api/stories" && request.method === "GET") {
                const viewer = await getAuthUser();
                if (!viewer) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);

                const { results } = await env.DB.prepare(
                    `SELECT stories.*, users.username, users.display_name, users.avatar_url
                     FROM stories JOIN users ON stories.user_id = users.id
                     WHERE stories.created_at >= datetime('now', '-24 hours')
                     AND (
                        stories.user_id = ?
                        OR (stories.visibility = 'public' AND (
                            EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = stories.user_id)
                            OR EXISTS (SELECT 1 FROM friends fr WHERE fr.user_id = ? AND fr.friend_id = stories.user_id)
                        ))
                        OR (stories.visibility = 'private' AND EXISTS (
                            SELECT 1 FROM friends fr WHERE fr.user_id = ? AND fr.friend_id = stories.user_id
                        ))
                     )
                     ORDER BY stories.created_at DESC`
                ).bind(viewer.id, viewer.id, viewer.id, viewer.id).all();
                return json({ stories: results }, 200, {}, corsHeaders);
            }

            if (path === "/api/stories" && request.method === "POST") {
                const user = await getAuthUser();
                if (!user) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);

                const body = await request.json().catch(() => ({} as any)) as any;
                if (!body.mediaUrl) return json({ error: "Missing mediaUrl" }, 400, {}, corsHeaders);
                const visibility = body.visibility === "private" ? "private" : "public";

                const storyId = crypto.randomUUID();
                await env.DB.prepare(
                    "INSERT INTO stories (id, user_id, media_url, media_type, caption, visibility) VALUES (?, ?, ?, ?, ?, ?)"
                ).bind(storyId, user.id, body.mediaUrl, body.mediaType || "image", body.caption || "", visibility).run();

                return json({ success: true, storyId }, 200, {}, corsHeaders);
            }

            // ================= FOLLOWING =================

            if (path === "/api/follow" && request.method === "POST") {
                const user = await getAuthUser();
                if (!user) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);

                const body = await request.json().catch(() => ({} as any)) as any;
                if (!body.targetUserId) return json({ error: "Missing targetUserId" }, 400, {}, corsHeaders);
                if (body.targetUserId === user.id) return json({ error: "Cannot follow yourself" }, 400, {}, corsHeaders);

                const existing = await env.DB.prepare(
                    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?"
                ).bind(user.id, body.targetUserId).first();
                if (existing) return json({ success: true, alreadyFollowing: true }, 200, {}, corsHeaders);

                await env.DB.prepare(
                    "INSERT INTO follows (id, follower_id, following_id) VALUES (?, ?, ?)"
                ).bind(crypto.randomUUID(), user.id, body.targetUserId).run();

                return json({ success: true }, 200, {}, corsHeaders);
            }

            if (path === "/api/unfollow" && request.method === "POST") {
                const user = await getAuthUser();
                if (!user) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);

                const body = await request.json().catch(() => ({} as any)) as any;
                if (!body.targetUserId) return json({ error: "Missing targetUserId" }, 400, {}, corsHeaders);

                await env.DB.prepare(
                    "DELETE FROM follows WHERE follower_id = ? AND following_id = ?"
                ).bind(user.id, body.targetUserId).run();

                return json({ success: true }, 200, {}, corsHeaders);
            }

            // ================= PUBLIC USER PROFILE =================
            // GET /api/users/:id -> profile info + relationship flags relative to viewer

            if (path.startsWith("/api/users/") && request.method === "GET") {
                const viewer = await getAuthUser();
                if (!viewer) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);

                const targetId = path.replace("/api/users/", "");
                const profileUser = await env.DB.prepare(
                    `SELECT id, username, display_name, bio, status, avatar_url, banner_url,
                            avatar_transform, banner_transform, is_elite, wallet_address, trading_platforms
                     FROM users WHERE id = ?`
                ).bind(targetId).first<any>();
                if (!profileUser) return json({ error: "User not found" }, 404, {}, corsHeaders);

                const [isFriend, isFollowing, followerCountRow, followingCountRow, walletSnapshot] = await Promise.all([
                    env.DB.prepare("SELECT id FROM friends WHERE user_id = ? AND friend_id = ?").bind(viewer.id, targetId).first(),
                    env.DB.prepare("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?").bind(viewer.id, targetId).first(),
                    env.DB.prepare("SELECT COUNT(*) as c FROM follows WHERE following_id = ?").bind(targetId).first<any>(),
                    env.DB.prepare("SELECT COUNT(*) as c FROM follows WHERE follower_id = ?").bind(targetId).first<any>(),
                    profileUser.wallet_address ? fetchWalletSnapshot(profileUser.wallet_address) : Promise.resolve(null),
                ]);

                const isSelf = targetId === viewer.id;
                const friendFlag = !!isFriend;
                const followingFlag = !!isFollowing;

                const allStories = await env.DB.prepare(
                    `SELECT * FROM stories WHERE user_id = ? AND created_at >= datetime('now', '-24 hours') ORDER BY created_at DESC`
                ).bind(targetId).all<any>();
                const visibleStories = (allStories.results || []).filter((s: any) =>
                    isSelf || (s.visibility === "public" && (followingFlag || friendFlag)) || (s.visibility === "private" && friendFlag)
                );

                return json({
                    user: profileUser,
                    isSelf,
                    isFriend: friendFlag,
                    isFollowing: followingFlag,
                    followerCount: followerCountRow?.c ?? 0,
                    followingCount: followingCountRow?.c ?? 0,
                    stories: visibleStories,
                    wallet: walletSnapshot,
                }, 200, {}, corsHeaders);
            }

            // ================= FRIENDS =================

            if (path.startsWith("/api/friends")) {
                const user = await getAuthUser();
                if (!user) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);
                const userId = user.id;

                if (path === "/api/friends/search" && request.method === "GET") {
                    const q = url.searchParams.get("query") || "";
                    const { results } = await env.DB.prepare(
                        `SELECT id, username, display_name, avatar_url, bio, status
                         FROM users WHERE id != ? AND username LIKE ? LIMIT 20`
                    ).bind(userId, `%${q}%`).all();
                    return json({ users: results }, 200, {}, corsHeaders);
                }

                if (path === "/api/friends" && request.method === "GET") {
                    const { results } = await env.DB.prepare(
                        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status
                         FROM friends f JOIN users u ON f.friend_id = u.id
                         WHERE f.user_id = ?`
                    ).bind(userId).all();
                    return json({ friends: results }, 200, {}, corsHeaders);
                }

                if (path === "/api/friends/requests" && request.method === "GET") {
                    const { results } = await env.DB.prepare(
                        `SELECT fr.id, u.id as sender_id, u.username, u.display_name, u.avatar_url
                         FROM friend_requests fr JOIN users u ON fr.sender_id = u.id
                         WHERE fr.receiver_id = ? AND fr.status = 'pending'`
                    ).bind(userId).all();
                    return json({ requests: results }, 200, {}, corsHeaders);
                }

                if (path === "/api/friends/request" && request.method === "POST") {
                    const body = await request.json().catch(() => ({} as any)) as any;
                    let targetUser: any = null;

                    if (body.targetUserId) {
                        targetUser = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(body.targetUserId).first();
                    } else if (body.targetUsername) {
                        targetUser = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(body.targetUsername.trim().toLowerCase()).first();
                    }

                    if (!targetUser) return json({ error: "User not found" }, 404, {}, corsHeaders);
                    if (targetUser.id === userId) return json({ error: "Cannot add yourself" }, 400, {}, corsHeaders);

                    const alreadyFriends = await env.DB.prepare(
                        "SELECT id FROM friends WHERE user_id = ? AND friend_id = ?"
                    ).bind(userId, targetUser.id).first();
                    if (alreadyFriends) return json({ error: "Already friends" }, 400, {}, corsHeaders);

                    const existingReq = await env.DB.prepare(
                        `SELECT id FROM friend_requests
                         WHERE status = 'pending' AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))`
                    ).bind(userId, targetUser.id, targetUser.id, userId).first();
                    if (existingReq) return json({ error: "Friend request already pending" }, 400, {}, corsHeaders);

                    const requestId = crypto.randomUUID();
                    await env.DB.prepare(
                        "INSERT INTO friend_requests (id, sender_id, receiver_id, status) VALUES (?, ?, ?, 'pending')"
                    ).bind(requestId, userId, targetUser.id).run();

                    return json({ success: true }, 200, {}, corsHeaders);
                }

                if (path === "/api/friends/accept" && request.method === "POST") {
                    const body = await request.json().catch(() => ({} as any)) as any;
                    const { requestId, senderId } = body;
                    if (!requestId || !senderId) return json({ error: "Missing requestId or senderId" }, 400, {}, corsHeaders);

                    const req = await env.DB.prepare(
                        "SELECT id FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'pending'"
                    ).bind(requestId, userId).first();
                    if (!req) return json({ error: "Request not found" }, 404, {}, corsHeaders);

                    await env.DB.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").bind(requestId).run();
                    await env.DB.prepare("INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), userId, senderId).run();
                    await env.DB.prepare("INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), senderId, userId).run();

                    return json({ success: true }, 200, {}, corsHeaders);
                }

                if (path === "/api/friends/decline" && request.method === "POST") {
                    const body = await request.json().catch(() => ({} as any)) as any;
                    if (!body.requestId) return json({ error: "Missing requestId" }, 400, {}, corsHeaders);
                    await env.DB.prepare(
                        "UPDATE friend_requests SET status = 'declined' WHERE id = ? AND receiver_id = ?"
                    ).bind(body.requestId, userId).run();
                    return json({ success: true }, 200, {}, corsHeaders);
                }
            }

            // ================= MESSAGES =================

            if (path.startsWith("/api/messages")) {
                const user = await getAuthUser();
                if (!user) return json({ error: "Unauthorized" }, 401, {}, corsHeaders);

                // GET /api/messages/:friendId -> full conversation with that friend
                if (path.startsWith("/api/messages/") && request.method === "GET") {
                    const friendId = path.replace("/api/messages/", "");

                    const isFriend = await env.DB.prepare(
                        "SELECT id FROM friends WHERE user_id = ? AND friend_id = ?"
                    ).bind(user.id, friendId).first();
                    if (!isFriend) return json({ error: "Not friends with this user" }, 403, {}, corsHeaders);

                    const { results } = await env.DB.prepare(
                        `SELECT id, sender_id, receiver_id, content, created_at FROM messages
                         WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                         ORDER BY created_at ASC LIMIT 200`
                    ).bind(user.id, friendId, friendId, user.id).all();

                    await env.DB.prepare(
                        "UPDATE messages SET read = 1 WHERE sender_id = ? AND receiver_id = ?"
                    ).bind(friendId, user.id).run();

                    return json({ messages: results }, 200, {}, corsHeaders);
                }

                // POST /api/messages -> { receiverId, content }
                if (path === "/api/messages" && request.method === "POST") {
                    const body = await request.json().catch(() => ({} as any)) as any;
                    const { receiverId, content } = body;
                    if (!receiverId || !content || !content.trim()) {
                        return json({ error: "receiverId and content are required" }, 400, {}, corsHeaders);
                    }

                    const isFriend = await env.DB.prepare(
                        "SELECT id FROM friends WHERE user_id = ? AND friend_id = ?"
                    ).bind(user.id, receiverId).first();
                    if (!isFriend) return json({ error: "Not friends with this user" }, 403, {}, corsHeaders);

                    const messageId = crypto.randomUUID();
                    await env.DB.prepare(
                        "INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)"
                    ).bind(messageId, user.id, receiverId, content.trim()).run();

                    return json({ success: true, messageId }, 200, {}, corsHeaders);
                }

                // GET /api/messages -> unread counts per friend, for badges
                if (path === "/api/messages" && request.method === "GET") {
                    const { results } = await env.DB.prepare(
                        `SELECT sender_id, COUNT(*) as unread FROM messages
                         WHERE receiver_id = ? AND read = 0 GROUP BY sender_id`
                    ).bind(user.id).all();
                    return json({ unread: results }, 200, {}, corsHeaders);
                }
            }

            // ================= STATIC ASSETS =================
            if (env.ASSETS) {
                return await env.ASSETS.fetch(request);
            }

            return json({ error: "Not Found" }, 404, {}, corsHeaders);
        } catch (err: any) {
            console.error("Worker error:", err);
            return json({ error: "Internal Server Error", details: err.message }, 500, {}, corsHeaders);
        }
    },
};
