// src/worker.js
export default {
  async fetch(request) {
    const reqUrl = new URL(request.url);

    // Basic CORS so your GitHub Pages site can call this Worker.
    // Cloudflare provides common examples for adding CORS headers and handling OPTIONS. 
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };

    // Preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow GET /resolve
    if (request.method !== "GET" || reqUrl.pathname !== "/resolve") {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    // Read query param: ?url=<soundgasm page>
    const pageUrl = reqUrl.searchParams.get("url");
    if (!pageUrl) {
      return json({ error: "Missing url param. Use /resolve?url=<soundgasm-page-url>" }, 400, corsHeaders);
    }

    // Basic input sanity (optional, but helps reduce abuse)
    let parsed;
    try {
      parsed = new URL(pageUrl);
    } catch {
      return json({ error: "Invalid url param" }, 400, corsHeaders);
    }

    // Optional: restrict to soundgasm.net only
    // If you want the worker to ONLY resolve soundgasm.net links, keep this block enabled.
    if (!/(\.|^)soundgasm\.net$/i.test(parsed.hostname)) {
      return json({ error: "Only soundgasm.net URLs are allowed by this resolver." }, 403, corsHeaders);
    }

    // Fetch the Soundgasm page HTML server-side.
    // In Workers, fetch() must happen inside the request handler.
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SoundgasmResolver/1.0)",
        "Accept": "text/html"
      }
    });

    if (!res.ok) {
      return json(
        { error: "Failed to fetch page", status: res.status },
        502,
        corsHeaders
      );
    }

    const html = await res.text();

    // Title (best-effort)
    const titleMatch = html.match(/<title>\s*([^<]+)\s*<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    // Extract audio URL (best-effort).
    // We try multiple patterns to be more robust if Soundgasm changes its markup.
    const patterns = [
      // Any direct mp3/m4a/ogg URL in the HTML
      /https?:\/\/[^"' <>\n\r\t]+\.(?:mp3|m4a|ogg)(?:\?[^"' <>\n\r\t]*)?/i,

      // JSON-like: "url":"https://...mp3"
      /"url"\s*:\s*"([^"]+\.(?:mp3|m4a|ogg)[^"]*)"/i,

      // <audio src="...">
      /<audio[^>]+src="([^"]+)"/i
    ];

    let audioUrl = null;
    for (const p of patterns) {
      const m = html.match(p);
      if (m) {
        audioUrl = (m[1] || m[0])
          .replace(/\\u0026/g, "&")
          .replace(/\\\//g, "/");
        break;
      }
    }

    if (!audioUrl) {
      return json(
        { error: "Could not find an audio URL on that page." },
        422,
        corsHeaders
      );
    }

    return json({ audioUrl, title }, 200, corsHeaders);
  }
};

function json(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
