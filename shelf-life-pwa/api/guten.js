// api/guten.js — proxies Project Gutenberg catalogue searches through the server.
// WHY: the browser was calling gutendex.com directly, and on networks that block
// it (school filters, ad-blockers, privacy browsers) the request failed silently
// and no "free to read" badges ever appeared.
// NEW FILE: goes in shelf-life-pwa/api/ next to book.js, claude.js, gbooks.js, kv.js

export default async function handler(req, res) {
  const q = String(req.query.q || "").slice(0, 200);
  const topic = String(req.query.topic || "").slice(0, 60);
  if (!q && !topic) return res.status(400).json({ error: "Missing q" });

  const params = new URLSearchParams();
  if (q) params.set("search", q);
  if (topic) params.set("topic", topic);
  params.set("languages", req.query.languages === "es" ? "es" : "en,es");

  try {
    const r = await fetch(`https://gutendex.com/books?${params.toString()}`, {
      headers: { "User-Agent": "ShelfLifeReader/1.0 (educational reading app)" },
    });
    if (!r.ok) return res.status(502).json({ error: "Catalogue unavailable", status: r.status });
    const d = await r.json();
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    return res.status(200).json(d);
  } catch (e) {
    console.error("guten proxy failed", e);
    return res.status(502).json({ error: "Catalogue unreachable" });
  }
}
