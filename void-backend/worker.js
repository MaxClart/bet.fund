export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const corsHeaders = { "Access-Control-Allow-Origin": "*" };

    try {
      // --- REGISTER / LOGIN ROUTE ---
      if (url.pathname === "/api/auth" && request.method === "POST") {
        const { action, username, password, profile } = await request.json();
        const handle = username.toLowerCase().replace(/[^a-z0-9_]/g, "");

        if (action === "register") {
          const existing = await env.DB.prepare("SELECT * FROM users WHERE handle = ?").bind(handle).first();
          if (existing) {
            return new Response(JSON.stringify({ error: "User already exists" }), { status: 400, headers: corsHeaders });
          }
          await env.DB.prepare("INSERT INTO users (handle, password, profile) VALUES (?, ?, ?)").bind(
            handle, password, JSON.stringify(profile || {})
          ).run();
          return new Response(JSON.stringify({ success: true, handle, profile }), { headers: corsHeaders });
        } 

        if (action === "login") {
          const user = await env.DB.prepare("SELECT * FROM users WHERE handle = ?").bind(handle).first();
          if (!user || user.password !== password) {
            return new Response(JSON.stringify({ error: "Invalid username or password" }), { status: 401, headers: corsHeaders });
          }
          return new Response(JSON.stringify({ success: true, handle, profile: JSON.parse(user.profile) }), { headers: corsHeaders });
        }
      }

      // --- SAVE PROFILE ROUTE ---
      if (url.pathname === "/api/profile" && request.method === "POST") {
        const { handle, profile } = await request.json();
        await env.DB.prepare("UPDATE users SET profile = ? WHERE handle = ?").bind(
          JSON.stringify(profile), handle
        ).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // --- UPLOAD IMAGE TO R2 ROUTE ---
      if (url.pathname.startsWith("/api/upload/") && request.method === "PUT") {
        const key = url.pathname.replace("/api/upload/", "");
        await env.R2_BUCKET.put(key, request.body);
        const publicUrl = `https://pub-YOUR_R2_PUBLIC_DOMAIN.r2.dev/${key}`; // Replace with your R2 public bucket URL
        return new Response(JSON.stringify({ success: true, url: publicUrl }), { headers: corsHeaders });
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};