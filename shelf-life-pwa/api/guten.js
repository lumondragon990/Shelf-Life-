// api/guten.js — v2: proxies Project Gutenberg catalogue searches through the
// server, so networks that block gutendex.com (school filters, ad-blockers,
// privacy browsers) still get free-book results.
// v2 changes: forwards page= so genre browsing can dig deeper ("Load more
// free books"), allows language-only browsing (En español shelf), and adds
// a timeout so a slow catalogue can't hang the function.
// Replaces: shelf-life-pwa/api/guten.js

export default async function handler(req, res) {
  const q = String(req.query.q || "").slice(0, 200);
  const topic = String(req.query.topic || "").slice(0, 60);
  const langs = req.query.languages === "es" ? "es" : "en,es";
  const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), 100);
  // Language-only browsing (the En español shelf) is a valid request now
  if (!q && !topic && req.query.languages !== "es") {
    return res.status(400).json({ error: "Missing q" });
  }

  const params = new URLSearchParams();
  if (q) params.set("search", q);
  if (topic) params.set("topic", topic);
  params.set("languages", langs);
  if (page > 1) params.set("page", String(page));

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://gutendex.com/books?${params.toString()}`, {
      headers: { "User-Agent": "ShelfLifeReader/1.0 (educational reading app)" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return res.status(502).json({ error: "Catalogue unavailable", status: r.status });
    const d = await r.json();
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    return res.status(200).json(d);
  } catch (e) {
    console.error("guten proxy failed", e);
    return res.status(502).json({ error: "Catalogue unreachable" });
  }
}
