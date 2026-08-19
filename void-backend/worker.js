export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/save" && request.method === "POST") {
      try {
        const data = await request.json();
        await env.DB.prepare(
          `INSERT INTO profiles (handle, name, status, bio, avatar, banner, data) 
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(handle) DO UPDATE SET 
           name=?2, status=?3, bio=?4, avatar=?5, banner=?6, data=?7`
        ).bind(
          data.handle, data.name, data.status, data.bio, 
          data.avatar.url, data.banner.url, JSON.stringify(data)
        ).run();

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/profile" && request.method === "GET") {
      const handle = url.searchParams.get("handle");
      const { results } = await env.DB.prepare("SELECT data FROM profiles WHERE handle = ?").bind(handle).all();
      
      if (results.length === 0) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
      }

      return new Response(results[0].data, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response("Endpoint not found", { status: 404, headers: corsHeaders });
  }
};