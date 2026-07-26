// api/claude.js — hardened AI proxy.
// Threat this closes: without these checks, ANYONE on the internet could POST
// here and spend your Anthropic credits, or use your key as a free Claude API.

const WINDOW_MS = 60 * 60 * 1000;      // 1 hour
const MAX_PER_WINDOW = 80;             // requests per IP per hour
const MAX_CHARS = 9000;                // total prompt characters
const ALLOWED_MODELS = new Set(["claude-haiku-4-5", "claude-sonnet-4-6"]);
const hits = new Map();                // per-instance memory

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    if (hits.size > 5000) hits.clear();  // don't grow forever
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

function sameSite(req) {
  const host = req.headers.host || "";
  const src = req.headers.origin || req.headers.referer || "";
  if (!src) return false;                       // no origin = not a browser on our page
  try {
    const h = new URL(src).host;
    if (h === host) return true;
    if (h.startsWith("localhost") || h.startsWith("127.0.0.1")) return true;
    const extra = (process.env.ALLOWED_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean);
    return extra.includes(h);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // 1) Only our own pages may call this
  if (!sameSite(req)) return res.status(403).json({ error: "Forbidden" });

  // 2) Per-IP throttle
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "Slow down a moment — try again shortly." });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "AI features not configured yet — add ANTHROPIC_API_KEY in Vercel env vars." });
  }

  // 3) Validate the payload instead of forwarding whatever arrives
  const msgs = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!msgs.length || msgs.length > 6) return res.status(400).json({ error: "Bad request" });
  const chars = msgs.reduce((a, m) => a + String(m?.content || "").length, 0);
  if (chars > MAX_CHARS) return res.status(413).json({ error: "That request is too long." });

  const model = ALLOWED_MODELS.has(req.body?.model) ? req.body.model : "claude-haiku-4-5";
  const max_tokens = Math.min(Math.max(parseInt(req.body?.max_tokens) || 800, 50), 1200);

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages: msgs.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content || "").slice(0, MAX_CHARS),
        })),
      }),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(500).json({ error: "Upstream request failed" });
  }
}
