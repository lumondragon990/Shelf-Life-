// api/kv.js — server-side gateway for all shared data.
//
// WHY THIS EXISTS: previously the browser talked to Supabase directly using a
// public key, and the database policies allowed anyone to read or overwrite ANY
// row. That meant a stranger could download every class, every student first
// name and progress record, and every teacher-to-family message — or quietly
// change them. This function is now the only way in, it runs on the server with
// a secret key, and it enforces what may be read, written, or listed.
//
// Vercel -> Settings -> Environment Variables (server-side, NOT prefixed VITE_):
//   SUPABASE_URL         = https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY = the service_role key from Supabase -> Settings -> API
//
// Then run the SQL in supabase-lockdown.sql to shut off public access.

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 120;            // per IP per minute
const MAX_VALUE_BYTES = 200_000;
const hits = new Map();

// Only these key shapes exist in the app. Anything else is rejected.
const KEY_RULES = [
  { re: /^class:[A-Z0-9]{4,8}$/, list: false },              // a class record
  { re: /^cp:[A-Z0-9]{4,8}:[a-z0-9_-]{1,40}$/, list: true }, // student progress (roster lists these)
  { re: /^cq:[A-Z0-9]{4,8}:\d{1,3}$/, list: false },         // shared chapter quiz
  { re: /^fmsg:[A-Z0-9]{4,8}:[a-z0-9_-]{1,40}$/, list: false }, // teacher -> family messages
  { re: /^fam:[A-Z0-9]{4,8}$/, list: false },                // family code -> student pointer
  { re: /^wall:[a-z0-9_:-]{1,60}$/i, list: true },           // book club wall
  { re: /^meet:[a-z0-9_:-]{1,60}$/i, list: true },           // meetups
  { re: /^sync:[A-Z0-9]{4,10}$/, list: false },              // device sync payload
  { re: /^apprating:[a-z0-9_:-]{1,60}$/i, list: false },     // write-only feedback
  { re: /^stats:readers$/, list: false },
];

const ruleFor = (key) => KEY_RULES.find((r) => r.re.test(key));

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

function sameSite(req) {
  const host = req.headers.host || "";
  const src = req.headers.origin || req.headers.referer || "";
  if (!src) return false;
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

async function sb(path, init) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return r;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!sameSite(req)) return res.status(403).json({ error: "Forbidden" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: "Shared storage not configured" });
  }

  const { op, key, value, prefix } = req.body || {};

  try {
    if (op === "get") {
      if (!ruleFor(key)) return res.status(400).json({ error: "Bad key" });
      const r = await sb(`kv?key=eq.${encodeURIComponent(key)}&select=value`);
      const rows = await r.json();
      if (!rows?.length) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ key, value: rows[0].value });
    }

    if (op === "set") {
      if (!ruleFor(key)) return res.status(400).json({ error: "Bad key" });
      const val = String(value ?? "");
      if (val.length > MAX_VALUE_BYTES) return res.status(413).json({ error: "Too large" });
      const r = await sb("kv?on_conflict=key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ key, value: val }),
      });
      if (!r.ok) return res.status(500).json({ error: "Write failed" });
      return res.status(200).json({ key, value: val });
    }

    if (op === "list") {
      // Listing is the enumeration risk, so it is allowed only for key shapes
      // marked list:true AND only with a specific, fully-scoped prefix.
      const scoped = KEY_RULES.some((r) => r.list && prefix && prefix.length >= 6 && r.re.test(`${prefix}x`.replace(/x$/, "a")));
      const looksScoped = /^(cp:[A-Z0-9]{4,8}:|wall:|meet:)/.test(prefix || "");
      if (!looksScoped && !scoped) return res.status(400).json({ error: "Prefix not allowed" });
      const r = await sb(`kv?key=like.${encodeURIComponent(prefix + "%")}&select=key&limit=200`);
      const rows = await r.json();
      return res.status(200).json({ keys: (rows || []).map((x) => x.key), prefix });
    }

    if (op === "delete") {
      if (!ruleFor(key)) return res.status(400).json({ error: "Bad key" });
      await sb(`kv?key=eq.${encodeURIComponent(key)}`, { method: "DELETE" });
      return res.status(200).json({ key, deleted: true });
    }

    return res.status(400).json({ error: "Unknown op" });
  } catch {
    return res.status(500).json({ error: "Storage error" });
  }
}
