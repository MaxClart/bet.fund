export interface Env {
  DB: D1Database;
  STORAGE_BUCKET: R2Bucket;
  ASSETS: Fetcher;
}

const jsonResponse = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });

// Simple SHA-256 for password verification & IDs
async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password + "bet_fund_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getUserIdFromAuth(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token.includes("_")) return null;
  return token.split("_")[0];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    try {
      // -------------------------------------------------------------
      // AUTHENTICATION ROUTES
      // -------------------------------------------------------------
      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        const { username, password } = await request.json<any>();
        if (!username || !password) {
          return jsonResponse({ error: "Username and password required" }, 400);
        }

        const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username.toLowerCase()).first();
        if (existing) {
          return jsonResponse({ error: "Username already taken" }, 400);
        }

        const userId = crypto.randomUUID();
        const pwdHash = await hashPassword(password);

        // Strict Requirement: No random avatar, bio defaults to empty string
        await env.DB.prepare(
          "INSERT INTO users (id, username, password_hash, bio, status, avatar_url) VALUES (?, ?, ?, '', '', NULL)"
        ).bind(userId, username.toLowerCase(), pwdHash).run();

        const user = { id: userId, username: username.toLowerCase(), bio: "", status: "", avatar_url: null, banner_url: null };
        const token = `${userId}_${crypto.randomUUID()}`;
        return jsonResponse({ user, token });
      }

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const { username, password } = await request.json<any>();
        const pwdHash = await hashPassword(password);

        const user: any = await env.DB.prepare(
          "SELECT id, username, bio, status, avatar_url, avatar_transform, banner_url, banner_transform FROM users WHERE username = ? AND password_hash = ?"
        ).bind(username.toLowerCase(), pwdHash).first();

        if (!user) {
          return jsonResponse({ error: "Invalid username or password" }, 401);
        }

        const token = `${user.id}_${crypto.randomUUID()}`;
        return jsonResponse({ user, token });
      }

      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        const userId = getUserIdFromAuth(request);
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        const user: any = await env.DB.prepare(
          "SELECT id, username, bio, status, avatar_url, avatar_transform, banner_url, banner_transform FROM users WHERE id = ?"
        ).bind(userId).first();

        if (!user) return jsonResponse({ error: "User not found" }, 404);
        return jsonResponse({ user });
      }

      // -------------------------------------------------------------
      // PROFILE & MEDIA UPLOAD ROUTES
      // -------------------------------------------------------------
      if (url.pathname === "/api/user/profile" && request.method === "PUT") {
        const userId = getUserIdFromAuth(request);
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        const { name, status, bio, avatarTransform, bannerTransform } = await request.json<any>();

        await env.DB.prepare(
          `UPDATE users SET 
            bio = ?, 
            status = ?, 
            avatar_transform = ?, 
            banner_transform = ? 
          WHERE id = ?`
        ).bind(
          bio || "",
          status || "",
          JSON.stringify(avatarTransform || { zoom: 100, x: 0, y: 0 }),
          JSON.stringify(bannerTransform || { zoom: 100, x: 0, y: 0 }),
          userId
        ).run();

        return jsonResponse({ success: true });
      }

      if (url.pathname === "/api/user/upload" && request.method === "POST") {
        const userId = getUserIdFromAuth(request);
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const uploadType = formData.get("type") as string; // 'avatar', 'banner', 'chat_media', 'story'

        if (!file) return jsonResponse({ error: "No file provided" }, 400);

        const fileExt = file.name.split(".").pop() || "bin";
        const key = `${uploadType}s/${userId}_${crypto.randomUUID()}.${fileExt}`;

        await env.STORAGE_BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });

        const publicUrl = `/api/media/${key}`;

        if (uploadType === "avatar") {
          await env.DB.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").bind(publicUrl, userId).run();
        } else if (uploadType === "banner") {
          await env.DB.prepare("UPDATE users SET banner_url = ? WHERE id = ?").bind(publicUrl, userId).run();
        }

        return jsonResponse({ url: publicUrl, key });
      }

      if (url.pathname.startsWith("/api/media/")) {
        const mediaKey = url.pathname.replace("/api/media/", "");
        const object = await env.STORAGE_BUCKET.get(mediaKey);

        if (!object) return new Response("File not found", { status: 404 });

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Access-Control-Allow-Origin", "*");

        return new Response(object.body, { headers });
      }

      // -------------------------------------------------------------
      // FRIEND SYSTEM ROUTES
      // -------------------------------------------------------------
      if (url.pathname === "/api/friends/search" && request.method === "GET") {
        const userId = getUserIdFromAuth(request);
        const query = url.searchParams.get("q") || "";
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        const users = await env.DB.prepare(
          "SELECT id, username, avatar_url, bio FROM users WHERE username LIKE ? AND id != ? LIMIT 10"
        ).bind(`%${query.toLowerCase()}%`, userId).all();

        return jsonResponse({ results: users.results });
      }

      if (url.pathname === "/api/friends/request" && request.method === "POST") {
        const userId = getUserIdFromAuth(request);
        const { targetUserId } = await request.json<any>();
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        const reqId = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO friends (id, user_id, friend_id, status) VALUES (?, ?, ?, 'pending')"
        ).bind(reqId, userId, targetUserId).run();

        return jsonResponse({ success: true });
      }

      if (url.pathname === "/api/friends/accept" && request.method === "POST") {
        const userId = getUserIdFromAuth(request);
        const { requestId } = await request.json<any>();
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        await env.DB.prepare("UPDATE friends SET status = 'accepted' WHERE id = ? AND friend_id = ?")
          .bind(requestId, userId)
          .run();

        return jsonResponse({ success: true });
      }

      if (url.pathname === "/api/friends/list" && request.method === "GET") {
        const userId = getUserIdFromAuth(request);
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        const friends = await env.DB.prepare(
          `SELECT f.id as requestId, f.status, u.id as userId, u.username, u.avatar_url, u.status as userStatus
           FROM friends f
           JOIN users u ON (f.user_id = u.id OR f.friend_id = u.id)
           WHERE (f.user_id = ? OR f.friend_id = ?) AND u.id != ?`
        ).bind(userId, userId, userId).all();

        return jsonResponse({ friends: friends.results });
      }

      // -------------------------------------------------------------
      // MESSAGING & VOICE NOTES ROUTES
      // -------------------------------------------------------------
      if (url.pathname === "/api/messages" && request.method === "GET") {
        const userId = getUserIdFromAuth(request);
        const friendId = url.searchParams.get("friendId");
        if (!userId || !friendId) return jsonResponse({ error: "Invalid query" }, 400);

        const msgs = await env.DB.prepare(
          `SELECT * FROM messages 
           WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
           ORDER BY created_at ASC`
        ).bind(userId, friendId, friendId, userId).all();

        return jsonResponse({ messages: msgs.results });
      }

      if (url.pathname === "/api/messages/send" && request.method === "POST") {
        const userId = getUserIdFromAuth(request);
        const { receiverId, type, content, mediaUrl } = await request.json<any>();
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        const msgId = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO messages (id, sender_id, receiver_id, type, content, media_url) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(msgId, userId, receiverId, type, content || "", mediaUrl || null).run();

        return jsonResponse({ success: true, messageId: msgId });
      }

      // -------------------------------------------------------------
      // INSTAGRAM-STYLE STORIES ROUTES
      // -------------------------------------------------------------
      if (url.pathname === "/api/stories" && request.method === "GET") {
        const userId = getUserIdFromAuth(request);
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        const now = new Date().toISOString();
        const activeStories = await env.DB.prepare(
          `SELECT s.*, u.username, u.avatar_url 
           FROM stories s
           JOIN users u ON s.user_id = u.id
           WHERE s.expires_at > ?
           ORDER BY s.created_at ASC`
        ).bind(now).all();

        // Group by user
        const grouped: Record<string, any> = {};
        for (const story of activeStories.results as any[]) {
          if (!grouped[story.user_id]) {
            grouped[story.user_id] = {
              userId: story.user_id,
              username: story.username,
              avatarUrl: story.avatar_url,
              items: [],
            };
          }
          grouped[story.user_id].items.push(story);
        }

        return jsonResponse({ stories: Object.values(grouped) });
      }

      if (url.pathname === "/api/stories/create" && request.method === "POST") {
        const userId = getUserIdFromAuth(request);
        const { mediaUrl, mediaType } = await request.json<any>();
        if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

        const storyId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 Hours

        await env.DB.prepare(
          "INSERT INTO stories (id, user_id, media_url, media_type, expires_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(storyId, userId, mediaUrl, mediaType, expiresAt).run();

        return jsonResponse({ success: true, storyId });
      }

      // Serve Frontend Assets
      return env.ASSETS.fetch(request);
    } catch (err: any) {
      return jsonResponse({ error: err.message || "Internal Server Error" }, 500);
    }
  },
};