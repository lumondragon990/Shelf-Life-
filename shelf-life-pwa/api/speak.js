// api/speak.js — premium narration for the reader.
//
// WHY IT'S A GET WITH gid+page: the response can then be cached by Vercel's CDN
// for a year. Page 3 of A Christmas Carol is identical for every reader on earth,
// so you pay the text-to-speech provider ONCE per page, ever. The second student
// — and the two hundredth — get it free and instantly.
//
// Vercel -> Settings -> Environment Variables:
//   OPENAI_API_KEY   = sk-...            (provider key; nothing else needed)
//   TTS_VOICE_F      = shimmer           (optional, default shown)
//   TTS_VOICE_M      = onyx              (optional, default shown)
//
// If OPENAI_API_KEY is absent the endpoint returns 503 and the app silently
// falls back to the device's built-in voice, exactly as it does today.

const PAGE_CHARS = 1600;   // must match the reader's pagination
const MAX_CHARS = 4000;    // safety cap per request

function paginate(text) {
  const pages = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + PAGE_CHARS, text.length);
    if (end < text.length) {
      const brk = text.lastIndexOf("\n", end);
      const sp = text.lastIndexOf(" ", end);
      end = Math.max(brk, sp) > i + 800 ? Math.max(brk, sp) : end;
    }
    pages.push(text.slice(i, end));
    i = end;
  }
  return pages.length ? pages : [text];
}

async function gutenbergText(id) {
  const headers = { "User-Agent": "ShelfLifeReader/1.0 (educational reading app)" };
  const sources = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  ];
  for (const url of sources) {
    try {
      const r = await fetch(url, { headers, redirect: "follow" });
      if (!r.ok) continue;
      let text = await r.text();
      if (!text || text.length < 500) continue;
      const start = text.indexOf("*** START OF");
      if (start !== -1) {
        const nl = text.indexOf("\n", start);
        if (nl !== -1) text = text.slice(nl + 1);
      }
      const end = text.indexOf("*** END OF");
      if (end !== -1) text = text.slice(0, end);
      return text.trim();
    } catch { /* next source */ }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "GET or POST" });
  }

  const host = req.headers.host || "";
  const src = req.headers.origin || req.headers.referer || "";
  if (src) {
    try {
      const h = new URL(src).host;
      const extra = (process.env.ALLOWED_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean);
      const ok = h === host || h.startsWith("localhost") || h.startsWith("127.0.0.1") || extra.includes(h);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    } catch { return res.status(403).json({ error: "Forbidden" }); }
  }

  // Lightweight availability check the app calls once on load
  if (req.query.check) {
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
    return res.status(200).json({ available: Boolean(process.env.OPENAI_API_KEY) });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "Premium voice not configured" });
  }

  const voice = (req.query.voice || req.body?.voice) === "m"
    ? (process.env.TTS_VOICE_M || "onyx")
    : (process.env.TTS_VOICE_F || "shimmer");

  try {
    let text = "";
    let cacheable = true;

    if (req.query.word) {
      // A single word — the most cacheable thing in the app. The same few
      // thousand words are tapped over and over by every reader.
      const w = String(req.query.word).slice(0, 40).replace(/[^\p{L}\p{M}'-]/gu, "");
      if (!w) return res.status(400).json({ error: "Bad word" });
      text = w;
    } else if (req.query.gid !== undefined) {
      const gid = String(req.query.gid || "");
      const page = parseInt(req.query.page);
      if (!/^\d{1,7}$/.test(gid) || !Number.isInteger(page) || page < 0 || page > 4000) {
        return res.status(400).json({ error: "Bad gid or page" });
      }
      const full = await gutenbergText(gid);
      if (!full) return res.status(404).json({ error: "Book text unavailable" });
      const pages = paginate(full);
      if (page >= pages.length) return res.status(404).json({ error: "No such page" });
      text = pages[page].replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
    } else if (req.method === "POST" && req.body?.text) {
      // Arbitrary text: a pasted class reading, a paragraph, a definition.
      // Can't be CDN-cached, so it is capped tighter.
      text = String(req.body.text).replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
      cacheable = false;
    } else {
      return res.status(400).json({ error: "Provide word, gid+page, or POST text" });
    }

    if (!text) return res.status(404).json({ error: "Nothing to read" });

    const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "tts-1", voice, input: text, response_format: "mp3", speed: 0.95 }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("tts failed", upstream.status, detail.slice(0, 200));
      return res.status(502).json({ error: "Narration failed", status: upstream.status });
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    // Cache hard: this page's audio never changes.
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", cacheable
      ? "public, max-age=3600, s-maxage=31536000, immutable"
      : "public, max-age=600, s-maxage=86400");
    res.setHeader("Content-Length", String(audio.length));
    return res.status(200).send(audio);
  } catch (e) {
    console.error("speak error", e);
    return res.status(500).json({ error: "Narration error" });
  }
}
