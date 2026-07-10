// api/claude.js — Vercel serverless function.
// The app never talks to Anthropic directly (that would expose your API key in
// the browser). It POSTs here, and this function forwards the request with the
// key from an environment variable.
//
// Setup: Vercel -> Project -> Settings -> Environment Variables:
//   ANTHROPIC_API_KEY = sk-ant-...   (get one at console.anthropic.com)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: "AI features not configured yet — add ANTHROPIC_API_KEY in Vercel env vars.",
    });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: req.body?.model || "claude-haiku-4-5",
        max_tokens: Math.min(req.body?.max_tokens || 1000, 2000),
        messages: req.body?.messages || [],
      }),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Upstream request failed" });
  }
}
