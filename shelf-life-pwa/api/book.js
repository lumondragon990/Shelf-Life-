// api/book.js — v3: fetches a public-domain book's text from Project Gutenberg.
// v3 change: all mirrors are raced IN PARALLEL with per-request timeouts.
// The old version tried mirrors one at a time — when gutenberg.org hung or
// blocked our cloud IP, every book took 10-30s to open. Now the fastest
// healthy mirror wins, usually in 1-3s.
// Replaces: shelf-life-pwa/api/book.js

const FETCH_TIMEOUT_MS = 8000;

const fetchWithTimeout = (url, opts = {}) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal, redirect: "follow" })
    .finally(() => clearTimeout(t));
};

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  if (!/^\d{1,7}$/.test(id)) {
    return res.status(400).json({ error: "Bad book id" });
  }

  const headers = {
    "User-Agent": "ShelfLifeReader/1.0 (educational reading app; contact via site)",
    "Accept": "text/plain,*/*",
  };

  const sources = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://gutenberg.pglaf.org/files/${id}/${id}-0.txt`,
  ];

  const attempts = [];
  let text = null;

  // Race every mirror at once — first good response wins, slow ones are ignored
  const tryUrl = async (url) => {
    const r = await fetchWithTimeout(url, { headers });
    if (!r.ok) { attempts.push(`${url} -> HTTP ${r.status}`); throw new Error("bad"); }
    const body = await r.text();
    if (!body || body.length <= 500) { attempts.push(`${url} -> too short`); throw new Error("short"); }
    return body;
  };

  try {
    text = await Promise.any(sources.map(tryUrl));
  } catch { /* all mirrors failed — fall through to Gutendex */ }

  // Last resort: ask Gutendex for whatever text URL it knows about
  if (!text) {
    try {
      const meta = await fetchWithTimeout(`https://gutendex.com/books/${id}`, { headers }).then((r) => r.json());
      const formats = meta.formats || {};
      const txtUrl =
        formats["text/plain; charset=utf-8"] ||
        formats["text/plain; charset=us-ascii"] ||
        formats["text/plain; charset=iso-8859-1"] ||
        formats["text/plain"];
      if (txtUrl) {
        const r = await fetchWithTimeout(txtUrl, { headers });
        if (r.ok) {
          const body = await r.text();
          if (body && body.length > 500) text = body;
          else attempts.push(`${txtUrl} -> too short`);
        } else attempts.push(`${txtUrl} -> HTTP ${r.status}`);
      } else attempts.push("gutendex -> no plain-text format listed");
    } catch (e) {
      attempts.push(`gutendex -> ${String(e && e.message ? e.message : e)}`);
    }
  }

  if (!text) {
    console.error("book fetch failed:", attempts);
    return res.status(502).json({ error: "All book sources failed", detail: attempts });
  }

  // Trim Project Gutenberg's legal header/footer so the reader starts at the story
  const startMark = text.indexOf("*** START OF");
  if (startMark !== -1) {
    const afterStart = text.indexOf("\n", startMark);
    if (afterStart !== -1) text = text.slice(afterStart + 1);
  }
  const endMark = text.indexOf("*** END OF");
  if (endMark !== -1) text = text.slice(0, endMark);
  if (text.length > 1_800_000) text = text.slice(0, 1_800_000);

  // Cache aggressively at the CDN edge — the same book is served instantly
  // to every reader after the first request (immutable public-domain text).
  res.setHeader("Cache-Control", "public, s-maxage=2592000, stale-while-revalidate=86400");
  return res.status(200).json({ id, text: text.trim() });
}
