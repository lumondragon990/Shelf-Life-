// api/book.js — v2: fetches a public-domain book's text from Project Gutenberg,
// trying multiple official sources/mirrors (some block cloud-server requests).
// Replaces the previous version at: shelf-life-pwa/api/book.js

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  if (!/^\d{1,7}$/.test(id)) {
    return res.status(400).json({ error: "Bad book id" });
  }

  const headers = {
    "User-Agent": "ShelfLifeReader/1.0 (educational reading app; contact via site)",
    "Accept": "text/plain,*/*",
  };

  // Try these sources in order until one gives us the book
  const sources = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://gutenberg.pglaf.org/files/${id}/${id}-0.txt`,
  ];

  const attempts = [];
  let text = null;

  for (const url of sources) {
    try {
      const r = await fetch(url, { headers, redirect: "follow" });
      if (!r.ok) { attempts.push(`${url} -> HTTP ${r.status}`); continue; }
      const body = await r.text();
      if (body && body.length > 500) { text = body; break; }
      attempts.push(`${url} -> too short`);
    } catch (e) {
      attempts.push(`${url} -> ${String(e && e.message ? e.message : e)}`);
    }
  }

  // Last resort: ask Gutendex for whatever text URL it knows about
  if (!text) {
    try {
      const meta = await fetch(`https://gutendex.com/books/${id}`, { headers }).then((r) => r.json());
      const formats = meta.formats || {};
      const txtUrl =
        formats["text/plain; charset=utf-8"] ||
        formats["text/plain; charset=us-ascii"] ||
        formats["text/plain; charset=iso-8859-1"] ||
        formats["text/plain"];
      if (txtUrl) {
        const r = await fetch(txtUrl, { headers, redirect: "follow" });
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

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
  return res.status(200).json({ id, text: text.trim() });
}
