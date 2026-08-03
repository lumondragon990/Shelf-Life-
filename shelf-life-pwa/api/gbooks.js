// api/gbooks.js — v2: proxies Google Books searches through the server, so
// ad-blockers, privacy browsers, and network filters on the reader's device
// can't break fresh releases or book summaries.
// v2 change: forwards startIndex so subject browsing can page deep into
// Google's catalog ("Load more books").
// Replaces: shelf-life-pwa/api/gbooks.js

export default async function handler(req, res) {
  const q = String(req.query.q || "").slice(0, 200);
  if (!q) return res.status(400).json({ error: "Missing q" });

  const params = new URLSearchParams({ q, maxResults: String(Math.min(parseInt(req.query.maxResults) || 12, 40)) });
  if (req.query.orderBy === "newest") params.set("orderBy", "newest");
  if (/^[a-z]{2}$/.test(req.query.langRestrict || "")) params.set("langRestrict", req.query.langRestrict);
  const start = parseInt(req.query.startIndex) || 0;
  if (start > 0 && start <= 960) params.set("startIndex", String(start)); // Google caps paging around 1000
  params.set("country", "US"); // avoids Google's regional 403s

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const d = await r.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(d);
  } catch (e) {
    console.error("gbooks proxy failed", e);
    return res.status(502).json({ error: "Book service unreachable" });
  }
}
