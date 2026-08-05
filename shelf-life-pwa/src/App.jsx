import { useState, useEffect, useMemo, useRef } from "react";
import { storage, sharedIsLive } from "./storage";
import InstallPrompt from "./InstallPrompt";

// ---------- Design tokens: "library card catalog" ----------
// Paper: manila card stock. Ink: blue-black fountain ink. Stamp: date-stamp red.
const T = {
  paper: "#F4EEDD",
  card: "#FCF9F0",
  ink: "#22334D",
  inkSoft: "#5A6B85",
  rule: "#C3CFE0",
  stamp: "#C24632",
  blue: "#2B5EA7",
  green: "#3E7C59",
  gold: "#D9A03F",
  // Elevation: card stock lifting off a desk, not a drop-shadow default
  lift1: "0 1px 2px rgba(34,51,77,0.06), 0 2px 6px rgba(34,51,77,0.05)",
  lift2: "0 2px 4px rgba(34,51,77,0.07), 0 8px 18px rgba(34,51,77,0.08)",
  lift3: "0 6px 14px rgba(34,51,77,0.10), 0 18px 40px rgba(34,51,77,0.12)",
};
const SPINES = ["#2B5EA7", "#C24632", "#3E7C59", "#D9A03F", "#7C5CB0", "#B85C8A", "#4A8C9E"];

// ---------- Grade levels: one app, very different classrooms ----------
const GRADES = {
  prek: {
    label: "Pre-K (ages 3–4)", short: "Pre-K",
    unit: "read-together", units: "read-togethers", Unit: "Read-together",
    // Pre-K best practice is no traditional homework — everything is a shared activity
    homeworkFor: "family",
    hwKinds: {
      readtogether: "a short read-together activity a grown-up does WITH the child",
      letters: "a playful letter-and-sound hunt around the house",
      talk: "two simple talk-about-it questions to ask after reading",
    },
    ai: "The child is 3–4 years old and CANNOT read independently. They are read TO. Never ask them to read or write. Address the grown-up. Activities must take under 10 minutes, use only things found at home, and feel like play. Use very simple words.",
    quizAi: "Ask 3 spoken listening questions a grown-up reads aloud to a 3–4 year old about a story they just heard. One sentence each, concrete, about what happened or how someone felt.",
    wordAi: "Explain this word to a 3-4 year old in one very short sentence using tiny words.",
  },
  k2: {
    label: "Kindergarten – 2nd grade", short: "K–2",
    unit: "book", units: "books", Unit: "Book",
    homeworkFor: "both",
    hwKinds: {
      readtogether: "a short read-together activity with a grown-up, plus one thing the child does",
      sight: "sight-word and letter-sound practice using words from the book",
      comprehension: "3 very simple 'what happened' questions",
      draw: "a draw-and-tell prompt about the story",
    },
    ai: "The reader is 5–8 years old and is just learning to read. Keep every sentence under 12 words. Use only common words. Questions should be concrete — what happened, who did it, how did they feel — never abstract. A grown-up may be reading the questions aloud.",
    quizAi: "Ask 3 very simple questions for a 5–8 year old about what happened in the story. Short sentences, concrete answers, friendly tone.",
    wordAi: "Explain this word to a 6 year old in one short, simple sentence.",
  },
  g35: {
    label: "3rd – 5th grade", short: "3–5",
    unit: "chapter", units: "chapters", Unit: "Chapter",
    homeworkFor: "student",
    hwKinds: {
      comprehension: "what happened and why questions",
      vocabulary: "vocabulary from this part of the book",
      response: "short written response prompts asking them to think, predict or connect",
      mixed: "a mix of comprehension, vocabulary and one written response",
    },
    ai: "The reader is 8–11 years old. Friendly and clear. Mix recall with one 'why do you think' question. Keep written answers to a few sentences.",
    quizAi: "Ask 3 friendly comprehension questions for an 8–11 year old about this chapter.",
    wordAi: "Explain this word simply for a beginner reader in one sentence.",
  },
  g68: {
    label: "6th – 8th grade", short: "6–8",
    unit: "chapter", units: "chapters", Unit: "Chapter",
    homeworkFor: "student",
    hwKinds: {
      comprehension: "comprehension and inference questions",
      vocabulary: "vocabulary in context from this part of the book",
      response: "written response prompts asking for an opinion backed by a reason",
      evidence: "questions that require quoting or pointing to specific evidence from the text",
      mixed: "a mix of comprehension, vocabulary, inference and one written response",
    },
    ai: "The reader is 11–14 years old. Do not talk down to them. Include inference and character motivation, not just recall. Ask them to support answers with something from the text.",
    quizAi: "Ask 3 questions for a middle schooler about this chapter — at least one requiring inference, not just recall.",
    wordAi: "Define this word clearly in one sentence for a middle school reader.",
  },
  g912: {
    label: "9th – 12th grade", short: "9–12",
    unit: "chapter", units: "chapters", Unit: "Chapter",
    homeworkFor: "student",
    hwKinds: {
      analysis: "literary analysis — theme, character development, author's craft",
      evidence: "text-evidence questions requiring a quotation and an explanation",
      argument: "an argumentative prompt taking a position about the text",
      vocabulary: "advanced vocabulary in context",
      mixed: "a mix of analysis, text evidence and one argumentative prompt",
    },
    ai: "The reader is a high school student. Write at a genuinely high school level — theme, symbolism, author's craft, narrative choices, historical context. Expect answers of a paragraph or more with textual evidence. Never patronize.",
    quizAi: "Ask 3 high-school-level questions about this chapter covering theme, character motivation or author's craft — not plot recall.",
    wordAi: "Define this word precisely in one sentence for a high school reader, noting connotation if it matters.",
  },
  adult: {
    label: "Adult learners / ESL", short: "Adult",
    unit: "section", units: "sections", Unit: "Section",
    homeworkFor: "student",
    hwKinds: {
      comprehension: "clear comprehension questions",
      vocabulary: "practical everyday vocabulary from the text",
      response: "short written response connecting the reading to their own experience",
      mixed: "a mix of comprehension, vocabulary and a short written response",
    },
    ai: "The reader is an adult who is building reading confidence, possibly in a second language. Respect their intelligence completely — simple language, never childish content or tone. Everyday vocabulary. Connect to real life.",
    quizAi: "Ask 3 clear, respectful comprehension questions for an adult learner building reading confidence. Simple language, adult subject matter.",
    wordAi: "Define this word in one clear sentence for an adult learning English, with a practical example if it helps.",
  },
};
const lvl = (c) => GRADES[c?.level] || GRADES.g35;

// ---------- Browse by subject: broad coverage, not just novels ----------
// Each entry: [label, Google Books query, Gutenberg topic for the free shelf]
const SUBJECTS = [
  ["🚀 Sci-fi & fantasy", 'subject:"science fiction" OR subject:"fantasy"', "Science fiction"],
  ["🔍 Mystery", 'subject:"detective and mystery stories"', "Detective and mystery stories"],
  ["💛 Romance", 'subject:"romance"', "Love stories"],
  ["📜 History", 'subject:"history"', "History"],
  ["🔬 Science", 'subject:"science"', "Science"],
  ["🧠 Philosophy", 'subject:"philosophy"', "Philosophy"],
  ["🎭 Poetry & drama", 'subject:"poetry" OR subject:"drama"', "Poetry"],
  ["🧒 Kids & young readers", 'subject:"juvenile fiction"', "Children's literature"],
  ["🇲🇽 En español", 'subject:"fiction"', "Spanish"],
  ["💪 Biography", 'subject:"biography"', "Biography"],
  ["🧰 Self-help", 'subject:"self-help"', "Conduct of life"],
  ["✝️ Faith & theology", 'subject:"religion" OR subject:"theology"', "Christianity"],
  ["📖 Bible & study", 'subject:"bible" OR intitle:"bible study"', "Bible"],
  ["🕊️ Christian living", 'subject:"christian life" OR subject:"devotional"', "Christian life"],
  ["⛪ Church history", 'subject:"church history"', "Church history"],
  ["🌍 World religions", 'subject:"religions" OR subject:"islam" OR subject:"judaism" OR subject:"buddhism"', "Religion"],
];

// ---------- The shelf: the one place the app is allowed to show off ----------
// Spines get cylindrical lighting, a visible page block, a deterministic lean,
// and a contact shadow on a wooden board. Everything else in the app stays flat
// so this reads as the signature.
function Spine({ book, onClick }) {
  const seed = (book.title || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const h = 74 + (seed % 34);                 // height varies like real books
  const w = 22 + ((seed * 3) % 16);           // thickness varies
  const lean = ((seed % 5) - 2) * 0.5;        // -1deg .. +1deg, stable per title
  const base = spineColor(book.title);
  const done = book.status === "done";
  const want = book.status === "want";
  return (
    <button
      className="sl-spine"
      onClick={onClick}
      title={`${book.title}${book.author ? " — " + book.author : ""}`}
      style={{
        width: w, height: h, flex: "0 0 auto", position: "relative", cursor: "pointer",
        border: "none", padding: 0, borderRadius: "2px 3px 0 0",
        background: base,
        // cylindrical lighting: dark gutter edge, lit belly, shaded outer edge
        backgroundImage:
          "linear-gradient(100deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.10) 9%, rgba(255,255,255,0.20) 42%, rgba(255,255,255,0.05) 62%, rgba(0,0,0,0.16) 86%, rgba(0,0,0,0.30) 100%)",
        transform: `rotate(${lean}deg)`,
        transformOrigin: "bottom center",
        opacity: want ? 0.55 : 1,
        filter: want ? "saturate(0.7)" : "none",
        boxShadow: `inset 0 2px 0 rgba(255,255,255,0.22), 2px 6px 8px -4px rgba(34,51,77,0.45)`,
        overflow: "hidden",
      }}>
      {/* page block: the cream edge of the paper showing past the cover */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 2, right: 0, bottom: 0, width: 3,
        background: "linear-gradient(90deg, rgba(0,0,0,0.18), #EFE7D4 60%, #D8CDB4)",
      }} />
      {/* head and tail bands, like a bound hardback */}
      <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 3, top: 6, height: 2, background: "rgba(255,255,255,0.30)" }} />
      <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 3, bottom: 5, height: 2, background: "rgba(255,255,255,0.22)" }} />
      {/* spine title, set vertically as on a real book */}
      {w >= 26 && (
        <span style={{
          position: "absolute", inset: "10px 5px 9px 2px",
          writingMode: "vertical-rl", textOrientation: "mixed",
          fontFamily: "'Fraunces', serif", fontWeight: 700,
          fontSize: Math.min(11, w * 0.42), lineHeight: 1,
          color: "rgba(255,255,255,0.92)", textShadow: "0 1px 1px rgba(0,0,0,0.35)",
          overflow: "hidden", whiteSpace: "nowrap", textAlign: "left",
        }}>
          {book.title}
        </span>
      )}
      {done && (
        <span aria-hidden="true" title="finished" style={{
          position: "absolute", left: "50%", bottom: 4, transform: "translateX(-50%)",
          width: 6, height: 6, borderRadius: "50%", background: "#F4EEDD",
          boxShadow: "0 0 0 1.5px rgba(0,0,0,0.25)",
        }} />
      )}
    </button>
  );
}

function Shelf({ books, onPick }) {
  if (!books.length) return null;
  return (
    <div style={{ padding: "6px 0 0" }}>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 3,
        padding: "0 14px", minHeight: 112, overflowX: "auto",
      }}>
        {books.map((b) => <Spine key={b.id} book={b} onClick={() => onPick && onPick(b)} />)}
      </div>
      {/* the board: quarter-sawn oak, a front lip, and the shadow it casts */}
      <div aria-hidden="true" style={{
        height: 13, borderRadius: "2px 2px 4px 4px",
        background:
          "repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0 2px, rgba(255,255,255,0.03) 2px 7px), " +
          "linear-gradient(180deg, #A5825A 0%, #8A6B45 42%, #6E5334 100%)",
        boxShadow: "0 3px 0 #5C452B, 0 10px 16px -6px rgba(34,51,77,0.45)",
      }} />
    </div>
  );
}

// ---------- Brand mark: open book with a sprout ----------
function Mark({ size = 64, light = false }) {
  const ink = light ? "#FCF9F0" : "#22334D";
  const page = light ? "#2E4160" : "#FCF9F0";
  const line = light ? "#7C90AE" : "#9FB0C6";
  const leaf1 = light ? "#5FBF8B" : "#3E7C59";
  const leaf2 = light ? "#8ED9AC" : "#5C9E77";
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" style={{ display: "block" }}>
      <path d="M256 168 C 214 138, 150 126, 92 130 C 82 130.6, 76 137, 76 146 L 76 372 C 76 381, 83 388, 92 387 C 148 383, 213 393, 256 420 Z" fill={page} stroke={ink} strokeWidth="22" strokeLinejoin="round" />
      <path d="M256 168 C 298 138, 362 126, 420 130 C 430 130.6, 436 137, 436 146 L 436 372 C 436 381, 429 388, 420 387 C 364 383, 299 393, 256 420 Z" fill={page} stroke={ink} strokeWidth="22" strokeLinejoin="round" />
      <g stroke={line} strokeWidth="14" strokeLinecap="round">
        <line x1="124" y1="212" x2="212" y2="222" /><line x1="124" y1="258" x2="206" y2="266" /><line x1="124" y1="304" x2="212" y2="312" />
        <line x1="300" y1="222" x2="388" y2="212" /><line x1="306" y1="266" x2="388" y2="258" /><line x1="300" y1="312" x2="388" y2="304" />
      </g>
      <path d="M256 168 L256 420" stroke={ink} strokeWidth="22" strokeLinecap="round" />
      <path d="M256 170 C 256 140, 256 118, 256 96" stroke={leaf1} strokeWidth="20" strokeLinecap="round" fill="none" />
      <path d="M256 128 C 224 128, 200 110, 194 80 C 228 74, 250 94, 256 128 Z" fill={leaf1} />
      <path d="M256 112 C 288 112, 314 92, 320 60 C 284 54, 260 76, 256 112 Z" fill={leaf2} />
    </svg>
  );
}

const spineColor = (title) => {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return SPINES[h % SPINES.length];
};

// Project Gutenberg keeps a scanned cover for almost every book at this address
const gutenCover = (gid) => `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}.cover.medium.jpg`;

// ---------- Book cover that never shows up blank ----------
// Cover URLs fail quietly all the time: Open Library serves a 1×1 blank gif
// for missing covers, Google thumbnails 404, older Gutenberg scans have none.
// This tries the real cover and swaps in the colored-spine placeholder the
// instant the image errors OR arrives as a blank pixel — no more empty boxes.
function CoverThumb({ src, title, w = 52, h = 76, center = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const common = { width: w, height: h, borderRadius: 4, flexShrink: 0, margin: center ? "0 auto" : undefined };
  if (!src || failed) {
    return <div style={{ ...common, background: spineColor(title || "book"), boxShadow: "inset -4px 0 rgba(0,0,0,0.18)" }} />;
  }
  return (
    <img
      src={src} alt="" loading="lazy"
      onError={() => setFailed(true)}
      onLoad={(e) => { if (e.currentTarget.naturalWidth <= 2 || e.currentTarget.naturalHeight <= 2) setFailed(true); }}
      style={{ ...common, objectFit: "cover", display: center ? "block" : undefined, boxShadow: "1px 2px 5px rgba(34,51,77,0.25)" }}
    />
  );
}

// ---------- Curated picks for new readers ----------
const PICKS = [
  { title: "The House on Mango Street", author: "Sandra Cisneros", pages: 110, tags: ["Short reads", "Classics"], blurb: "Tiny chapters, big feelings. You can finish one over breakfast." },
  { title: "The Little Prince", author: "Antoine de Saint-Exupéry", pages: 96, tags: ["Short reads", "Classics"], blurb: "A small book people reread their whole lives." },
  { title: "Holes", author: "Louis Sachar", pages: 233, tags: ["Funny", "Adventure"], blurb: "A mystery, a curse, and a very bad summer camp. Impossible to put down." },
  { title: "Wonder", author: "R.J. Palacio", pages: 316, tags: ["Heartwarming"], blurb: "Short chapters from different voices — flies by and stays with you." },
  { title: "Charlotte's Web", author: "E.B. White", pages: 184, tags: ["Classics", "Heartwarming"], blurb: "Some Pig. The friendliest classic there is." },
  { title: "The Outsiders", author: "S.E. Hinton", pages: 192, tags: ["Short reads", "Classics"], blurb: "Written by a teenager, gripping from page one." },
  { title: "Hatchet", author: "Gary Paulsen", pages: 195, tags: ["Adventure", "Short reads"], blurb: "One boy, one hatchet, the wilderness. Pure page-turner." },
  { title: "The Lightning Thief", author: "Rick Riordan", pages: 377, tags: ["Adventure", "Fantasy", "Funny"], blurb: "Greek gods in modern America. The chapters practically turn themselves." },
  { title: "Diary of a Wimpy Kid", author: "Jeff Kinney", pages: 217, tags: ["Funny", "Pictures inside"], blurb: "Half comics, half diary, all laughs. A confidence builder." },
  { title: "El Deafo", author: "Cece Bell", pages: 248, tags: ["Pictures inside", "Heartwarming"], blurb: "A graphic novel memoir — pictures carry you through." },
  { title: "New Kid", author: "Jerry Craft", pages: 256, tags: ["Pictures inside", "Funny"], blurb: "An award-winning graphic novel about starting over at a new school." },
  { title: "Because of Winn-Dixie", author: "Kate DiCamillo", pages: 182, tags: ["Heartwarming", "Short reads"], blurb: "A girl, a scruffy dog, and a whole town of stories." },
  { title: "The Giver", author: "Lois Lowry", pages: 208, tags: ["Classics", "Fantasy"], blurb: "A quiet, haunting story that makes you want to talk about it." },
  { title: "A Wrinkle in Time", author: "Madeleine L'Engle", pages: 232, tags: ["Fantasy", "Adventure", "Classics"], blurb: "Space, time, and a rescue mission. A strange and wonderful classic." },
  { title: "Charlie and the Chocolate Factory", author: "Roald Dahl", pages: 176, tags: ["Funny", "Classics"], blurb: "Golden tickets and gleeful mischief. Dahl makes reading feel like candy." },
  { title: "The Alchemist", author: "Paulo Coelho", pages: 197, tags: ["Short reads", "Classics"], aud: "all", blurb: "Simple sentences, big journey. A favorite first 'grown-up' book." },
  // ----- For adult & teen readers -----
  { title: "The Thursday Murder Club", author: "Richard Osman", pages: 368, tags: ["Mystery", "Funny", "For adults"], aud: "adult", blurb: "Four retirees solve murders between biscuits. Cozy, clever, and very funny." },
  { title: "And Then There Were None", author: "Agatha Christie", pages: 272, tags: ["Mystery", "Classics", "For adults"], aud: "adult", blurb: "The queen of crime's masterpiece — ten strangers, one island, no way out." },
  { title: "The Silent Patient", author: "Alex Michaelides", pages: 336, tags: ["Mystery", "For adults"], aud: "adult", blurb: "A twist so good people gasp on the bus. Chapters fly by." },
  { title: "Beach Read", author: "Emily Henry", pages: 384, tags: ["Romance", "Funny", "For adults"], aud: "adult", blurb: "Two rival writers, one summer. Witty, warm, impossible to put down." },
  { title: "The Rosie Project", author: "Graeme Simsion", pages: 295, tags: ["Romance", "Funny", "For adults"], aud: "adult", blurb: "A genetics professor designs a questionnaire to find a wife. It does not go to plan." },
  { title: "Atomic Habits", author: "James Clear", pages: 320, tags: ["Nonfiction", "For adults"], aud: "adult", blurb: "Tiny changes, remarkable results — short chapters you can act on the same day." },
  { title: "Born a Crime", author: "Trevor Noah", pages: 304, tags: ["Nonfiction", "Funny", "For adults"], aud: "adult", blurb: "Growing up in apartheid South Africa — heartbreaking and hilarious, often on the same page." },
  { title: "Man's Search for Meaning", author: "Viktor Frankl", pages: 165, tags: ["Nonfiction", "Short reads", "Classics", "For adults"], aud: "adult", blurb: "Short, profound, life-changing. One of the most recommended books ever written." },
  { title: "Educated", author: "Tara Westover", pages: 334, tags: ["Nonfiction", "For adults"], aud: "adult", blurb: "A memoir that reads like a thriller — from no schooling to Cambridge." },
  { title: "The Martian", author: "Andy Weir", pages: 369, tags: ["Sci-fi", "Funny", "Adventure", "For adults"], aud: "adult", blurb: "Stranded on Mars with potatoes and attitude. Science has never been this fun." },
  { title: "Project Hail Mary", author: "Andy Weir", pages: 476, tags: ["Sci-fi", "Adventure", "For adults"], aud: "adult", blurb: "Wakes up alone in space with no memory. The buddy story of the decade." },
  { title: "The House in the Cerulean Sea", author: "TJ Klune", pages: 396, tags: ["Fantasy", "Heartwarming", "For adults"], aud: "adult", blurb: "Like a warm hug in book form — magical children and found family." },
  { title: "Of Mice and Men", author: "John Steinbeck", pages: 107, tags: ["Classics", "Short reads", "For adults"], aud: "adult", blurb: "An American classic you can finish in two sittings — and never forget." },
  { title: "The Old Man and the Sea", author: "Ernest Hemingway", pages: 127, tags: ["Classics", "Short reads", "Adventure", "For adults"], aud: "adult", blurb: "One old fisherman, one giant fish. Hemingway's Nobel-winning knockout." },
  // ----- En español -----
  { title: "El Principito", author: "Antoine de Saint-Exupéry", pages: 96, tags: ["En español", "Short reads", "Classics"], aud: "all", lang: "es", blurb: "El libro que la gente relee toda la vida. Corto, tierno y sabio." },
  { title: "Cuentos de la selva", author: "Horacio Quiroga", pages: 120, tags: ["En español", "Short reads", "Adventure"], aud: "all", lang: "es", blurb: "Cuentos cortos de animales de la selva — perfectos para leer uno por noche." },
  { title: "Diario de Greg: Un renacuajo", author: "Jeff Kinney", pages: 224, tags: ["En español", "Funny", "Pictures inside"], aud: "kids", lang: "es", blurb: "Mitad cómic, mitad diario, pura risa. Ideal para agarrar confianza." },
  { title: "Esperanza renace", author: "Pam Muñoz Ryan", pages: 288, tags: ["En español", "Heartwarming"], aud: "kids", lang: "es", blurb: "Una historia de perder todo y volver a empezar. Hermosa y llena de esperanza." },
  { title: "Cajas de cartón", author: "Francisco Jiménez", pages: 134, tags: ["En español", "Short reads", "Nonfiction"], aud: "all", lang: "es", blurb: "Relatos reales de una familia migrante en California. Corto, honesto, inolvidable." },
  { title: "La casa en Mango Street", author: "Sandra Cisneros", pages: 112, tags: ["En español", "Short reads", "Classics"], aud: "all", lang: "es", blurb: "Capítulos diminutos, sentimientos enormes. Se puede leer uno en el desayuno." },
  { title: "El alquimista", author: "Paulo Coelho", pages: 192, tags: ["En español", "Classics", "Short reads"], aud: "all", lang: "es", blurb: "Frases sencillas, viaje enorme. Un favorito para volver a leer en español." },
  { title: "Crónica de una muerte anunciada", author: "Gabriel García Márquez", pages: 122, tags: ["En español", "Mystery", "Classics", "Short reads", "For adults"], aud: "adult", lang: "es", blurb: "Todos saben que lo van a matar. García Márquez en 122 páginas perfectas." },
  { title: "Aura", author: "Carlos Fuentes", pages: 62, tags: ["En español", "Short reads", "For adults"], aud: "adult", lang: "es", blurb: "Una novela corta y escalofriante que se lee en una tarde — y no se olvida." },
  { title: "Como agua para chocolate", author: "Laura Esquivel", pages: 246, tags: ["En español", "Romance", "For adults"], aud: "adult", lang: "es", blurb: "Amor, cocina y magia en la frontera. Cada capítulo empieza con una receta." },
  { title: "La sombra del viento", author: "Carlos Ruiz Zafón", pages: 576, tags: ["En español", "Mystery", "For adults"], aud: "adult", lang: "es", blurb: "Un cementerio de libros olvidados en Barcelona. Largo, pero imposible de soltar." },
  { title: "Bajo la misma estrella", author: "John Green", pages: 304, tags: ["En español", "Romance", "Heartwarming"], aud: "all", lang: "es", blurb: "El famoso 'The Fault in Our Stars' en español — amor, humor y lágrimas." },
];
const ALL_TAGS = ["All", "En español", "Short reads", "Funny", "Adventure", "Heartwarming", "Fantasy", "Mystery", "Romance", "Sci-fi", "Nonfiction", "Classics", "Pictures inside", "For adults"];

// ---------- The After Dark Shelf (adults only) ----------
// Shown ONLY to readers who answered "grown-up" on the personality quiz.
// These titles never appear in the general Discover list or in kids'/teens' matches.
// For school or classroom deployments, set this to false to remove the section entirely:
const SHOW_AFTER_DARK = true;

// SCHOOL MODE: set to true for classroom/district deployments.
// Hides the public community wall, meetups, and the After Dark shelf entirely —
// one flag, FERPA-friendlier build, same codebase.
const SCHOOL_MODE = false;

const MATURE_SHELF = {
  romance: {
    label: "Spicy romance", emoji: "🌶️",
    books: [
      { title: "A Court of Thorns and Roses", author: "Sarah J. Maas", pages: 419, level: "🌶️🌶️🌶️", note: "The gateway book of the entire romantasy wave — faeries, bargains, and heat." },
      { title: "Fourth Wing", author: "Rebecca Yarros", pages: 517, level: "🌶️🌶️🌶️", note: "Dragon riders at a brutal war college. The book everyone's friend made them read." },
      { title: "The Love Hypothesis", author: "Ali Hazelwood", pages: 384, level: "🌶️🌶️", note: "Fake dating in a science lab — smart, funny, and steamy." },
      { title: "Icebreaker", author: "Hannah Grace", pages: 448, level: "🌶️🌶️🌶️", note: "Figure skater meets hockey captain. TikTok's favorite rink romance." },
      { title: "It Ends with Us", author: "Colleen Hoover", pages: 384, level: "🌶️🌶️", note: "The mega-bestseller — a love story with real weight behind it." },
    ],
  },
  horror: {
    label: "Horror", emoji: "👻",
    books: [
      { title: "The Shining", author: "Stephen King", pages: 447, level: "👻👻👻", note: "An empty hotel, a long winter. The king of horror at full power." },
      { title: "The Haunting of Hill House", author: "Shirley Jackson", pages: 246, level: "👻👻", note: "The greatest haunted house novel ever written — dread on every page." },
      { title: "Mexican Gothic", author: "Silvia Moreno-Garcia", pages: 301, level: "👻👻", note: "A glamorous socialite, a rotting mansion, a family with secrets." },
      { title: "Bird Box", author: "Josh Malerman", pages: 262, level: "👻👻👻", note: "Don't open your eyes. A survival nightmare you'll finish in two nights." },
      { title: "Pet Sematary", author: "Stephen King", pages: 374, level: "👻👻👻", note: "The book King himself thought went too far. Sometimes dead is better." },
    ],
  },
  dark: {
    label: "Dark & gritty", emoji: "🥃",
    books: [
      { title: "Gone Girl", author: "Gillian Flynn", pages: 415, level: "R", note: "The marriage-from-hell thriller with the twist that broke the internet." },
      { title: "Verity", author: "Colleen Hoover", pages: 336, level: "R", note: "A found manuscript that gets darker with every chapter. Deeply unsettling, wildly popular." },
      { title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson", pages: 465, level: "R", note: "A decades-old disappearance and one unforgettable investigator. Brutal and brilliant." },
      { title: "No Country for Old Men", author: "Cormac McCarthy", pages: 309, level: "R", note: "A bag of money, a relentless killer, spare deadly prose." },
      { title: "Fight Club", author: "Chuck Palahniuk", pages: 218, level: "R", note: "You know the first rule. Short, savage, unforgettable." },
    ],
  },
};

const PROMPTS = [
  "Which character would you want as a friend, and why?",
  "Read your favorite sentence out loud to someone. What do they think?",
  "If your book had a smell, what would it be?",
  "What surprised you most in the last chapter you read?",
  "Would this book make a good movie? Who plays the lead?",
  "Ask a friend: what book made you love reading?",
  "What would you change about the ending?",
];

// ---------- Reading personality quiz ----------
const QUIZ = [
  { q: "Who's doing the reading?", options: [
    { label: "A young reader (elementary/middle school)", tags: {}, audience: "kid" },
    { label: "A teen", tags: {}, audience: "teen" },
    { label: "A grown-up", tags: {}, audience: "adult" },
  ]},
  { q: "¿En qué idioma? — What language do you want to read in?", options: [
    { label: "English", tags: {}, lang: "en" },
    { label: "Español", tags: { "En español": 3 }, lang: "es" },
    { label: "Both / Los dos", tags: { "En español": 1 }, lang: "both" },
  ]},
  { q: "Made-up stories, or real life?", options: [
    { label: "Fiction all the way — take me somewhere else", tags: {} },
    { label: "True stories and real-world ideas", tags: { Nonfiction: 3 } },
    { label: "Mix it up", tags: { Nonfiction: 1 } },
  ]},
  { q: "Pick a night-in movie:", options: [
    { label: "A whodunit with a twist", tags: { Mystery: 3 } },
    { label: "A love story", tags: { Romance: 3 } },
    { label: "A space odyssey", tags: { "Sci-fi": 3 } },
    { label: "A stand-up comedy special", tags: { Funny: 2 } },
  ]},
  { q: "Pick a vacation:", options: [
    { label: "A cabin in the woods, no phone signal", tags: { Mystery: 1, Classics: 1 } },
    { label: "A city I've never been to", tags: { Nonfiction: 1, Adventure: 2 } },
    { label: "A beach with a big bag of books", tags: { Romance: 2, Funny: 1 } },
    { label: "Somewhere that isn't on any map", tags: { Fantasy: 2, "Sci-fi": 1 } },
  ]},
  { q: "Be honest about your reading history:", options: [
    { label: "I haven't finished a book in years", tags: { "Short reads": 2, Funny: 1 }, maxPages: 250 },
    { label: "I read in waves — binge, then nothing", tags: { Mystery: 1, Romance: 1 } },
    { label: "I read a little, want to read more", tags: { "Short reads": 1 } },
    { label: "I read plenty — just want better picks", tags: {} },
  ]},
  { q: "What sounds like a perfect Friday night?", options: [
    { label: "Laughing until it hurts", tags: { Funny: 3 } },
    { label: "An adventure — the wilder the better", tags: { Adventure: 3 } },
    { label: "Something cozy and warm", tags: { Heartwarming: 3 } },
    { label: "Escaping to a world that doesn't exist", tags: { Fantasy: 3 } },
  ]},
  { q: "How much reading time do you usually have?", options: [
    { label: "Snippets — 10 minutes here and there", tags: { "Short reads": 3 }, maxPages: 220 },
    { label: "A steady half hour most days", tags: {} },
    { label: "I can disappear for hours", tags: { Fantasy: 1, Adventure: 1 } },
  ]},
  { q: "Pictures in a book are…", options: [
    { label: "The best part", tags: { "Pictures inside": 3 } },
    { label: "Nice to have", tags: { "Pictures inside": 1 } },
    { label: "I'd rather imagine it myself", tags: { Classics: 1 } },
  ]},
  { q: "Pick a vibe:", options: [
    { label: "Timeless — books people have loved for generations", tags: { Classics: 3 } },
    { label: "Fresh — something that feels like today", tags: { Funny: 1, "Pictures inside": 1 } },
  ]},
  { q: "A great book should leave you feeling…", options: [
    { label: "On the edge of your seat", tags: { Adventure: 2, Fantasy: 1 } },
    { label: "Warm inside", tags: { Heartwarming: 2 } },
    { label: "Thoughtful", tags: { Classics: 2 } },
    { label: "Amused", tags: { Funny: 2 } },
  ]},
  { q: "Be honest — how does reading feel right now?", options: [
    { label: "Just starting out — keep it easy on me", tags: { "Short reads": 2, "Pictures inside": 2 }, maxPages: 250 },
    { label: "Warming up to it", tags: { "Short reads": 1 } },
    { label: "Bring it on", tags: {} },
  ]},
];

const ARCHETYPES = {
  Funny: { name: "The Comedian", emoji: "😄", line: "You read for the joy of it. Books that make you laugh will keep you turning pages long past bedtime." },
  Adventure: { name: "The Trailblazer", emoji: "🧭", line: "You want stakes, danger, and momentum. Fast-moving stories are your fuel." },
  Heartwarming: { name: "The Big Heart", emoji: "💛", line: "You read to feel connected. Stories about friendship and kindness are your home turf." },
  Fantasy: { name: "The Dreamer", emoji: "🐉", line: "Real life is fine, but you'd rather be somewhere with dragons. Other worlds are your happy place." },
  Classics: { name: "The Old Soul", emoji: "📜", line: "You're drawn to books that have stood the test of time — and you like a story that makes you think." },
  "Short reads": { name: "The Sprinter", emoji: "⚡", line: "You read in bursts, and that's a superpower. Short, punchy books stack up fast." },
  "Pictures inside": { name: "The Visual Storyteller", emoji: "🎨", line: "You think in images. Graphic novels and illustrated books were made for you." },
  Mystery: { name: "The Detective", emoji: "🕵️", line: "You read to solve. Twists, clues, and one-more-chapter-at-2am endings are your weakness." },
  Romance: { name: "The Romantic", emoji: "🌹", line: "You read for the butterflies. Great banter and a happy ending make any week better." },
  "Sci-fi": { name: "The Explorer", emoji: "🚀", line: "You want big ideas and bigger worlds. The future is your favorite place to visit." },
  Nonfiction: { name: "The Curious Mind", emoji: "🔭", line: "You read to understand — real stories, real ideas, and facts you can't wait to share." },
};

function scoreQuiz(answers) {
  const tagScores = {};
  let maxPages = Infinity;
  let audience = "all";
  let lang = "en";
  answers.forEach((ai, qi) => {
    const opt = QUIZ[qi]?.options[ai];
    if (!opt) return;
    Object.entries(opt.tags).forEach(([t, v]) => { tagScores[t] = (tagScores[t] || 0) + v; });
    if (opt.maxPages) maxPages = Math.min(maxPages, opt.maxPages);
    if (opt.audience) audience = opt.audience;
    if (opt.lang) lang = opt.lang;
  });
  return { tagScores, maxPages, audience, lang };
}

function matchBooks(answers) {
  const { tagScores, maxPages, audience, lang } = scoreQuiz(answers);
  let pool = PICKS;
  // Young readers never get adult-audience books recommended
  if (audience === "kid") pool = pool.filter((p) => p.aud !== "adult");
  // English-only readers don't get Spanish-language picks (they can still browse the chip)
  if (lang === "en") pool = pool.filter((p) => p.lang !== "es");
  // Spanish readers: Spanish books rise to the top
  const langBoost = (p) => (lang === "es" ? (p.lang === "es" ? 6 : -4) : lang === "both" ? (p.lang === "es" ? 2 : 0) : 0);
  return pool.map((p) => {
    let score = p.tags.reduce((s, t) => s + (tagScores[t] || 0), 0);
    score += p.pages <= maxPages ? 1 : -2;
    const aud = p.aud || "kids";
    if (audience === "adult") score += aud === "adult" ? 3 : aud === "all" ? 1 : -3;
    if (audience === "teen") score += aud === "all" ? 2 : 0;
    if (audience === "kid") score += aud === "kids" ? 2 : 0;
    score += langBoost(p);
    return { ...p, score, reasons: p.tags.filter((t) => tagScores[t]) };
  }).sort((a, b) => b.score - a.score);
}

const topTag = (tagScores) => Object.entries(tagScores).sort((a, b) => b[1] - a[1])[0]?.[0] || "Heartwarming";

// Normalize titles for matching search results against Gutenberg's catalog
const normTitle = (t) => (t || "").toLowerCase().replace(/[^a-z0-9áéíóúñü ]/g, "").replace(/\s+/g, " ").trim();

// Fetch with a hard timeout — a hung request should never freeze the UI
const fetchT = (url, ms = 6000, opts = {}) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

// Search Gutenberg's catalog. v2: the proxy and the direct call race IN
// PARALLEL, each with its own timeout — the old version waited for the proxy
// to fully fail (which could take 10s+) before even trying gutendex directly.
// Genres tuned to what Project Gutenberg's free catalog is actually deep in —
// so every pill lands on real shelves, not three books and an apology.
const FREE_GENRES = [
  ["🔍 Mystery & detective", "detective"],
  ["🗺️ Adventure", "adventure"],
  ["🚀 Science fiction", "science fiction"],
  ["🧛 Gothic & horror", "horror"],
  ["🐉 Fantasy & myth", "fantasy"],
  ["💛 Romance", "love"],
  ["😂 Humor", "humor"],
  ["📖 Short stories", "short stories"],
  ["🧒 For young readers", "children"],
  ["🎭 Poetry & drama", "poetry"],
  ["📜 History", "history"],
  ["🧠 Philosophy", "philosophy"],
  ["🇲🇽 En español", "__es__"],
];

const mapGutendex = (d) => (d.results || []).map((b) => ({
  gid: b.id, title: b.title, author: (b.authors || [])[0]?.name || "",
  cover: b.formats?.["image/jpeg"] || null, downloads: b.download_count,
}));

// One fetcher for the whole free library: proxy and gutendex race in
// parallel with timeouts, so a blocked or slow route never stalls the page.
async function fetchGutenList({ q = "", topic = "", es = false, page = 1 }) {
  const proxyQ = new URLSearchParams();
  if (q) proxyQ.set("q", q);
  if (topic) proxyQ.set("topic", topic);
  if (es) proxyQ.set("languages", "es");
  if (page > 1) proxyQ.set("page", String(page));
  const directQ = new URLSearchParams();
  if (q) directQ.set("search", q);
  if (topic) directQ.set("topic", topic);
  directQ.set("languages", es ? "es" : "en,es");
  if (page > 1) directQ.set("page", String(page));
  const attempt = async (url) => {
    const r = await fetchT(url, 7000);
    if (!r.ok) throw new Error("bad status");
    const out = mapGutendex(await r.json());
    if (!out.length) throw new Error("empty");
    return out;
  };
  try {
    return await Promise.any([
      attempt(`/api/guten?${proxyQ.toString()}`),
      attempt(`https://gutendex.com/books?${directQ.toString()}`),
    ]);
  } catch {
    return [];
  }
}

async function gutenbergLookup(query, topic, page = 1) {
  const parse = (d) => (d.results || []).slice(0, 32).map((b) => ({
    gid: b.id, key: normTitle(b.title), title: b.title, author: (b.authors || [])[0]?.name || "",
  }));
  const pg = page > 1 ? `&page=${page}` : "";
  const qs = (topic ? `topic=${encodeURIComponent(topic)}` : `q=${encodeURIComponent(query)}`) + pg;
  const direct = (topic
    ? `https://gutendex.com/books?topic=${encodeURIComponent(topic)}`
    : `https://gutendex.com/books?search=${encodeURIComponent(query)}`) + pg;
  const attempt = async (url) => {
    const r = await fetchT(url, 7000);
    if (!r.ok) throw new Error("bad status");
    const out = parse(await r.json());
    if (!out.length) throw new Error("empty");
    return out;
  };
  try {
    return await Promise.any([attempt(`/api/guten?${qs}`), attempt(direct)]);
  } catch {
    return [];
  }
}

// Fuzzy-match a search-result title against Gutenberg entries
const stripArticles = (t) => t.replace(/^(the|a|an|el|la|los|las|un|una)\s+/, "");
function matchGuten(list, title, author) {
  const key = stripArticles(normTitle(title));
  if (!key || key.length < 4) return null;
  const au = normTitle(author || "");
  let loose = null;
  for (const g of list) {
    const gk = stripArticles(g.key);
    if (!gk) continue;
    if (gk === key) return g;                                   // exact
    if (gk.length >= 6 && key.length >= 6) {
      if (gk.startsWith(key) || key.startsWith(gk)) return g;   // prefix
      if (gk.includes(key) || key.includes(gk)) {               // containment
        const ga = normTitle(g.author || "");
        // If we know both authors, require a surname overlap before trusting it
        if (!au || !ga || ga.split(" ").some((w) => w.length > 3 && au.includes(w))) return g;
        loose = loose || g;
      }
    }
  }
  return loose;
}

// ---------- Voice picker: find the calmest, most natural voice on this device ----------
const FEMALE_RE = /samantha|victoria|zira|jenny|aria|michelle|sonia|emma|ava|allison|susan|karen|moira|tessa|serena|libby|joana|paulina|m[oó]nica|helena|sabina|salome|francisca|female/i;
const MALE_RE = /david|mark|\bguy\b|christopher|eric|daniel|alex\b|fred|jorge|diego|juan|pablo|george|james|ryan|thomas|aaron|roger|brandon|arthur|liam|alvaro|male/i;

function pickVoice(lang, pref) {
  try {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const base = (lang || "en").slice(0, 2).toLowerCase();
    const pool = voices.filter((v) => (v.lang || "").toLowerCase().startsWith(base));
    if (!pool.length) return null;
    const genderRe = pref === "male" ? MALE_RE : FEMALE_RE;
    const quality = (v) =>
      (/natural/i.test(v.name) ? 8 : 0) +
      (/neural|premium|enhanced|hd/i.test(v.name) ? 6 : 0) +
      (/google/i.test(v.name) ? 4 : 0) +
      (/microsoft/i.test(v.name) ? 2 : 0) +
      (genderRe.test(v.name) ? 20 : 0);
    return [...pool].sort((a, b) => quality(b) - quality(a))[0] || null;
  } catch {
    return null;
  }
}

// ---------- Digital shelf: free public-domain classics (Project Gutenberg) ----------
const FEATURED_CLASSICS = [
  { gid: 46, title: "A Christmas Carol", author: "Charles Dickens", note: "Short & beloved — a perfect first classic." },
  { gid: 5200, title: "Metamorphosis", author: "Franz Kafka", note: "Wakes up as a giant insect. Very short, very famous." },
  { gid: 11, title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", note: "Down the rabbit hole — playful and quick." },
  { gid: 1661, title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", note: "12 mysteries — read one case at a time." },
  { gid: 1342, title: "Pride and Prejudice", author: "Jane Austen", note: "The original enemies-to-lovers." },
  { gid: 84, title: "Frankenstein", author: "Mary Shelley", note: "The monster story that started sci-fi." },
  { gid: 345, title: "Dracula", author: "Bram Stoker", note: "The vampire classic, told in letters and diaries." },
  { gid: 64317, title: "The Great Gatsby", author: "F. Scott Fitzgerald", note: "Short, dazzling, and finally free to read." },
  { gid: 74, title: "The Adventures of Tom Sawyer", author: "Mark Twain", note: "Fence-painting, cave adventures, pure fun." },
  { gid: 16, title: "Peter Pan", author: "J. M. Barrie", note: "Second star to the right — for every age." },
  { gid: 55, title: "The Wonderful Wizard of Oz", author: "L. Frank Baum", note: "Follow the yellow brick road, chapter by chapter." },
  { gid: 2000, title: "Don Quijote", author: "Miguel de Cervantes", note: "La obra maestra del español — léela poco a poco." },
];

// ---------- Streaks, goals & gifts ----------
const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = () => dkey(new Date());

function calcStreak(days) {
  const set = new Set(days);
  const key = (offset) => { const d = new Date(); d.setDate(d.getDate() - offset); return dkey(d); };
  let start = set.has(key(0)) ? 0 : set.has(key(1)) ? 1 : -1;
  if (start === -1) return 0;
  let s = 0;
  while (set.has(key(start + s))) s++;
  return s;
}

function bestStreak(days) {
  const sorted = [...new Set(days)].sort();
  let best = 0, cur = 0, prev = null;
  for (const d of sorted) {
    if (prev) {
      const p = new Date(prev + "T12:00:00");
      p.setDate(p.getDate() + 1);
      cur = d === dkey(p) ? cur + 1 : 1;
    } else cur = 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

function weekKeys() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const mon = new Date(now);
  mon.setDate(now.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return dkey(d); });
}
const thisWeekCount = (days) => { const set = new Set(days); return weekKeys().filter((k) => set.has(k)).length; };

const REWARDS = [
  { id: "s3", type: "streak", need: 3, title: "3-day streak", gift: "Bookmark Badge", emoji: "🔖" },
  { id: "s7", type: "streak", need: 7, title: "7-day streak", gift: "10% off your next book", emoji: "🎁", code: "READER10" },
  { id: "s14", type: "streak", need: 14, title: "2-week streak", gift: "Free shipping on your next order", emoji: "📦", code: "SHIPFREE" },
  { id: "s30", type: "streak", need: 30, title: "30-day streak", gift: "15% off any book", emoji: "🏆", code: "PAGETURNER15" },
  { id: "b1", type: "books", need: 1, title: "First book finished", gift: "First Chapter Badge", emoji: "🏅" },
  { id: "b3", type: "books", need: 3, title: "3 books finished", gift: "10% off your next book", emoji: "🎁", code: "TRILOGY10" },
  { id: "b5", type: "books", need: 5, title: "5 books finished", gift: "Buy one, get one 50% off", emoji: "📚", code: "SHELFBOGO50" },
  { id: "b10", type: "books", need: 10, title: "10 books finished", gift: "20% off — Super Reader status", emoji: "👑", code: "SUPERREADER20" },
  { id: "q1", type: "quizzes", need: 1, title: "First book quiz passed", gift: "Quiz Whiz Badge", emoji: "🧠" },
  { id: "q3", type: "quizzes", need: 3, title: "3 book quizzes passed", gift: "15% off your next book", emoji: "🎓", code: "QUIZWHIZ15" },
  { id: "q5", type: "quizzes", need: 5, title: "5 book quizzes passed", gift: "Free book under $10", emoji: "🎁", code: "BOOKONUS" },
];

// Points: +5 read day · +25 finish a book · +10 per correct quiz answer (first try) · +5 club post
const LEVELS = [
  { need: 0, name: "New Reader", emoji: "🌱" },
  { need: 50, name: "Page Turner", emoji: "📖" },
  { need: 150, name: "Bookworm", emoji: "🐛" },
  { need: 300, name: "Story Seeker", emoji: "🔍" },
  { need: 500, name: "Super Reader", emoji: "🦸" },
  { need: 800, name: "Library Legend", emoji: "🏛️" },
];
const levelFor = (pts) => {
  let level = LEVELS[0], next = null;
  for (const L of LEVELS) {
    if (pts >= L.need) level = L;
    else { next = L; break; }
  }
  return { level, next };
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const stampDate = (ts) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();

// Gentle, non-competitive encouragements — one per day
const ENCOURAGEMENTS = [
  "Five pages today is a real win. So is one.",
  "Slow reading is still reading.",
  "You're not behind. There's no behind.",
  "Books aren't a race — the story waits for you.",
  "Rereading a page you loved counts too.",
  "The only reader you're compared to is yesterday's you.",
  "Some days you read a chapter. Some days a paragraph. Both count.",
  "It's okay to put a book down. The right one will pull you back.",
];
const todaysEncouragement = () => ENCOURAGEMENTS[new Date().getDate() % ENCOURAGEMENTS.length];

// ---------- Storage ----------
async function loadShelf() {
  try {
    const r = await storage.get("shelf-data-v1");
    const d = r ? JSON.parse(r.value) : {};
    return { books: d.books || [], readDays: d.readDays || [], goalDays: d.goalDays || 4, quiz: d.quiz || null, points: d.points || 0, quizResults: d.quizResults || {}, classroom: d.classroom || null, teaching: d.teaching || null, digitalShelf: d.digitalShelf || [], myWords: d.myWords || [], voicePref: d.voicePref2 || "female", studioPref: d.studioPref === undefined ? null : d.studioPref, newsDigest: d.newsDigest || null, quizNudgeDismissed: d.quizNudgeDismissed || false, readLog: d.readLog || [], fluency: d.fluency || [], classes: d.classes || [], partner: d.partner || null, family: d.family || null, famSeen: d.famSeen || 0, lastSpotlight: d.lastSpotlight || "", onboarded: d.onboarded || false, userName: d.userName || "", role: d.role || "" };
  } catch {
    return { books: [], readDays: [], goalDays: 4, quiz: null, points: 0, quizResults: {}, classroom: null, teaching: null, digitalShelf: [], myWords: [], voicePref: "female", studioPref: null, newsDigest: null, quizNudgeDismissed: false, readLog: [], fluency: [], classes: [], partner: null, family: null, famSeen: 0, lastSpotlight: "", onboarded: false, userName: "", role: "" };
  }
}
async function saveShelf(data) {
  try {
    await storage.set("shelf-data-v1", JSON.stringify(data));
  } catch (e) {
    console.error("Save failed", e);
  }
}
async function loadPosts() {
  try {
    const r = await storage.list("clubpost:", true);
    const keys = (r?.keys || []).sort().reverse().slice(0, 24);
    const results = await Promise.all(
      keys.map(async (k) => {
        try {
          const item = await storage.get(k, true);
          return item ? JSON.parse(item.value) : null;
        } catch {
          return null;
        }
      })
    );
    return results.filter(Boolean).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}
async function savePost(post) {
  const key = `clubpost:${String(post.at).padStart(15, "0")}-${uid()}`;
  await storage.set(key, JSON.stringify(post), true);
}
async function loadMeetups() {
  try {
    const r = await storage.list("meetup:", true);
    const keys = (r?.keys || []).sort().reverse().slice(0, 12);
    const results = await Promise.all(
      keys.map(async (k) => {
        try {
          const item = await storage.get(k, true);
          return item ? { key: k, ...JSON.parse(item.value) } : null;
        } catch {
          return null;
        }
      })
    );
    return results.filter(Boolean).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}
async function saveMeetup(meetup) {
  const key = `meetup:${String(meetup.at).padStart(15, "0")}-${uid()}`;
  await storage.set(key, JSON.stringify(meetup), true);
  return key;
}

// ---------- Classroom (teacher chapter tracking) ----------
const makeClassCode = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusable 0/O/1/I/L
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};
const sanitizeKeyName = (name) => (name || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "reader";

async function createClassRecord(cls) {
  await storage.set(`class:${cls.code}`, JSON.stringify(cls), true);
}
async function fetchClassRecord(code) {
  try {
    const r = await storage.get(`class:${code}`, true);
    return r ? JSON.parse(r.value) : null;
  } catch {
    return null;
  }
}
async function publishClassProgress(code, student) {
  await storage.set(`cp:${code}:${sanitizeKeyName(student.name)}`, JSON.stringify(student), true);
}
async function saveFamilyMessages(classCode, student, msgs) {
  await storage.set(`fmsg:${classCode}:${sanitizeKeyName(student)}`, JSON.stringify(msgs), true);
}
async function fetchFamilyMessages(classCode, student) {
  try {
    const r = await storage.get(`fmsg:${classCode}:${sanitizeKeyName(student)}`, true);
    return JSON.parse(r.value) || [];
  } catch {
    return [];
  }
}
async function fetchStudentProgress(classCode, student) {
  try {
    const r = await storage.get(`cp:${classCode}:${sanitizeKeyName(student)}`, true);
    return JSON.parse(r.value);
  } catch {
    return null;
  }
}
async function fetchRoster(code) {
  try {
    const r = await storage.list(`cp:${code}:`, true);
    const keys = (r?.keys || []).slice(0, 40);
    const rows = await Promise.all(
      keys.map(async (k) => {
        try {
          const item = await storage.get(k, true);
          return item ? JSON.parse(item.value) : null;
        } catch {
          return null;
        }
      })
    );
    return rows.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)); // alphabetical, never by rank
  } catch {
    return [];
  }
}

// ---------- Small pieces ----------
function Stars({ value, onChange, size = 22 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange && onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          style={{
            background: "none", border: "none", cursor: onChange ? "pointer" : "default",
            fontSize: size, lineHeight: 1, padding: 0,
            color: n <= value ? "#D9A03F" : T.rule,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Ruled({ children, style }) {
  return (
    <div
      style={{
        background: `repeating-linear-gradient(${T.card}, ${T.card} 27px, ${T.rule} 27px, ${T.rule} 28px)`,
        border: `1px solid ${T.rule}`,
        borderRadius: 8,
        padding: "14px 16px",
        boxShadow: "0 1px 3px rgba(34,51,77,0.08)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------- Main ----------
export default function ShelfLife() {
  const [tab, setTab] = useState("today");
  const [onboarded, setOnboarded] = useState(true); // true until load says otherwise (no flash)
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [obStep, setObStep] = useState(0);
  const [obName, setObName] = useState("");
  const [books, setBooks] = useState([]);
  const [readDays, setReadDays] = useState([]);
  const [goalDays, setGoalDays] = useState(4);
  const [copied, setCopied] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [promptIdx, setPromptIdx] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const [pickTag, setPickTag] = useState("All");
  const [bookQuery, setBookQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", pages: "", status: "reading" });
  const [postForm, setPostForm] = useState({ name: "", book: "", text: "" });
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState("");
  const [quiz, setQuiz] = useState(null); // saved answers (array) or null
  const [quizStep, setQuizStep] = useState(0);
  const [quizDraft, setQuizDraft] = useState([]);
  const [aiPicks, setAiPicks] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [matureTab, setMatureTab] = useState("romance");
  const [recFor, setRecFor] = useState(null); // finished book id we're recommending from
  const [recResults, setRecResults] = useState({}); // bookId -> [books]
  const [recLoading, setRecLoading] = useState(false);
  const [aiNext, setAiNext] = useState({}); // bookId -> [ai picks]
  const [aiNextLoading, setAiNextLoading] = useState(false);
  const [morePicks, setMorePicks] = useState(null);
  const [morePicksLoading, setMorePicksLoading] = useState(false);
  const [getBook, setGetBook] = useState(null); // {title, author} — "how do I get this?"
  const [flagged, setFlagged] = useState({}); // resultKey -> true (reader says it isn't free)
  const [subject, setSubject] = useState(null); // browsing a category
  const [blurbs, setBlurbs] = useState({}); // resultKey -> {loading, text}
  const [appRating, setAppRating] = useState(0);
  const [appFeedback, setAppFeedback] = useState("");
  const [appRated, setAppRated] = useState(false);
  const [freshBooks, setFreshBooks] = useState(null);
  const [freshLoading, setFreshLoading] = useState(false);
  const [soundCheck, setSoundCheck] = useState(null); // {lines: [...], running}
  const [newsDigest, setNewsDigest] = useState(null); // {month: "2026-07", data}
  const [newsLoading, setNewsLoading] = useState(false);
  const [quizNudgeDismissed, setQuizNudgeDismissed] = useState(false);
  const [readLog, setReadLog] = useState([]); // [{d, min, ch, qz}] — the log nobody has to fill out
  const [fluency, setFluency] = useState([]); // [{d, wcpm, acc, words}] — oral reading fluency over time
  const [partner, setPartner] = useState(null); // a bookstore or library running offers
  const [partnerForm, setPartnerForm] = useState({ name: "", kind: "bookstore", city: "", blurb: "", address: "" });
  const [offerForm, setOfferForm] = useState({ prize: "", metric: "chapters", need: "", codes: "", note: "" });
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState("");
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [foundPartner, setFoundPartner] = useState(null);
  const [classes, setClasses] = useState([]); // every class this teacher runs
  const [family, setFamily] = useState(null); // parent view: {code, classCode, student, className, teacher, book, chapters}
  const [famSeen, setFamSeen] = useState(0); // timestamp of last message read
  const [famProgress, setFamProgress] = useState(null);
  const [famMsgs, setFamMsgs] = useState([]);
  const [famBusy, setFamBusy] = useState(false);
  const [famCodeInput, setFamCodeInput] = useState("");
  const [lastSpotlight, setLastSpotlight] = useState("");
  const [spotlight, setSpotlight] = useState(null); // {kind, ...payload}
  const [newsMore, setNewsMore] = useState({}); // idx -> {loading, text, open}
  const [points, setPoints] = useState(0);
  const [quizResults, setQuizResults] = useState({}); // bookId -> {score, total, passed, at}
  const [bookQuiz, setBookQuiz] = useState(null); // {bookId, title, loading, questions, answers, submitted, score, earned}
  const [confetti, setConfetti] = useState(false);
  const [meetups, setMeetups] = useState([]);
  const [meetupsLoading, setMeetupsLoading] = useState(true);
  const [showMeetupForm, setShowMeetupForm] = useState(false);
  const [meetupForm, setMeetupForm] = useState({ host: "", place: "", when: "", book: "", note: "" });
  const [rsvpDrafts, setRsvpDrafts] = useState({});
  const [savingMeetup, setSavingMeetup] = useState(false);
  const [digitalShelf, setDigitalShelf] = useState([]); // [{gid, title, author, pos}]
  const [reader, setReader] = useState(null); // {gid, title, author, pages, page, loading}
  const [readerFont, setReaderFont] = useState(17);
  const [tapMode, setTapMode] = useState("define"); // "define" | "read"
  const [readerFace, setReaderFace] = useState("hyper"); // hyper | lexend | serif
  const [studioPref, setStudioPref] = useState(null); // null = auto, true/false = user chose
  const [studioAvailable, setStudioAvailable] = useState(false);
  const premiumVoice = studioPref === null ? studioAvailable : studioPref;
  const setPremiumVoice = (v) => { setStudioPref(v); persist({ studioPref: v }); };
  const [audioBusy, setAudioBusy] = useState(false);
  const [wordCard, setWordCard] = useState(null); // {word, loading, phonetic, pos, definition, notFound}
  const [myWords, setMyWords] = useState([]); // [{word, definition, at}]
  const [voicePref, setVoicePref] = useState("system");
  const [syncCode, setSyncCode] = useState(null);
  const [syncInput, setSyncInput] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [wordQuiz, setWordQuiz] = useState(null); // {questions, answers, submitted, score}
  const [showWords, setShowWords] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null); // a myWords entry being reviewed
  const [recap, setRecap] = useState(null); // {bookId, loading, text}
  const [readAlong, setReadAlong] = useState({ on: false, char: -1 });
  const [practice, setPractice] = useState(null); // {passage, words, listening, results, matched, done}
  const [gutenQuery, setGutenQuery] = useState("");
  const [gutenResults, setGutenResults] = useState(null);
  const [gutenLoading, setGutenLoading] = useState(false);
  const [classroom, setClassroom] = useState(null); // student: {code, name, className, teacher, book, chapters, chapter}
  const [teaching, setTeaching] = useState(null); // teacher: {code, className, teacher, book, chapters}
  const [classMode, setClassMode] = useState(null); // null | "teacher-setup" | "student-join"
  const [classForm, setClassForm] = useState({ teacher: "", className: "", book: "", chapters: "", kind: "class", level: "g35" });
  const [joinForm, setJoinForm] = useState({ code: "", name: "" });
  const [roster, setRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [classBusy, setClassBusy] = useState(false);
  const [chapQuiz, setChapQuiz] = useState(null); // {chapter, loading, questions, answers, submitted, score, earned}
  const [rewardForm, setRewardForm] = useState({ prize: "", metric: "chapters", need: "", code: "" });
  const [noticeDraft, setNoticeDraft] = useState("");
  const [assignForm, setAssignForm] = useState({ chapter: "", due: "", note: "" });
  const [hwForm, setHwForm] = useState({ chapter: "", due: "", kind: "comprehension", count: "4" });
  const [hwDraft, setHwDraft] = useState(null); // {loading, title, items:[...], chapter, due, kind}
  const [hwShow, setHwShow] = useState(false);
  const [hwDoing, setHwDoing] = useState(null); // student: the homework being worked on
  const [hwResults, setHwResults] = useState(null); // teacher: submissions for one homework
  const [textForm, setTextForm] = useState({ title: "", body: "" });
  const [showTextForm, setShowTextForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [report, setReport] = useState(null); // "class" | "me"
  const [tPane, setTPane] = useState("home"); // teacher dashboard pane
  const [tool, setTool] = useState(null); // {kind, loading, data, forName}
  const [notes, setNotes] = useState({}); // studentName -> note text (teacher's private notes)
  const [noteDraft, setNoteDraft] = useState({});
  const [quizBank, setQuizBank] = useState({}); // chapter -> {loading, questions}
  const [chaptersDraft, setChaptersDraft] = useState("");
  const [showRewardForm, setShowRewardForm] = useState(false);

  useEffect(() => {
    loadShelf().then((d) => {
      setBooks(d.books || []);
      setReadDays(d.readDays || []);
      setGoalDays(d.goalDays || 4);
      setQuiz(d.quiz || null);
      setPoints(d.points || 0);
      setQuizResults(d.quizResults || {});
      setClassroom(d.classroom || null);
      setTeaching(d.teaching || null);
      setDigitalShelf(d.digitalShelf || []);
      setMyWords(d.myWords || []);
      setVoicePref(d.voicePref2 || "female");
      setStudioPref(d.studioPref === undefined ? null : d.studioPref);
      setNewsDigest(d.newsDigest || null);
      setQuizNudgeDismissed(d.quizNudgeDismissed || false);
      setReadLog(d.readLog || []);
      setFluency(d.fluency || []);
      setPartner(d.partner || null);
      setFamily(d.family || null);
      setFamSeen(d.famSeen || 0);
      const existing = d.classes || [];
      setClasses(existing.length ? existing : (d.teaching ? [d.teaching] : []));
      setLastSpotlight(d.lastSpotlight || "");
      setOnboarded(d.onboarded || false);
      setUserName(d.userName || "");
      setRole(d.role || "");
      if (d.userName) {
        setJoinForm((f) => (f.name ? f : { ...f, name: d.userName }));
        setPostForm((f) => (f.name ? f : { ...f, name: d.userName }));
      }
      // Warm up the voice list (it loads async in most browsers)
      try { window.speechSynthesis?.getVoices?.(); window.speechSynthesis.onvoiceschanged = () => {}; } catch { /* noop */ }
      if (d.quiz) setPickTag(topTag(scoreQuiz(d.quiz).tagScores));
      setLoaded(true);
    });
    loadPosts().then((p) => {
      setPosts(p);
      setPostsLoading(false);
    });
    loadMeetups().then((m) => {
      setMeetups(m);
      setMeetupsLoading(false);
    });
  }, []);

  const createMeetup = async () => {
    if (!meetupForm.host.trim() || !meetupForm.place.trim() || !meetupForm.when.trim()) return;
    setSavingMeetup(true);
    const meetup = {
      host: meetupForm.host.trim().slice(0, 30),
      place: meetupForm.place.trim().slice(0, 80),
      when: meetupForm.when.trim().slice(0, 60),
      book: meetupForm.book.trim().slice(0, 60),
      note: meetupForm.note.trim().slice(0, 200),
      attendees: [meetupForm.host.trim().slice(0, 30)],
      at: Date.now(),
    };
    try {
      const key = await saveMeetup(meetup);
      setMeetups([{ key, ...meetup }, ...meetups]);
      setMeetupForm({ host: meetupForm.host, place: "", when: "", book: "", note: "" });
      setShowMeetupForm(false);
      persist({ points: points + 5 });
      flash("Meetup posted! +5 pts 📍");
    } catch {
      flash("Couldn't post the meetup — try again");
    }
    setSavingMeetup(false);
  };

  const rsvpMeetup = async (m) => {
    const name = (rsvpDrafts[m.key] || "").trim().slice(0, 30);
    if (!name) return;
    try {
      // Re-read latest before updating so we don't drop other RSVPs
      let latest = m;
      try {
        const fresh = await storage.get(m.key, true);
        if (fresh) latest = { key: m.key, ...JSON.parse(fresh.value) };
      } catch { /* fall back to local copy */ }
      if (latest.attendees.some((a) => a.toLowerCase() === name.toLowerCase())) {
        flash("You're already on the list! ✓");
        return;
      }
      const updated = { ...latest, attendees: [...latest.attendees, name] };
      const { key, ...toSave } = updated;
      await storage.set(m.key, JSON.stringify(toSave), true);
      setMeetups(meetups.map((x) => (x.key === m.key ? updated : x)));
      setRsvpDrafts({ ...rsvpDrafts, [m.key]: "" });
      flash("You're in! See you there 📖");
    } catch {
      flash("Couldn't RSVP — try again");
    }
  };

  // ----- Classroom actions -----
  const createClass = async () => {
    if (!classForm.teacher.trim() || !classForm.className.trim() || !classForm.book.trim()) return;
    setClassBusy(true);
    const cls = {
      code: makeClassCode(),
      teacher: classForm.teacher.trim().slice(0, 40),
      className: classForm.className.trim().slice(0, 50),
      kind: classForm.kind === "family" ? "family" : "class",
      level: classForm.level || "g35",
      book: classForm.book.trim().slice(0, 80),
      bookAuthor: (classForm.bookAuthor || "").trim().slice(0, 40),
      chapters: Math.max(1, Math.min(99, parseInt(classForm.chapters) || 10)),
      rewards: [],
      createdAt: Date.now(),
    };
    try {
      await createClassRecord(cls);
      persist({ teaching: cls });
      setClassMode(null);
      setRoster([]);
      flash(`Class created! Code: ${cls.code} 🏫`);
    } catch {
      flash("Couldn't create the class — try again");
    }
    setClassBusy(false);
  };

  const joinClass = async () => {
    const code = joinForm.code.trim().toUpperCase();
    const name = joinForm.name.trim().slice(0, 30);
    if (!code || !name) return;
    setClassBusy(true);
    try {
      const cls = await fetchClassRecord(code);
      if (!cls) {
        flash("Hmm, no class with that code — double-check it?");
        setClassBusy(false);
        return;
      }
      const me = { name, chapter: 0, quizzes: {}, updatedAt: Date.now() };
      await publishClassProgress(code, me);
      const patch = { classroom: { ...cls, code, name, chapter: 0, quizzes: {} } };
      // Link the class book onto My Shelf so progress lives in both places
      if (!books.some((x) => x.classCode === code)) {
        const pages = (await lookupPages(cls.book, cls.bookAuthor || "")) || cls.chapters * 12;
        patch.books = [{
          id: uid(), classCode: code, title: cls.book, author: cls.bookAuthor || "",
          pages, status: "reading", currentPage: 0, rating: 0, addedAt: Date.now(), finishedAt: null,
        }, ...books];
      }
      persist(patch);
      setClassMode(null);
      flash(`Welcome to ${cls.className}! Your class book is on your shelf 📚`);
    } catch {
      flash("Couldn't join — try again");
    }
    setClassBusy(false);
  };

  const updateChapter = async (delta) => {
    if (!classroom) return;
    const chapter = Math.max(0, Math.min(classroom.chapters, (classroom.chapter || 0) + delta));
    if (chapter === classroom.chapter) return;
    const next = { ...classroom, chapter };
    const finishedNow = chapter === classroom.chapters;
    // Sync the linked book on My Shelf proportionally
    let earned = 0;
    const nextBooks = books.map((x) => {
      if (x.classCode !== classroom.code) return x;
      if (finishedNow && x.status !== "done") { earned = 25; return { ...x, currentPage: x.pages, status: "done", finishedAt: Date.now() }; }
      const cp = Math.round((chapter / classroom.chapters) * x.pages);
      return { ...x, currentPage: cp, status: x.status === "done" ? "done" : "reading" };
    });
    persist({ classroom: next, books: nextBooks, points: points + earned, readDays: delta > 0 ? withToday(readDays) : readDays, readLog: delta > 0 ? logActivity({ ch: delta }) : latestRef.current.readLog });
    try {
      const wk = (latestRef.current.readLog || []).slice(-7).reduce((a, x) => a + (x.min || 0), 0);
      await publishClassProgress(classroom.code, { name: classroom.name, chapter, quizzes: classroom.quizzes || {}, minWeek: wk, words: (latestRef.current.myWords || []).slice(0, 25).map((w) => w.word), wcpm: (latestRef.current.fluency || []).slice(-1)[0]?.wcpm || 0, updatedAt: Date.now() });
    } catch { /* will sync next update */ }
    if (finishedNow) {
      celebrate();
      flash("You finished the class book! +25 pts 🎉");
    } else if (delta > 0) {
      flash(`Chapter ${chapter} done — take its quiz below! 🧠`);
    }
  };

  // ----- Readers across the app: a gentle global counter -----
  const [totalReaders, setTotalReaders] = useState(null);
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        let n = 0;
        try { const r = await storage.get("stats:readers", true); n = parseInt(JSON.parse(r.value).n) || 0; } catch { /* first ever */ }
        if (!localStorage.getItem("sl-counted")) {
          n += 1;
          await storage.set("stats:readers", JSON.stringify({ n }), true);
          localStorage.setItem("sl-counted", "1");
        }
        setTotalReaders(n);
      } catch { /* quiet */ }
    })();
  }, [loaded]);

  // ----- Chapter-count estimate: fills in "how many chapters" for the teacher -----
  const [chapGuess, setChapGuess] = useState(""); // "" | "loading" | "done"
  const estimateChapters = async (title, author) => {
    setChapGuess("loading");
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5", max_tokens: 20,
          messages: [{ role: "user", content: `How many chapters does the book "${title}"${author ? ` by ${author}` : ""} have? Reply with ONLY a number. If you're not sure, give your best estimate for this specific book — still only a number.` }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).filter((x) => x.type === "text").map((x) => x.text).join(" ");
      const n = parseInt((text.match(/\d{1,3}/) || [])[0]);
      if (n && n > 0 && n < 100) {
        setClassForm((f) => ({ ...f, chapters: String(n) }));
        setChapGuess("done");
        return;
      }
      setChapGuess("");
    } catch {
      setChapGuess("");
    }
  };

  // ----- Family Link: parents follow their reader with a code — no email, no phone, no PII -----
  const makeFamilyCode = async (studentName) => {
    const name = (studentName || "").trim().slice(0, 30);
    if (!teaching || !name) return null;
    const existing = teaching.family || {};
    // Same reader asked twice = same code (case-insensitive)
    const found = Object.entries(existing).find(([, n]) => (n || "").toLowerCase() === name.toLowerCase());
    if (found) return found[0];
    let code = makeClassCode();
    while (existing[code]) code = makeClassCode();
    const updated = { ...teaching, family: { ...existing, [code]: name } };
    try {
      await Promise.all([
        createClassRecord(updated),
        storage.set(`fam:${code}`, JSON.stringify({ classCode: teaching.code, student: name }), true),
      ]);
      persist({ teaching: updated });
      return code;
    } catch {
      flash("Couldn't create the code — check your connection and try again");
      return null;
    }
  };

  // Teacher types any reader's name and gets a family code — works even
  // before that reader has joined the class (the launch-day case).
  const [famNameInput, setFamNameInput] = useState("");
  const [famGenBusy, setFamGenBusy] = useState(false);
  const generateFamilyCode = async () => {
    if (famGenBusy || !famNameInput.trim()) return;
    setFamGenBusy(true);
    const c = await makeFamilyCode(famNameInput);
    if (c) { flash(`Family code for ${famNameInput.trim()}: ${c} 💛`); setFamNameInput(""); }
    setFamGenBusy(false);
  };

  // Parent side: write back to the teacher — same thread the teacher's notes live in
  const [famDraft, setFamDraft] = useState("");
  const sendFromFamily = async () => {
    const text = famDraft.trim().slice(0, 400);
    if (!family || !text || famBusy) return;
    setFamBusy(true);
    try {
      const cur = await fetchFamilyMessages(family.classCode, family.student);
      const next = [...(cur || []), { id: uid(), from: `${family.student}'s family`, who: "family", text, at: Date.now(), ack: 0 }].slice(-40);
      await saveFamilyMessages(family.classCode, family.student, next);
      setFamMsgs(next);
      setFamDraft("");
      flash(`Sent to ${family.teacher} ✉️`);
    } catch { flash("Couldn't send — try again"); }
    setFamBusy(false);
  };

  // Teacher side: one inbox for everything families have written back
  const [famInbox, setFamInbox] = useState(null); // { studentName: msgs[] }
  const [famInboxBusy, setFamInboxBusy] = useState(false);
  const [famReplyDraft, setFamReplyDraft] = useState({});
  const loadFamilyInbox = async () => {
    if (!teaching || famInboxBusy) return;
    setFamInboxBusy(true);
    try {
      const students = [...new Set([
        ...Object.values(teaching.family || {}),
        ...((roster || []).map((s) => s.name)),
      ])].filter(Boolean).slice(0, 40);
      const out = {};
      await Promise.all(students.map(async (s) => {
        try {
          const m = await fetchFamilyMessages(teaching.code, s);
          if (m && m.length) out[s] = m;
        } catch { /* skip this thread */ }
      }));
      setFamInbox(out);
    } catch { flash("Couldn't load family messages — try again"); }
    setFamInboxBusy(false);
  };
  const replyToFamily = async (studentName) => {
    const text = (famReplyDraft[studentName] || "").trim().slice(0, 400);
    if (!text) return;
    await sendToFamily(studentName, text);
    setFamReplyDraft((d) => ({ ...d, [studentName]: "" }));
    try {
      const m = await fetchFamilyMessages(teaching.code, studentName);
      setFamInbox((prev) => ({ ...(prev || {}), [studentName]: m || [] }));
    } catch { /* thread refreshes next check */ }
  };

  const joinFamily = async () => {
    const code = famCodeInput.trim().toUpperCase();
    if (code.length < 4) return;
    setFamBusy(true);
    try {
      // A family code lives inside its class record — find the class that owns it
      // One direct lookup — the app never downloads a list of classes
      let pointer = null;
      try { pointer = JSON.parse((await storage.get(`fam:${code}`, true)).value); } catch { /* not found */ }
      const owner = pointer ? await fetchClassRecord(pointer.classCode) : null;
      const student = pointer?.student;
      if (!owner || !student) { flash("Couldn't find that family code — check with the teacher"); setFamBusy(false); return; }
      const fam = { code, classCode: owner.code, student, className: owner.className, teacher: owner.teacher, book: owner.book, chapters: owner.chapters };
      persist({ family: fam });
      await refreshFamily(fam);
      flash(`You're following ${student}'s reading 💛`);
    } catch { flash("Something went wrong — try again"); }
    setFamBusy(false);
  };

  const refreshFamily = async (famArg) => {
    const fam = famArg || family;
    if (!fam) return;
    try {
      const [prog, msgs, cls] = await Promise.all([
        fetchStudentProgress(fam.classCode, fam.student),
        fetchFamilyMessages(fam.classCode, fam.student),
        fetchClassRecord(fam.classCode),
      ]);
      setFamProgress(prog);
      setFamMsgs(msgs || []);
      if (cls) persist({ family: { ...fam, book: cls.book, chapters: cls.chapters, className: cls.className, teacher: cls.teacher, assignments: cls.assignments || [], notice: cls.notice || "" } });
    } catch { /* keep showing what we have */ }
  };
  useEffect(() => {
    if (tab === "classroom" && family) {
      refreshFamily();
      setTimeout(() => persist({ famSeen: Date.now() }), 2500); // mark read after a look
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const unreadFamily = famMsgs.filter((m) => m.who !== "family" && m.at > (famSeen || 0)).length;

  const ackMessage = async (id) => {
    const next = famMsgs.map((m) => (m.id === id ? { ...m, ack: Date.now() } : m));
    setFamMsgs(next);
    try { await saveFamilyMessages(family.classCode, family.student, next); } catch { /* fine */ }
  };

  // Teacher side: send a note straight to the family's app
  const sendToFamily = async (studentName, text) => {
    if (!teaching || !text) return;
    try {
      const cur = await fetchFamilyMessages(teaching.code, studentName);
      const next = [...cur, { id: uid(), from: teaching.teacher, text, at: Date.now(), ack: 0 }].slice(-40);
      await saveFamilyMessages(teaching.code, studentName, next);
      flash(`Sent to ${studentName}'s family ✉️`);
    } catch { flash("Couldn't send — try again"); }
  };

  // Weekly digest a family can actually act on
  const familyDigest = async () => {
    if (!family || !famProgress) return;
    setFamBusy(true);
    try {
      const qs = Object.values(famProgress.quizzes || {});
      const text = await askTool(`Write a short, warm weekly update for the family of ${family.student}, who is reading "${family.book}" with their class. This week: on chapter ${famProgress.chapter || 0} of ${family.chapters}, passed ${qs.filter((q) => q.passed).length} of ${qs.length || 0} chapter checks${famProgress.minWeek ? `, read ${famProgress.minWeek} minutes in the app` : ""}${famProgress.wcpm ? `, reads about ${famProgress.wcpm} words per minute out loud` : ""}. Write 3 sentences for the family: what went well, what's coming up, and ONE specific five-minute thing they can do at home tonight. Warm and plain — no jargon, no scores framed as grades. Respond with only the update.`, 350);
      setTool({ kind: "digest", loading: false, text });
    } catch { flash("Couldn't build this week's update"); }
    setFamBusy(false);
  };

  // ----- Teacher tools that only work because we have the book AND the data -----
  const askTool = async (prompt, maxTokens) => {
    const r = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: maxTokens || 900, messages: [{ role: "user", content: prompt }] }),
    });
    const d = await r.json();
    return (d.content || []).filter((x) => x.type === "text").map((x) => x.text).join("\n").trim();
  };

  // 1) Small groups from real reading data (FCRR: flexible groups formed from data)
  const makeGroups = async () => {
    if (!teaching || !roster?.length) { flash("No readers yet — groups need at least a few students"); return; }
    setTool({ kind: "groups", loading: true });
    const lines = roster.map((r) => {
      const qs = Object.values(r.quizzes || {});
      const passed = qs.filter((q) => q.passed).length;
      return `${r.name}: chapter ${r.chapter || 0}/${teaching.chapters}, ${passed}/${qs.length || 0} quizzes passed${r.wcpm ? `, reads ${r.wcpm} wpm aloud` : ""}${r.minWeek ? `, ${r.minWeek} min this week` : ""}`;
    }).join("\n");
    try {
      const text = await askTool(`You are helping a teacher of ${lvl(teaching).label} form flexible small reading groups for "${teaching.book}" (${teaching.chapters} ${lvl(teaching).units}). ${lvl(teaching).ai} Here is the class data:\n${lines}\n\nSuggest 2-4 flexible groups. Every student appears in exactly one group. Never rank students or label anyone "low" or "struggling" — describe the INSTRUCTIONAL NEED instead (e.g. "needs a check-in on pace", "ready for an inference mini-lesson", "ready to stretch"). Give each group a warm name, the member names, the need, and one concrete 10-minute activity for that group using this book.\n\nRespond with ONLY JSON, no markdown: [{"name":"...","members":["..."],"need":"...","activity":"..."}]`, 1100);
      setTool({ kind: "groups", loading: false, data: JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim()) });
    } catch { flash("Couldn't build groups — try again"); setTool(null); }
  };

  // 2) Discussion questions for a chapter of THIS book
  const makeDiscussion = async (n) => {
    if (!teaching) return;
    setTool({ kind: "discuss", loading: true, chapter: n });
    try {
      const dsrc = teaching.customText;
      const text = await askTool(`Create a ready-to-run discussion ${dsrc ? `about this text:\n"""${dsrc.body.slice(0, 6000)}"""\n` : `for ${lvl(teaching).unit} ${n} of "${teaching.book}"`}${teaching.bookAuthor ? ` by ${teaching.bookAuthor}` : ""}. READER LEVEL: ${lvl(teaching).label}. ${lvl(teaching).ai} If you're unsure of that exact chapter, base it on the story up to that point. Warm and conversational, not a quiz. Respond with ONLY JSON, no markdown: {"warmup":"a 2-minute opener question anyone can answer","questions":["4 text-dependent discussion questions"],"debate":"one question with no right answer that will split the room","exit":"a one-sentence exit ticket prompt"}`, 900);
      setTool({ kind: "discuss", loading: false, chapter: n, data: JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim()) });
    } catch { flash("Couldn't build the discussion — try again"); setTool(null); }
  };

  // 3) Class vocabulary report — built from words students ACTUALLY tapped
  const makeVocab = async () => {
    if (!roster?.length) { flash("No readers yet"); return; }
    const counts = {};
    roster.forEach((r) => (r.words || []).forEach((w) => { counts[w] = (counts[w] || 0) + 1; }));
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!ranked.length) { flash("No tapped words yet — this fills in as readers use the reader 📖"); return; }
    setTool({ kind: "vocab", loading: true });
    try {
      const text = await askTool(`A ${lvl(teaching).label} class reading "${teaching.book}" tapped these words for help while reading (word: how many students): ${ranked.map(([w, c]) => `${w}: ${c}`).join(", ")}. For each word give a kid-friendly one-line meaning and a 1-sentence example using it. Then suggest one 5-minute whole-class warm-up activity using several of these words together. Respond with ONLY JSON, no markdown: {"words":[{"word":"...","meaning":"...","example":"..."}],"warmup":"..."}`, 1100);
      const data = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim());
      setTool({ kind: "vocab", loading: false, data, counts: Object.fromEntries(ranked) });
    } catch { flash("Couldn't build the vocabulary report — try again"); setTool(null); }
  };

  // 4) Family note — specific, warm, in the family's language
  const makeFamilyNote = async (r, lang) => {
    if (!teaching) return;
    setTool({ kind: "note", loading: true, forName: r.name });
    const qs = Object.values(r.quizzes || {});
    const think = qs.map((q) => q.think).filter(Boolean).slice(-1)[0];
    try {
      const text = await askTool(`Write a short, warm note from ${teaching.teacher} to the family of ${r.name} about their reading. Facts: reading "${teaching.book}", on chapter ${r.chapter || 0} of ${teaching.chapters}, passed ${qs.filter((q) => q.passed).length} of ${qs.length || 0} chapter checks${r.minWeek ? `, read ${r.minWeek} minutes in the app this week` : ""}${think ? `. Something they wrote: "${think}"` : ""}. 3-4 sentences. Lead with something genuinely good. If there's a concern, phrase it as an invitation, never a complaint. End with one specific thing the family can do at home in five minutes. ${lang === "es" ? "Write the entire note in warm, natural Spanish." : "Write in English."} Respond with only the note text.`, 400);
      setTool({ kind: "note", loading: false, forName: r.name, text, lang });
    } catch { flash("Couldn't write the note — try again"); setTool(null); }
  };

  // ----- Bookstores & libraries: set up a shop, publish offers, get found by teachers -----
  const createPartner = async () => {
    if (!partnerForm.name.trim() || !partnerForm.city.trim()) return;
    setPartnerBusy(true);
    let code = makeClassCode();
    const rec = {
      code, name: partnerForm.name.trim().slice(0, 60),
      kind: partnerForm.kind, city: partnerForm.city.trim().slice(0, 40),
      blurb: partnerForm.blurb.trim().slice(0, 160),
      address: partnerForm.address.trim().slice(0, 120),
      offers: [], createdAt: Date.now(),
    };
    try {
      await storage.set(`partner:${code}`, JSON.stringify(rec), true);
      persist({ partner: rec });
      flash(`You're set up! Share code ${code} with teachers 🎁`);
    } catch { flash("Couldn't create your shop — try again"); }
    setPartnerBusy(false);
  };

  const savePartner = async (updated) => {
    try {
      await storage.set(`partner:${updated.code}`, JSON.stringify(updated), true);
      persist({ partner: updated });
      return true;
    } catch { flash("Couldn't save — try again"); return false; }
  };

  const addOffer = async () => {
    if (!partner || !offerForm.prize.trim() || !parseInt(offerForm.need)) return;
    const codes = offerForm.codes.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean).slice(0, 200);
    const offer = {
      id: uid(),
      prize: offerForm.prize.trim().slice(0, 90),
      metric: offerForm.metric,
      need: Math.max(1, Math.min(99, parseInt(offerForm.need))),
      codes, used: 0,
      note: offerForm.note.trim().slice(0, 120),
    };
    const ok = await savePartner({ ...partner, offers: [...(partner.offers || []), offer] });
    if (ok) {
      setOfferForm({ prize: "", metric: "chapters", need: "", codes: "", note: "" });
      setShowOfferForm(false);
      flash("Offer published — teachers with your code can add it now 🎁");
    }
  };

  const removeOffer = (id) => {
    if (!partner) return;
    savePartner({ ...partner, offers: (partner.offers || []).filter((o) => o.id !== id) });
  };

  // Teachers look up a partner and attach one of their offers to a class
  const lookupPartner = async () => {
    const code = partnerCodeInput.trim().toUpperCase();
    if (code.length < 4) return;
    setPartnerBusy(true);
    setFoundPartner(null);
    try {
      const rec = JSON.parse((await storage.get(`partner:${code}`, true)).value);
      if (!rec?.offers?.length) flash("That shop hasn't published any offers yet");
      setFoundPartner(rec);
    } catch {
      flash("No shop found with that code — check with them");
    }
    setPartnerBusy(false);
  };

  const attachPartnerOffer = async (shop, offer) => {
    if (!teaching) return;
    const claimed = offer.codes && offer.codes.length ? offer.codes[0] : "";
    const reward = {
      id: uid(),
      prize: `${offer.prize} — ${shop.name}`,
      metric: offer.metric,
      need: offer.need,
      code: claimed,
      partner: shop.name,
      partnerCity: shop.city,
    };
    const updated = { ...teaching, rewards: [...(teaching.rewards || []), reward] };
    try {
      await createClassRecord(updated);
      persist({ teaching: updated });
      // hand that code out so two classes don't get the same one
      if (offer.codes?.length) {
        const rest = { ...shop, offers: shop.offers.map((o) => o.id === offer.id ? { ...o, codes: o.codes.slice(1), used: (o.used || 0) + 1 } : o) };
        await storage.set(`partner:${shop.code}`, JSON.stringify(rest), true);
        setFoundPartner(rest);
      }
      flash(`Added — your class can now earn "${offer.prize}" at ${shop.name} 🎁`);
    } catch { flash("Couldn't add it — try again"); }
  };

  // ----- Multiple classes: switch between them, close one without losing the rest -----
  const switchClass = async (code) => {
    const c = (classes || []).find((x) => x.code === code);
    if (!c) return;
    setRoster(null);
    setQuizBank({});
    persist({ teaching: c });
    try {
      const fresh = await fetchClassRecord(code);
      if (fresh) persist({ teaching: fresh });
      setRoster(await fetchRoster(code));
    } catch { /* dashboard still renders */ }
  };
  const closeClass = (code) => {
    const rest = (classes || []).filter((x) => x.code !== code);
    setRoster(null);
    persist({ classes: rest, teaching: rest[0] || null });
    flash(rest.length ? "Class closed — switched to your other class" : "Class closed on this device");
  };

  // ----- Conference notes: the thing research says actually works -----
  useEffect(() => {
    if (!teaching?.code) return;
    (async () => {
      try {
        const r = await storage.get(`notes:${teaching.code}`, false);
        setNotes(JSON.parse(r.value) || {});
      } catch { /* none yet */ }
    })();
  }, [teaching?.code]);

  const saveNote = async (name) => {
    const text = (noteDraft[name] || "").trim().slice(0, 400);
    const next = { ...notes, [name]: text };
    if (!text) delete next[name];
    setNotes(next);
    setNoteDraft((d) => ({ ...d, [name]: undefined }));
    try { await storage.set(`notes:${teaching.code}`, JSON.stringify(next), false); flash("Note saved 📝"); }
    catch { flash("Couldn't save the note"); }
  };

  // ----- Any text: a pasted passage, article or primary source becomes a reading -----
  const saveClassText = async () => {
    if (!teaching || !textForm.title.trim() || textForm.body.trim().length < 40) return;
    const updated = {
      ...teaching,
      customText: { title: textForm.title.trim().slice(0, 90), body: textForm.body.trim().slice(0, 60000) },
    };
    try {
      await createClassRecord(updated);
      persist({ teaching: updated });
      setTextForm({ title: "", body: "" });
      setShowTextForm(false);
      flash("Text posted — your readers can open it now 📄");
    } catch { flash("Couldn't save — try again"); }
  };
  const removeClassText = async () => {
    if (!teaching) return;
    const updated = { ...teaching };
    delete updated.customText;
    try { await createClassRecord(updated); persist({ teaching: updated }); } catch { flash("Couldn't remove it"); }
  };

  // ----- Homework: AI drafts it, the TEACHER approves it, the app grades it -----
  const hwKindsFor = () => lvl(teaching).hwKinds;

  const draftHomework = async () => {
    const ch = parseInt(hwForm.chapter);
    if (!teaching || !ch) return;
    const n = Math.max(2, Math.min(8, parseInt(hwForm.count) || 4));
    setHwDraft({ loading: true, chapter: ch, due: hwForm.due, kind: hwForm.kind });
    try {
      const L = lvl(teaching);
      const kinds = L.hwKinds;
      const audience = L.homeworkFor === "family"
        ? "This is written FOR THE GROWN-UP to do with the child, not for the child to complete alone."
        : L.homeworkFor === "both"
        ? "A grown-up may read the questions aloud. Keep instructions simple enough for either to follow."
        : "The student completes this independently.";
      const src = teaching.customText;
      const excerpt = src ? `\n\nTHE TEXT ITSELF (base every question on this):\n"""${src.body.slice(0, 6000)}"""\n` : "";
      const text = await askTool(`Create reading homework ${src ? `about "${src.title}"` : `for ${L.unit} ${ch} of "${teaching.book}"`}${excerpt}${teaching.bookAuthor ? ` by ${teaching.bookAuthor}` : ""}.

READER LEVEL: ${L.label}. ${L.ai}
${audience}
FOCUS: ${kinds[hwForm.kind] || Object.values(kinds)[0]}
Make exactly ${n} items. If unsure of that exact ${L.unit}, ask about the story up to that point.

Each item is either type "mc" (4 options, one correct) or type "open" (a written answer, no single right answer). For every "open" item include a short "lookFor" note describing what a good answer contains, used only for feedback.

Respond with ONLY JSON, no markdown:
{"title":"short homework title","items":[{"type":"mc","q":"...","options":["..","..","..",".."],"answer":0},{"type":"open","q":"...","lookFor":"..."}]}`, 1200);
      const parsed = JSON.parse(text.replace(/\u0060\u0060\u0060json|\u0060\u0060\u0060/g, "").trim());
      if (!parsed?.items?.length) throw new Error("bad");
      setHwDraft({ loading: false, chapter: ch, due: hwForm.due, kind: hwForm.kind, title: parsed.title || `Chapter ${ch} homework`, items: parsed.items.slice(0, 8) });
    } catch {
      flash("Couldn't draft that — try again");
      setHwDraft(null);
    }
  };

  const blankHomework = () => {
    const ch = parseInt(hwForm.chapter) || 1;
    setHwDraft({
      loading: false, chapter: ch, due: hwForm.due, kind: "custom", mine: true,
      title: `${lvl(teaching).Unit} ${ch} homework`,
      items: [{ type: "open", q: "", lookFor: "" }],
    });
  };

  const addHwItem = (type) => {
    if (!hwDraft) return;
    const item = type === "mc"
      ? { type: "mc", q: "", options: ["", "", "", ""], answer: 0 }
      : { type: "open", q: "", lookFor: "" };
    setHwDraft({ ...hwDraft, items: [...hwDraft.items, item] });
  };

  const publishHomework = async () => {
    if (!teaching || !hwDraft?.items) return;
    const clean = hwDraft.items.filter((it) => (it.q || "").trim() && (it.type !== "mc" || it.options.every((o) => (o || "").trim())));
    if (!clean.length) { flash("Add at least one question with text first"); return; }
    const hw = {
      id: uid(), chapter: hwDraft.chapter, due: hwDraft.due || "",
      title: hwDraft.title, items: clean, at: Date.now(),
    };
    const updated = { ...teaching, homework: [...(teaching.homework || []), hw] };
    try {
      await createClassRecord(updated);
      persist({ teaching: updated });
      setHwDraft(null); setHwShow(false);
      setHwForm({ chapter: "", due: "", kind: "comprehension", count: "4" });
      flash("Homework posted — your readers see it now 📝");
    } catch { flash("Couldn't post it — try again"); }
  };

  const deleteHomework = async (id) => {
    if (!teaching) return;
    const updated = { ...teaching, homework: (teaching.homework || []).filter((h) => h.id !== id) };
    try { await createClassRecord(updated); persist({ teaching: updated }); } catch { flash("Couldn't remove it"); }
  };

  // Student submits; multiple choice is instant, written answers get AI feedback
  const submitHomework = async () => {
    if (!hwDoing || !classroom) return;
    setHwDoing({ ...hwDoing, grading: true });
    const items = hwDoing.items;
    let correct = 0, mcCount = 0;
    items.forEach((it, i) => {
      if (it.type === "mc") { mcCount += 1; if (hwDoing.answers[i] === it.answer) correct += 1; }
    });
    // AI feedback on written answers — encouraging, never a grade
    let feedback = [];
    const opens = items.map((it, i) => ({ it, i })).filter((x) => x.it.type === "open" && (hwDoing.answers[x.i] || "").trim());
    if (opens.length) {
      try {
        const text = await askTool(`A beginner reader answered written questions about "${classroom.book}". For each, write ONE encouraging sentence of feedback: name something specific they did well, and if useful add a gentle nudge. Never grade, never say wrong.\n\n${opens.map((x, k) => `${k + 1}. Question: ${x.it.q}\nWhat a good answer includes: ${x.it.lookFor || "any thoughtful response"}\nTheir answer: ${hwDoing.answers[x.i]}`).join("\n\n")}\n\nRespond with ONLY a JSON array of strings, one per question, in order.`, 700);
        feedback = JSON.parse(text.replace(/\u0060\u0060\u0060json|\u0060\u0060\u0060/g, "").trim());
      } catch { feedback = opens.map(() => "Thanks for writing this out — your teacher will read it."); }
    }
    const earned = correct * 5 + opens.length * 5;
    const submission = {
      hwId: hwDoing.id, answers: hwDoing.answers, correct, mcCount,
      written: opens.map((x, k) => ({ q: x.it.q, a: hwDoing.answers[x.i], fb: feedback[k] || "" })),
      at: Date.now(),
    };
    const subs = { ...(classroom.homeworkDone || {}), [hwDoing.id]: submission };
    persist({ classroom: { ...classroom, homeworkDone: subs }, points: points + earned, readLog: logActivity({ qz: 1 }) });
    setHwDoing({ ...hwDoing, grading: false, done: true, correct, mcCount, earned, feedback, opens });
    if (!mcCount || correct >= mcCount - 1) celebrate();
    try {
      const wk = (latestRef.current.readLog || []).slice(-7).reduce((a, x) => a + (x.min || 0), 0);
      await publishClassProgress(classroom.code, {
        name: classroom.name, chapter: classroom.chapter, quizzes: classroom.quizzes || {},
        homeworkDone: subs, minWeek: wk, wcpm: (latestRef.current.fluency || []).slice(-1)[0]?.wcpm || 0, updatedAt: Date.now(),
      });
    } catch { /* syncs next time */ }
  };

  // ----- Assignments: "read ch. 3 by Friday" -----
  const saveAssignment = async () => {
    const ch = parseInt(assignForm.chapter);
    if (!teaching || !ch || !assignForm.due) return;
    const a = { id: uid(), chapter: Math.max(1, Math.min(99, ch)), due: assignForm.due, note: assignForm.note.trim().slice(0, 120) };
    const updated = { ...teaching, assignments: [...(teaching.assignments || []), a].sort((x, y) => x.due.localeCompare(y.due)) };
    try {
      await createClassRecord(updated);
      persist({ teaching: updated });
      setAssignForm({ chapter: "", due: "", note: "" });
      setShowAssignForm(false);
      flash("Assignment posted — your readers see it now 📋");
    } catch { flash("Couldn't save — try again"); }
  };
  const deleteAssignment = async (id) => {
    if (!teaching) return;
    const updated = { ...teaching, assignments: (teaching.assignments || []).filter((a) => a.id !== id) };
    try { await createClassRecord(updated); persist({ teaching: updated }); } catch { flash("Couldn't remove it"); }
  };
  const dueLabel = (due) => {
    const d = new Date(due + "T12:00:00");
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const days = Math.round((d - today) / 86400000);
    if (days < 0) return { text: `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`, late: true };
    if (days === 0) return { text: "today", soon: true };
    if (days === 1) return { text: "tomorrow", soon: true };
    return { text: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) };
  };

  // ----- Teacher tools: class message, chapter-count edit, quiz bank -----
  const saveNotice = async () => {
    if (!teaching) return;
    const updated = { ...teaching, notice: noticeDraft.trim().slice(0, 200) };
    try {
      await createClassRecord(updated);
      persist({ teaching: updated });
      flash(updated.notice ? "Message posted — your readers see it now 📣" : "Message cleared");
    } catch { flash("Couldn't save — try again"); }
  };
  const saveChapters = async () => {
    const n = Math.max(1, Math.min(99, parseInt(chaptersDraft) || 0));
    if (!teaching || !n) return;
    const updated = { ...teaching, chapters: n };
    try {
      await createClassRecord(updated);
      persist({ teaching: updated });
      setChaptersDraft("");
      flash(`Book length updated — ${n} chapters for everyone ✓`);
    } catch { flash("Couldn't save — try again"); }
  };
  const viewClassQuiz = async (n) => {
    if (quizBank[n]?.questions) { setQuizBank((qb) => ({ ...qb, [n]: { ...qb[n], isOpen: !qb[n].isOpen } })); return; }
    setQuizBank((qb) => ({ ...qb, [n]: { loading: true, isOpen: true } }));
    try {
      const pack = await getClassQuiz(teaching.code, teaching.book, n, teaching.customText?.body);
      setQuizBank((qb) => ({ ...qb, [n]: { questions: pack.mc, open: pack.open, isOpen: true, loading: false } }));
    } catch {
      setQuizBank((qb) => ({ ...qb, [n]: { loading: false, isOpen: false } }));
      flash("Couldn't load that quiz — try again");
    }
  };

  // ----- Custom class rewards (set by the teacher — or a partner bookstore via the teacher) -----
  const saveClassReward = async () => {
    if (!teaching || !rewardForm.prize.trim() || !parseInt(rewardForm.need)) return;
    const reward = {
      id: uid(),
      prize: rewardForm.prize.trim().slice(0, 80),
      metric: rewardForm.metric, // "chapters" | "quizzes"
      need: Math.max(1, Math.min(99, parseInt(rewardForm.need))),
      code: rewardForm.code.trim().slice(0, 30),
    };
    const updated = { ...teaching, rewards: [...(teaching.rewards || []), reward] };
    try {
      await createClassRecord(updated);
      persist({ teaching: updated });
      setRewardForm({ prize: "", metric: "chapters", need: "", code: "" });
      setShowRewardForm(false);
      flash("Class reward added — students see it right away 🎁");
    } catch {
      flash("Couldn't save the reward — try again");
    }
  };

  const deleteClassReward = async (id) => {
    if (!teaching) return;
    const updated = { ...teaching, rewards: (teaching.rewards || []).filter((r) => r.id !== id) };
    try {
      await createClassRecord(updated);
      persist({ teaching: updated });
    } catch {
      flash("Couldn't remove it — try again");
    }
  };

  // Students: refresh class info (book, chapters, rewards) whenever they open the Classroom tab
  useEffect(() => {
    if (tab !== "classroom" || !classroom?.code) return;
    fetchClassRecord(classroom.code).then((cls) => {
      if (!cls) return;
      setClassroom((prev) => (prev ? { ...prev, book: cls.book, bookAuthor: cls.bookAuthor, chapters: cls.chapters, rewards: cls.rewards || [], teacher: cls.teacher, className: cls.className, notice: cls.notice || "", assignments: cls.assignments || [], homework: cls.homework || [], level: cls.level || "g35", customText: cls.customText || null } : prev));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ----- Chapter quizzes (AI-generated per chapter; teacher sees the scores) -----
  // One quiz per chapter, shared by the whole class — every student gets the SAME questions
  const getClassQuiz = async (code, book, n, srcText) => {
    try {
      const r = await storage.get(`cq:${code}:${n}`, true);
      const cached = JSON.parse(r.value);
      if (Array.isArray(cached) && cached.length) return { mc: cached, open: "" };
      if (cached?.mc?.length) return cached;
    } catch { /* not generated yet */ }
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 700,
        messages: [{
          role: "user",
          content: `${srcText ? `Create a short reading check about this text:\n"""${String(srcText).slice(0, 6000)}"""\n` : `Create a short reading check for ${lvl(teaching || classroom).unit} ${n} of the book "${book}".`} READER LEVEL: ${lvl(teaching || classroom).label}. ${lvl(teaching || classroom).quizAi} ${lvl(teaching || classroom).ai} Friendly tone, not a test. If you are not confident about that exact chapter's contents, ask about the story up to that point that anyone who has read through chapter ${n} could answer.

Include exactly 3 multiple-choice questions (4 options each, one correct) AND exactly 1 open-ended thinking question that asks the reader to infer, predict, connect, or give an opinion with a reason (for example "Why do you think..." or "What would you have done...?"). There is no wrong answer to the thinking question.

Respond with ONLY a JSON object, no markdown:
{"mc":[{"q":"...","options":["...","...","...","..."],"answer":0}],"open":"..."}`,
        }],
      }),
    });
    const data = await response.json();
    const text = (data.content || []).filter((i) => i.type === "text").map((i) => i.text).join("\n");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    // Accept both the new {mc, open} shape and the older plain array
    const mc = Array.isArray(parsed) ? parsed : parsed.mc;
    const openQ = Array.isArray(parsed) ? "" : (parsed.open || "");
    const valid = Array.isArray(mc) && mc.length >= 2 && mc.every((q) => q.q && q.options?.length === 4);
    if (!valid) throw new Error("bad quiz");
    const payload = { mc: mc.slice(0, 3), open: openQ };
    try { await storage.set(`cq:${code}:${n}`, JSON.stringify(payload), true); } catch { /* still usable */ }
    return payload;
  };

  const startChapterQuiz = async (n) => {
    if (!classroom) return;
    setChapQuiz({ chapter: n, loading: true, questions: null, answers: [], submitted: false });
    try {
      const pack = await getClassQuiz(classroom.code, classroom.book, n, classroom.customText?.body);
      setChapQuiz((prev) => prev && { ...prev, loading: false, questions: pack.mc, openQ: pack.open, openAns: "" });
    } catch {
      flash("Couldn't load the chapter quiz — try again in a moment 🧠");
      setChapQuiz(null);
    }
  };;

  const submitChapterQuiz = async () => {
    if (!chapQuiz?.questions || !classroom) return;
    const score = chapQuiz.questions.reduce((s2, q, i) => s2 + (chapQuiz.answers[i] === q.answer ? 1 : 0), 0);
    const total = chapQuiz.questions.length;
    const prev = (classroom.quizzes || {})[chapQuiz.chapter];
    const earned = prev ? 0 : score * 5;
    const passed = score >= total - 1 || prev?.passed || false;
    const quizzes = { ...(classroom.quizzes || {}), [chapQuiz.chapter]: { score: Math.max(score, prev?.score || 0), total, passed, at: Date.now(), think: (chapQuiz.openAns || "").trim().slice(0, 400) || prev?.think || "" } };
    persist({ classroom: { ...classroom, quizzes }, points: points + earned, readLog: logActivity({ qz: 1 }) });
    setChapQuiz((c) => c && { ...c, submitted: true, score, earned });
    if (score >= total - 1) celebrate();
    try {
      const wk2 = (latestRef.current.readLog || []).slice(-7).reduce((a, x) => a + (x.min || 0), 0);
      await publishClassProgress(classroom.code, { name: classroom.name, chapter: classroom.chapter, quizzes, minWeek: wk2, words: (latestRef.current.myWords || []).slice(0, 25).map((w) => w.word), wcpm: (latestRef.current.fluency || []).slice(-1)[0]?.wcpm || 0, updatedAt: Date.now() });
    } catch { /* syncs next time */ }
  };

  const loadRoster = async (code) => {
    setRosterLoading(true);
    setRoster(await fetchRoster(code));
    setRosterLoading(false);
  };

  // Live snapshot of ALL persisted state, refreshed every render — persist()
  // reads from here so a save can never overwrite fields with stale values.
  const latestRef = useRef({});
  latestRef.current = { books, readDays, goalDays, quiz, points, quizResults, classroom, teaching, digitalShelf, myWords, voicePref, newsDigest, quizNudgeDismissed, readLog, fluency, classes, partner, family, famSeen, lastSpotlight, onboarded, userName, role };

  useEffect(() => {
    let alive = true;
    fetch("/api/speak?check=1")
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => { if (alive) setStudioAvailable(Boolean(d.available)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // If the reader closes by any route, or the tab changes, nothing keeps talking
  useEffect(() => {
    if (!reader) stopAllSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader === null]);
  useEffect(() => () => { try { window.speechSynthesis.cancel(); } catch { /* noop */ } }, []);

  const persist = (patch) => {
    const next = { ...latestRef.current, ...patch };
    // Any update to the active class flows into the teacher's class list
    if (patch.teaching && patch.classes === undefined) {
      const t = patch.teaching;
      const list = next.classes || [];
      next.classes = list.some((c) => c.code === t.code)
        ? list.map((c) => (c.code === t.code ? t : c))
        : [...list, t];
    }
    if (patch.voicePref2 !== undefined) next.voicePref = patch.voicePref2;
    next.voicePref2 = next.voicePref; // stored under this key
    latestRef.current = { ...next }; // rapid back-to-back saves see each other
    setBooks(next.books);
    setReadDays(next.readDays);
    setGoalDays(next.goalDays);
    setQuiz(next.quiz);
    setPoints(next.points);
    setQuizResults(next.quizResults);
    setClassroom(next.classroom);
    setTeaching(next.teaching);
    setDigitalShelf(next.digitalShelf);
    setMyWords(next.myWords);
    setVoicePref(next.voicePref2 || next.voicePref || "female");
    setStudioPref(next.studioPref === undefined ? null : next.studioPref);
    setNewsDigest(next.newsDigest !== undefined ? next.newsDigest : null);
    setQuizNudgeDismissed(next.quizNudgeDismissed || false);
    setReadLog(next.readLog || []);
    setFluency(next.fluency || []);
    setClasses(next.classes || []);
    setPartner(next.partner !== undefined ? next.partner : null);
    setFamily(next.family !== undefined ? next.family : null);
    setFamSeen(next.famSeen || 0);
    setLastSpotlight(next.lastSpotlight || "");
    setOnboarded(next.onboarded);
    setUserName(next.userName);
    setRole(next.role);
    saveShelf(next);
  };
  const withToday = (days) => (days.includes(todayKey()) ? days : [...days, todayKey()]);
  const markToday = () => {
    if (readDays.includes(todayKey())) {
      flash("Already logged today — nice consistency! ✓");
      return;
    }
    const nextDays = withToday(readDays);
    persist({ readDays: nextDays, points: points + 5 });
    const s = calcStreak(nextDays);
    const hit = REWARDS.find((r) => r.type === "streak" && r.need === s);
    flash(hit ? `+5 pts · ${s}-day streak — gift unlocked! 🎁` : `+5 pts · ${s}-day streak 🔥`);
  };
  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      flash(`Code: ${code}`);
    }
  };
  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };
  const celebrate = () => {
    setConfetti(true);
    setTimeout(() => setConfetti(false), 2600);
  };

  const addBook = (b) => {
    const book = {
      id: uid(),
      title: b.title.trim(),
      author: (b.author || "").trim(),
      pages: Math.max(1, parseInt(b.pages) || 100),
      status: b.status || "want",
      currentPage: 0,
      rating: 0,
      addedAt: Date.now(),
      finishedAt: null,
    };
    persist({ books: [book, ...books] });
    flash(`"${book.title}" added to your shelf`);
  };

  const updateBook = (id, patch) => {
    const nextBooks = books.map((b) => (b.id === id ? { ...b, ...patch } : b));
    const nextDays = "currentPage" in patch ? withToday(readDays) : readDays;
    const stamped = "currentPage" in patch ? nextBooks.map((b) => (b.id === id ? { ...b, lastReadAt: Date.now() } : b)) : nextBooks;
    persist({ books: stamped, readDays: nextDays });
  };
  const removeBook = (id) => persist({ books: books.filter((b) => b.id !== id) });
  const finishBook = (id) => {
    const doneBefore = books.filter((x) => x.status === "done").length;
    const nextBooks = books.map((x) =>
      x.id === id ? { ...x, status: "done", currentPage: x.pages, finishedAt: Date.now() } : x
    );
    persist({ books: nextBooks, readDays: withToday(readDays), points: points + 25 });
    const unlocked = REWARDS.some((r) => r.type === "books" && r.need === doneBefore + 1);
    celebrate();
    flash(unlocked ? "Finished! +25 pts & gift unlocked 🎁" : "Finished! +25 pts — check the For You tab for what's next 📖");
  };

  // ----- Book comprehension quizzes (AI-generated) -----
  const startBookQuiz = async (book) => {
    setBookQuiz({ bookId: book.id, title: book.title, loading: true, questions: null, answers: [], submitted: false });
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Create a 5-question multiple-choice quiz about the book "${book.title}"${book.author ? ` by ${book.author}` : ""}, for a beginner reader who just finished it. Questions should be answerable by anyone who read the book: plot, characters, big moments, themes. Friendly tone, not a test. Each question has exactly 4 options and exactly one correct answer. If you are not confident about this book's details, ask broader questions any reader of it could still answer. Respond with ONLY a JSON array, no markdown fences, no other text: [{"q": "...", "options": ["...", "...", "...", "..."], "answer": 0}] where "answer" is the index of the correct option.`,
          }],
        }),
      });
      const data = await response.json();
      const text = data.content.filter((i) => i.type === "text").map((i) => i.text).join("\n");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      const valid = Array.isArray(parsed) && parsed.length >= 3 && parsed.every((q) => q.q && q.options?.length === 4);
      if (!valid) throw new Error("Bad quiz format");
      setBookQuiz((prev) => prev && { ...prev, loading: false, questions: parsed.slice(0, 5) });
    } catch (e) {
      console.error(e);
      flash("Couldn't build a quiz for that book — try again");
      setBookQuiz(null);
    }
  };

  const submitBookQuiz = () => {
    if (!bookQuiz?.questions) return;
    const score = bookQuiz.questions.reduce((s, q, i) => s + (bookQuiz.answers[i] === q.answer ? 1 : 0), 0);
    const prev = quizResults[bookQuiz.bookId];
    const firstTry = !prev;
    const earned = firstTry ? score * 10 : 0;
    const passed = score >= 4 || prev?.passed || false;
    persist({
      points: points + earned,
      quizResults: {
        ...quizResults,
        [bookQuiz.bookId]: { score: Math.max(score, prev?.score || 0), total: bookQuiz.questions.length, passed, at: Date.now() },
      },
    });
    setBookQuiz((b) => b && { ...b, submitted: true, score, earned });
    if (score >= 4) celebrate();
  };

  const reading = books.filter((b) => b.status === "reading");
  const want = books.filter((b) => b.status === "want");
  const done = books.filter((b) => b.status === "done");
  const pagesRead = books.reduce((s, b) => s + (b.status === "done" ? b.pages : b.currentPage || 0), 0);
  const streak = calcStreak(readDays);
  const best = bestStreak(readDays);
  const weekCount = thisWeekCount(readDays);
  const readToday = readDays.includes(todayKey());
  const passedQuizzes = Object.values(quizResults).filter((r) => r.passed).length;
  const isUnlocked = (r) =>
    r.type === "streak" ? best >= r.need : r.type === "books" ? done.length >= r.need : passedQuizzes >= r.need;
  const unlockedCount = REWARDS.filter(isUnlocked).length;
  const { level, next: nextLevel } = levelFor(points);
  const myArch = quiz ? ARCHETYPES[topTag(scoreQuiz(quiz).tagScores)] : null;
  const onShelfTitles = useMemo(() => new Set(books.map((b) => b.title.toLowerCase())), [books]);

  // Live search: results appear as you type (no button press needed)
  useEffect(() => {
    if (tab !== "discover") return;
    const q = bookQuery.trim();
    if (q.length < 3) return;
    const t = setTimeout(() => { searchBooks(); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookQuery, tab]);

  // ----- Cover hunt: no book card should sit blank -----
  // Open Library results often arrive with no cover id. For those, quietly ask
  // Google Books for a thumbnail and pop it in when it lands (capped at 10
  // lookups per search so we stay polite with the API).
  const huntCovers = () => {
    setSearchResults((prev) => {
      const missing = (prev || []).filter((x) => x.title && !x.gbCover && !x.cover_i && !x.gutenId && !x.hunted).slice(0, 10);
      if (missing.length) setTimeout(() => {
        missing.forEach(async (doc) => {
          try {
            const q = `intitle:"${doc.title}"` + (doc.author_name?.[0] ? ` inauthor:"${doc.author_name[0]}"` : "");
            const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`);
            const d = await r.json();
            const th = d.items?.[0]?.volumeInfo?.imageLinks?.smallThumbnail?.replace("http://", "https://") || null;
            if (th) setSearchResults((cur) => (cur || []).map((x) => (x.key === doc.key ? { ...x, gbCover: th } : x)));
          } catch { /* the colored placeholder stays — still looks intentional */ }
        });
      }, 0);
      return (prev || []).map((x) => (missing.some((m) => m.key === x.key) ? { ...x, hunted: true } : x));
    });
  };

  // ----- Open Library book search (~40 million books, free, no key) -----
  const searchBooks = async () => {
    const q = bookQuery.trim();
    if (!q) return;
    setSubject(null);
    setSearching(true);
    setSearchResults([]);
    const mergeIn = (items) => {
      setSearchResults((prev) => {
        const seen = new Set((prev || []).map((x) => `${(x.title || "").toLowerCase()}|${((x.author_name || [])[0] || "").toLowerCase()}`));
        const merged = [...(prev || [])];
        for (const it of items) {
          const sig = `${(it.title || "").toLowerCase()}|${((it.author_name || [])[0] || "").toLowerCase()}`;
          if (it.title && !seen.has(sig)) { seen.add(sig); merged.push(it); }
        }
        return merged.slice(0, 24);
      });
    };
    // Google Books answers fast — render it the moment it lands
    const gbP = fetchT(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=16`, 7000)
      .then((r) => r.json())
      .then((d) => mergeIn((d.items || []).map((it) => {
        const v = it.volumeInfo || {};
        return {
          key: `gb-${it.id}`, title: v.title, author_name: v.authors || [],
          number_of_pages_median: v.pageCount || null,
          first_publish_year: (v.publishedDate || "").slice(0, 4) || null,
          gbCover: v.imageLinks?.smallThumbnail?.replace("http://", "https://") || null,
        };
      })))
      .catch(() => {});
    // Open Library adds depth when it (eventually) answers — capped at 8s
    const olP = fetchT(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15&fields=key,title,author_name,number_of_pages_median,cover_i,first_publish_year`, 8000)
      .then((r) => r.json())
      .then((d) => mergeIn(d.docs || []))
      .catch(() => {});
    // Stop the spinner as soon as the FIRST source answers
    await Promise.race([gbP, olP]);
    setSearching(false);
    Promise.allSettled([gbP, olP]).then(() => {
      huntCovers(); // fill in any coverless results in the background
      // Free-digital badges pop in last
      gutenbergLookup(q).then((glist) => {
        if (!glist || !glist.length) return;
        setSearchResults((prev) => (prev || []).map((doc) => {
          const g = matchGuten(glist, doc.title, (doc.author_name || [])[0] || "");
          return g ? { ...doc, gutenId: g.gid, gutenAuthor: g.author } : doc;
        }));
      });
    });
  };;

  // ----- "For you": recommendations based on a finished book (Open Library, free) -----
  const fetchRecs = async (book) => {
    setRecFor(book.id);
    if (recResults[book.id]) return; // cached
    setRecLoading(true);
    try {
      const seen = new Set([book.title.toLowerCase(), ...onShelfTitles]);
      const out = [];
      const fields = "key,title,author_name,number_of_pages_median,cover_i,first_publish_year";
      // 1) More from the same author
      if (book.author) {
        const r = await fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(book.author)}&limit=10&fields=${fields}`);
        const d = await r.json();
        for (const doc of d.docs || []) {
          const t = (doc.title || "").toLowerCase();
          if (t && !seen.has(t)) { seen.add(t); out.push({ ...doc, why: `More from ${book.author}` }); }
          if (out.length >= 4) break;
        }
      }
      // 2) Books about the same things
      const r1 = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&limit=1&fields=key`);
      const d1 = await r1.json();
      const workKey = d1.docs?.[0]?.key;
      if (workKey) {
        const r2 = await fetch(`https://openlibrary.org${workKey}.json`);
        const d2 = await r2.json();
        const subjects = (d2.subjects || []).filter((x) => typeof x === "string" && x.length < 28 && !/fiction$|places|times|reading level|accessible/i.test(x)).slice(0, 2);
        for (const sb of subjects) {
          const r3 = await fetch(`https://openlibrary.org/search.json?subject=${encodeURIComponent(sb)}&limit=8&fields=${fields}`);
          const d3 = await r3.json();
          for (const doc of d3.docs || []) {
            const t = (doc.title || "").toLowerCase();
            if (t && !seen.has(t)) { seen.add(t); out.push({ ...doc, why: `Also about ${sb.toLowerCase()}` }); }
            if (out.length >= 9) break;
          }
          if (out.length >= 9) break;
        }
      }
      setRecResults((prev) => ({ ...prev, [book.id]: out.slice(0, 9) }));
    } catch {
      flash("Couldn't fetch recommendations — try again in a moment");
    }
    setRecLoading(false);
  };

  const askClaudeNext = async (book) => {
    setAiNextLoading(true);
    const { tagScores, lang } = quiz ? scoreQuiz(quiz) : { tagScores: {}, lang: "en" };
    const likes = Object.entries(tagScores).sort((a, b) => b[1] - a[1]).map(([t]) => t).join(", ") || "unknown";
    const langNote = lang === "es" ? " Recommend Spanish-language books and write the 'why' in Spanish." : "";
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 800,
          messages: [{
            role: "user",
            content: `A beginner reader just FINISHED and loved "${book.title}"${book.author ? ` by ${book.author}` : ""}. Their general taste: ${likes}.${langNote} Recommend exactly 3 real books to read next based on that book. Do not recommend the same book or books by the same title. Respond with ONLY a JSON array, no markdown: [{"title":"...","author":"...","pages":123,"why":"one sentence linking it to the book they finished"}]`,
          }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).filter((i) => i.type === "text").map((i) => i.text).join("\n");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setAiNext((prev) => ({ ...prev, [book.id]: Array.isArray(parsed) ? parsed.slice(0, 3) : [] }));
    } catch {
      flash("AI picks need the API key (Monday!) — the suggestions above work now");
    }
    setAiNextLoading(false);
  };

  // ----- Digital shelf: search, add, and read public-domain books -----
  // ----- Free library: search, browse by genre, dig deeper -----
  const [freeGenre, setFreeGenre] = useState(null);
  const freeGenrePageRef = useRef({});
  const [freeMoreBusy, setFreeMoreBusy] = useState(false);

  const searchGutenberg = async (qOverride) => {
    const q = (typeof qOverride === "string" ? qOverride : gutenQuery).trim();
    if (!q) return;
    setFreeGenre(null);
    setGutenLoading(true);
    const list = await fetchGutenList({ q });
    setGutenResults(list.slice(0, 24));
    setGutenLoading(false);
  };

  const browseFreeGenre = async (entry) => {
    const [label, topic] = entry;
    setFreeGenre(label);
    setGutenQuery("");
    freeGenrePageRef.current[label] = 1;
    setGutenLoading(true);
    const es = topic === "__es__";
    const list = await fetchGutenList({ topic: es ? "" : topic, es });
    setGutenResults(list);
    setGutenLoading(false);
  };

  const loadMoreFree = async () => {
    if (!freeGenre || freeMoreBusy) return;
    const g = FREE_GENRES.find(([l]) => l === freeGenre);
    if (!g) return;
    setFreeMoreBusy(true);
    const page = (freeGenrePageRef.current[freeGenre] || 1) + 1;
    freeGenrePageRef.current[freeGenre] = page;
    const es = g[1] === "__es__";
    const list = await fetchGutenList({ topic: es ? "" : g[1], es, page });
    setGutenResults((prev) => {
      const seen = new Set((prev || []).map((x) => x.gid));
      return [...(prev || []), ...list.filter((x) => !seen.has(x.gid))];
    });
    setFreeMoreBusy(false);
  };

  // ----- Book text cache: a book downloads once, then opens instantly -----
  // Uses the browser Cache API (built for exactly this; localStorage is too
  // small for full novels). Also enables offline re-reading in the PWA.
  const fetchBookText = async (gid) => {
    const url = `/api/book?id=${gid}`;
    try {
      const cache = await caches.open("sl-books-v1");
      const hit = await cache.match(url);
      if (hit) {
        const d = await hit.json();
        if (d && d.text) return d;
      }
      const r = await fetch(url);
      if (!r.ok) throw new Error("bad status");
      const clone = r.clone();
      const d = await r.json();
      if (!d.text) throw new Error(d.error || "no text");
      cache.put(url, clone).catch(() => {}); // best-effort; reading still works
      return d;
    } catch {
      // Cache API unavailable (rare) — plain fetch still works
      const r = await fetch(url);
      const d = await r.json();
      if (!d.text) throw new Error(d.error || "no text");
      return d;
    }
  };
  // Warm the cache in the background so "Start reading" feels instant
  const prefetchBook = (gid) => { try { fetchBookText(gid).catch(() => {}); } catch { /* noop */ } };

  const addDigital = (b) => {
    if (digitalShelf.some((x) => x.gid === b.gid)) { flash("Already on your digital shelf ✓"); return; }
    prefetchBook(b.gid);
    const patch = { digitalShelf: [{ gid: b.gid, title: b.title, author: b.author, cover: b.cover || null, pos: 0 }, ...digitalShelf] };
    // Also add a linked book to My Shelf — reading progress syncs automatically
    if (!books.some((x) => x.gid === b.gid)) {
      patch.books = [{
        id: uid(), gid: b.gid, title: b.title, author: b.author || "",
        pages: 100, status: "reading", currentPage: 0, rating: 0, addedAt: Date.now(), finishedAt: null,
      }, ...books];
    }
    persist(patch);
    flash(`"${b.title}" added to both shelves — progress syncs as you read 📱`);
  };

  const removeDigital = (gid) => persist({ digitalShelf: digitalShelf.filter((x) => x.gid !== gid) });

  // ----- Voice picker: hunts down the most natural voice on this device -----
  const FEMALE_HINTS = ["aria", "jenny", "michelle", "emma", "ava", "sonia", "libby", "samantha", "zira", "susan", "natasha", "joanna", "salli", "allison", "paulina", "helena", "sabina", "dalia", "female", "google us english", "google espa"];
  const MALE_HINTS = ["guy", "davis", "andrew", "brian", "christopher", "eric", "roger", "daniel", "alex", "david", "mark", "george", "ryan", "jorge", "diego", "miguel", "male"];
  const pickVoice = (langPrefix) => {
    if (voicePref === "system") return null; // the default voice always makes sound — that wins
    const lp = (langPrefix || "en").toLowerCase().slice(0, 2);
    // FRESH list at the moment of speaking — cached voice objects can go stale
    // and stale voices fail silently (the great sound mystery of this app).
    const all = window.speechSynthesis?.getVoices?.() || [];
    // Prefer the prettiest voice available RIGHT NOW (fresh objects); the
    // watchdog in safeSpeak falls back to the default voice if one plays silent.
    const pool = all.filter((v) => v.lang?.toLowerCase().startsWith(lp));
    const candidates = pool.length ? pool : all;
    if (!candidates.length) return null;
    const hints = voicePref === "male" ? MALE_HINTS : FEMALE_HINTS;
    const antiHints = voicePref === "male" ? FEMALE_HINTS : MALE_HINTS;
    let best = null, bestScore = -1;
    for (const v of candidates) {
      const n = (v.name || "").toLowerCase();
      let sc = 0;
      if (n.includes("natural")) sc += 8;
      if (n.includes("neural")) sc += 8;
      if (n.includes("premium") || n.includes("enhanced")) sc += 5;
      if (v.localService) sc += 2;
      if (hints.some((h) => n.includes(h))) sc += 6;
      if (antiHints.some((h) => n.includes(h))) sc -= 6;
      if (sc > bestScore) { bestScore = sc; best = v; }
    }
    return best;
  };

  // Robust speech: Chrome swallows speak() right after cancel(), gets stuck in a
  // paused state, garbage-collects utterances mid-speech, and some premium voices
  // fail silently. This wrapper works around all four, retrying once with the
  // default voice if the fancy one produces nothing.
  const safeSpeak = (u) => {
    try {
      window.__slU = u; // hold a reference so Chrome's GC can't eat it mid-speech
      let spoke = false;
      const origBoundary = u.onboundary;
      u.onboundary = (e) => { spoke = true; if (origBoundary) origBoundary(e); };
      const origStart = u.onstart;
      u.onstart = () => { spoke = true; if (origStart) origStart(); };

      // CRITICAL: cancel + speak SYNCHRONOUSLY inside the user's tap.
      // Any setTimeout before the first speak() breaks the gesture chain on
      // phones and produces total silence.
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume(); // un-stick a paused engine (iOS/Chrome quirk)
      window.speechSynthesis.speak(u);

      // Chrome desktop pauses long utterances after ~15s with some voices —
      // a periodic resume keeps it talking. Harmless elsewhere.
      const keepAlive = setInterval(() => {
        if (!window.speechSynthesis.speaking) { clearInterval(keepAlive); return; }
        window.speechSynthesis.resume();
      }, 5000);

      // Watchdog: if nothing was heard shortly after, retry once with the
      // device's DEFAULT voice (a flaky premium voice is the usual culprit).
      setTimeout(() => {
        if (spoke || u.__retried) return;
        u.__retried = true;
        try {
          window.speechSynthesis.cancel();
          const r = new SpeechSynthesisUtterance(u.text);
          r.lang = u.lang; r.rate = u.rate; r.pitch = u.pitch;
          r.onboundary = (e) => { spoke = true; if (origBoundary) origBoundary(e); };
          r.onstart = () => { spoke = true; };
          r.onend = u.onend; r.onerror = u.onerror;
          window.__slU = r;
          window.speechSynthesis.resume();
          window.speechSynthesis.speak(r);
        } catch { /* noop */ }
        // Still nothing? The device itself is muting us — say so.
        setTimeout(() => {
          if (!spoke) flash("Can't hear anything? Check your phone's silent switch & media volume 🔈");
        }, 1500);
      }, 900);
    } catch { /* noop */ }
  };

  const speakRangeStudio = async (from, to) => {
    if (!premiumVoice || !reader?.pages?.length) return false;
    const text = reader.pages[reader.page].slice(from, to);
    return playStudio({ text });
  };

  const speakRange = (start, end) => {
    if (!reader?.pages?.length) return;
    try {
      const page = reader.pages[reader.page];
      const text = page.slice(start, end);
      if (!text.trim()) return;
      const u = new SpeechSynthesisUtterance(text);
      const accents = (text.match(/[áéíóúñü]/gi) || []).length;
      u.lang = accents > 4 ? "es-ES" : "en-US";
      const v = pickVoice(u.lang, voicePref);
      if (v) u.voice = v;
      u.rate = 0.92;
      u.pitch = 1.0;
      u.onboundary = (e) => {
        if (e.charIndex !== undefined) setReadAlong({ on: true, char: start + e.charIndex });
      };
      u.onend = () => setReadAlong({ on: false, char: -1 });
      u.onerror = () => setReadAlong({ on: false, char: -1 });
      setReadAlong({ on: true, char: start });
      safeSpeak(u);
    } catch {
      flash("Read-aloud isn't available in this browser");
    }
  };
  // ----- Premium narration: a studio voice, cached per page so it's paid once -----
  // Every audio request carries a generation number. Stopping bumps it, so a
  // narration that finishes downloading AFTER you pressed stop is discarded
  // instead of playing over the top of whatever you did next.
  const audioGen = useRef(0);

  const stopAudio = () => {
    audioGen.current += 1;                    // invalidate anything in flight
    const a = window.__slAudio;
    if (a) {
      try { a.pause(); a.currentTime = 0; a.src = ""; } catch { /* noop */ }
      if (a.__url) { try { URL.revokeObjectURL(a.__url); } catch { /* noop */ } }
    }
    window.__slAudio = null;
    setAudioBusy(false);
  };

  // When true, finishing a page rolls straight into the next one.
  const autoRead = useRef(false);
  // Callbacks fire long after render, so they must read the CURRENT reader,
  // not the one captured when the callback was created.
  const readerRef = useRef(null);
  readerRef.current = reader;

  // Silence everything the app can make sound with, in one call.
  const stopAllSpeech = () => {
    autoRead.current = false;
    stopAudio();
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    window.__slU = null;
    setReadAlong({ on: false, char: -1 });
  };

  // Try the studio voice for any audio the app makes. Returns false if it
  // can't, so the caller falls back to the device voice.
  const playStudio = async (opts) => {
    if (!premiumVoice) return false;
    stopAllSpeech();                       // never layer on top of existing audio
    const myGen = audioGen.current;        // claim this generation
    setAudioBusy(true);
    try {
      const v = voicePref === "male" ? "m" : "f";
      const r = opts.word
        ? await fetch(`/api/speak?word=${encodeURIComponent(opts.word)}&voice=${v}`)
        : await fetch("/api/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: String(opts.text || "").slice(0, 4000), voice: v }),
          });
      if (audioGen.current !== myGen) return true;   // user stopped: drop it, don't fall back
      if (!r.ok) { setAudioBusy(false); return false; }
      const blob = await r.blob();
      if (audioGen.current !== myGen) return true;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.__url = url;
      window.__slAudio = audio;
      audio.onended = () => {
        if (audio.__url) { try { URL.revokeObjectURL(audio.__url); } catch { /* noop */ } }
        window.__slAudio = null;
        setAudioBusy(false);
        setReadAlong({ on: false, char: -1 });
      };
      audio.onerror = () => { setAudioBusy(false); setReadAlong({ on: false, char: -1 }); };
      await audio.play();
      return true;
    } catch {
      setAudioBusy(false);
      return false;
    }
  };

  const playPremium = async () => {
    if (!reader?.pages?.length) return false;
    // Pasted class texts have no catalogue id — send the page text instead
    if (reader.isText || String(reader.gid).startsWith("text:")) {
      setAudioBusy(true);
      const ok = await playStudio({ text: reader.pages[reader.page] });
      setAudioBusy(false);
      if (ok) setReadAlong({ on: true, char: -1 });
      return ok;
    }
    setAudioBusy(true);
    try {
      const url = `/api/speak?gid=${encodeURIComponent(reader.gid)}&page=${reader.page}&voice=${voicePref === "male" ? "m" : "f"}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      window.__slAudio = audio;
      audio.onended = () => { window.__slAudio = null; setAudioBusy(false); setReadAlong({ on: false, char: -1 }); };
      audio.onerror = () => { setAudioBusy(false); setReadAlong({ on: false, char: -1 }); };
      setReadAlong({ on: true, char: -1 });
      await audio.play();
      return true;
    } catch {
      setAudioBusy(false);
      flash("Studio voice unavailable — using the device voice");
      return false;
    }
  };

  // ----- Continuous narration: keeps going page after page until you stop it -----
  const readOnFrom = async (fromChar, pageOverride) => {
    const rd = readerRef.current;
    if (!rd?.pages?.length) return;
    const pageIdx = pageOverride === undefined ? rd.page : pageOverride;
    if (pageIdx < 0 || pageIdx >= rd.pages.length) return;

    stopAllSpeech();
    autoRead.current = true;
    const myGen = audioGen.current;
    const pageText = rd.pages[pageIdx];
    const isWholePage = fromChar <= 0;

    // Roll onto the next page — computed from the page we just READ, never
    // from a captured render, so it can't rewind or stall.
    const onFinished = () => {
      if (!autoRead.current || audioGen.current !== myGen) return;
      const cur = readerRef.current;
      if (!cur || pageIdx >= cur.pages.length - 1) {
        autoRead.current = false;
        setReadAlong({ on: false, char: -1 });
        flash("That's the end — nicely done 📖");
        return;
      }
      const nextPage = pageIdx + 1;
      turnPage(1, true);
      setTimeout(() => {
        if (!autoRead.current || audioGen.current !== myGen) return;
        readOnFrom(0, nextPage);
      }, 140);
    };

    if (premiumVoice) {
      setAudioBusy(true);
      try {
        const v = voicePref === "male" ? "m" : "f";
        const canCache = isWholePage && !rd.isText && !String(rd.gid).startsWith("text:");
        const r = canCache
          ? await fetch(`/api/speak?gid=${encodeURIComponent(rd.gid)}&page=${pageIdx}&voice=${v}`)
          : await fetch("/api/speak", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: pageText.slice(fromChar).slice(0, 4000), voice: v }),
            });
        if (audioGen.current !== myGen) return;
        if (r.ok) {
          const url = URL.createObjectURL(await r.blob());
          if (audioGen.current !== myGen) { try { URL.revokeObjectURL(url); } catch { /* noop */ } return; }
          const audio = new Audio(url);
          audio.__url = url;
          window.__slAudio = audio;
          setReadAlong({ on: true, char: -1 });
          audio.onended = () => {
            try { URL.revokeObjectURL(url); } catch { /* noop */ }
            window.__slAudio = null; setAudioBusy(false);
            setReadAlong({ on: false, char: -1 });
            onFinished();
          };
          audio.onerror = () => { setAudioBusy(false); setReadAlong({ on: false, char: -1 }); autoRead.current = false; };
          await audio.play();
          return;
        }
      } catch { /* fall through to the device voice */ }
      setAudioBusy(false);
      if (audioGen.current !== myGen) return;
    }

    try {
      const text = pageText.slice(fromChar);
      const u = new SpeechSynthesisUtterance(text);
      const accents = (text.match(/[áéíóúñü]/gi) || []).length;
      u.lang = accents > 4 ? "es-ES" : "en-US";
      const bv = pickVoice(u.lang);
      if (bv) u.voice = bv;
      u.rate = 0.92; u.pitch = 1.0;
      u.onboundary = (e) => {
        if (e.charIndex !== undefined) setReadAlong({ on: true, char: fromChar + e.charIndex });
      };
      u.onend = () => { setReadAlong({ on: false, char: -1 }); onFinished(); };
      u.onerror = () => { setReadAlong({ on: false, char: -1 }); autoRead.current = false; };
      setReadAlong({ on: true, char: fromChar });
      safeSpeak(u);
    } catch {
      setReadAlong({ on: false, char: -1 });
      autoRead.current = false;
    }
  };

  const startReadAlong = () => {
    if (!reader?.pages?.length) return;
    speakRange(0, reader.pages[reader.page].length);
  };
  const stopReadAlong = () => {
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    setReadAlong({ on: false, char: -1 });
  };

  // ----- Practice reading out loud: speech recognition checks the words -----
  const normW = (w) => (w || "").toLowerCase().replace(/[^a-záéíóúñü']/gi, "");
  const startPractice = () => {
    if (!reader?.pages?.length) return;
    stopReadAlong();
    // Take the first ~30 words of the current page as the passage
    const words = reader.pages[reader.page].split(/\s+/).filter((w) => /\S/.test(w)).slice(0, 60);
    setPractice({ passage: words.join(" "), words, listening: false, matched: null, done: false });
  };
  const listenPractice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { flash("Voice practice needs Chrome or Edge — read-to-me still works everywhere!"); return; }
    try {
      const rec = new SR();
      const accents = (practice.passage.match(/[áéíóúñü]/gi) || []).length;
      rec.lang = accents > 2 ? "es-ES" : "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = true;
      let heard = "";
      rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) heard += " " + e.results[i][0].transcript; };
      rec.onerror = () => { setPractice((pr) => pr && { ...pr, listening: false }); flash("Mic hiccup — check mic permission and try again"); };
      rec.onend = () => {
        const secs = Math.max(5, Math.round((Date.now() - (window.__slProbeStart || Date.now())) / 1000));
        setPractice((pr) => {
          if (!pr) return pr;
          const heardSet = new Set(heard.split(/\s+/).map(normW).filter(Boolean));
          const matched = pr.words.map((w) => heardSet.has(normW(w)));
          const hits = matched.filter(Boolean).length;
          const pctHit = Math.round((hits / pr.words.length) * 100);
          // Words Correct Per Minute — the standard oral reading fluency measure
          const wcpm = Math.round((hits / secs) * 60);
          const today = new Date().toISOString().slice(0, 10);
          const hist = [...(latestRef.current.fluency || []).filter((f) => f.d !== today), { d: today, wcpm, acc: pctHit, words: pr.words.length }].slice(-60);
          persist({ points: points + 5, readDays: withToday(readDays), fluency: hist });
          if (pctHit >= 70) celebrate();
          return { ...pr, listening: false, matched, pct: pctHit, wcpm, secs, done: true };
        });
      };
      window.__slProbeStart = Date.now();
      setPractice((pr) => pr && { ...pr, listening: true, matched: null, done: false });
      rec.start();
      // auto-stop after 30 seconds
      setTimeout(() => { try { rec.stop(); } catch { /* noop */ } }, 30000);
      window.__slRec = rec; // so the Stop button can end it
    } catch {
      flash("Couldn't start the microphone");
    }
  };
  const stopListening = () => { try { window.__slRec?.stop(); } catch { /* noop */ } };

  // ----- Sentences: tap one to hear the page from there, and remember the spot -----
  const sentenceAt = (page, charIdx) => {
    const re = /[^.!?\u2026]*[.!?\u2026]+["'\u201d\u2019)\]]*\s*|[^.!?\u2026]+$/g;
    let m;
    while ((m = re.exec(page)) !== null) {
      const start = m.index, end = start + m[0].length;
      if (charIdx >= start && charIdx < end) return { start, end };
      if (start > charIdx) break;
    }
    return { start: charIdx, end: page.length };
  };

  const saveMark = (charIdx) => {
    if (!reader) return;
    const mark = { page: reader.page, char: charIdx };
    setReader((r) => r && { ...r, mark });
    persist({
      digitalShelf: (latestRef.current.digitalShelf || []).map((x) =>
        x.gid === reader.gid ? { ...x, pos: reader.page, mark } : x),
    });
  };

  const readFromHere = async (charIdx) => {
    if (!reader?.pages?.length) return;
    const page = reader.pages[reader.page];
    const { start } = sentenceAt(page, charIdx);
    saveMark(start);
    readOnFrom(start);
  };

  // ----- Word helper: tap a word to hear it and see its meaning -----
  const speakWord = (word) => {
    stopAllSpeech();
    if (premiumVoice) {
      const myGen = audioGen.current;
      playStudio({ word }).then((ok) => {
        if (!ok && audioGen.current === myGen) deviceSpeakWord(word);
      });
      return;
    }
    deviceSpeakWord(word);
  };

  const deviceSpeakWord = (word) => {
    try {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = /[áéíóúñü]/i.test(word) ? "es-ES" : "en-US";
      const v = pickVoice(u.lang, voicePref);
      if (v) u.voice = v;
      u.rate = 0.85;
      u.pitch = 1.0;
      safeSpeak(u);
    } catch { /* some browsers block speech; the card still shows meaning */ }
  };

  const saveWord = (word, definition) => {
    if (myWords.some((w) => w.word === word)) return;
    persist({ myWords: [{ word, definition: definition.slice(0, 160), at: Date.now() }, ...myWords].slice(0, 300) });
  };

  const lookupWord = async (raw) => {
    const word = (raw || "").toLowerCase().replace(/[^a-záéíóúñü'-]/gi, "");
    if (!word || word.length < 2) return;
    setWordCard({ word, loading: true });
    speakWord(word);

    // Layer 1 + 2: free dictionary, trying the word and its common stems
    const stems = [word];
    if (word.endsWith("ies")) stems.push(word.slice(0, -3) + "y");
    if (word.endsWith("es")) stems.push(word.slice(0, -2));
    if (word.endsWith("s")) stems.push(word.slice(0, -1));
    if (word.endsWith("ed")) { stems.push(word.slice(0, -2)); stems.push(word.slice(0, -1)); }
    if (word.endsWith("ing")) { stems.push(word.slice(0, -3)); stems.push(word.slice(0, -3) + "e"); }
    if (word.endsWith("ly")) stems.push(word.slice(0, -2));
    if (word.endsWith("er")) stems.push(word.slice(0, -2));
    if (word.endsWith("est")) stems.push(word.slice(0, -3));

    for (const w of [...new Set(stems)]) {
      try {
        const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
        if (!r.ok) continue;
        const d = await r.json();
        const entry = Array.isArray(d) ? d[0] : null;
        const meaning = entry?.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition;
        if (def) {
          setWordCard({
            word,
            phonetic: entry.phonetic || (entry.phonetics || []).find((x) => x.text)?.text || "",
            pos: meaning.partOfSpeech || "",
            definition: def + (w !== word ? ` (from "${w}")` : ""),
            loading: false,
          });
          saveWord(word, def);
          return;
        }
      } catch { /* try next */ }
    }

    // Layer 3: ask Claude — handles Spanish, old-timey words, names, anything
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 150,
          messages: [{
            role: "user",
            content: `${classroom ? lvl(classroom).wordAi : "In ONE short, simple sentence, explain the word for a beginner reader."} The word is "${word}". If it is a Spanish word, explain it in simple Spanish. If it looks like a name or a made-up word from a story, briefly say so. Respond with only that one sentence — no preamble, no quotes.`,
          }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).filter((x) => x.type === "text").map((x) => x.text).join(" ").trim();
      if (text) {
        setWordCard({ word, definition: text, pos: "", phonetic: "", ai: true, loading: false });
        saveWord(word, text);
        return;
      }
    } catch { /* fall through */ }

    setWordCard({ word, notFound: true, loading: false });
  };

  // Paginate any raw text into reader pages
  const paginate = (text) => {
    const pages = [];
    let i = 0;
    while (i < text.length) {
      let end = Math.min(i + 1600, text.length);
      if (end < text.length) {
        const brk = text.lastIndexOf("\n", end);
        const sp = text.lastIndexOf(" ", end);
        end = Math.max(brk, sp) > i + 800 ? Math.max(brk, sp) : end;
      }
      pages.push(text.slice(i, end));
      i = end;
    }
    return pages.length ? pages : [text];
  };

  // Open the reader on a pasted passage / article instead of a book
  const openTextReader = (title, author, body, gid) => {
    window.__slReadStart = Date.now();
    const pages = paginate(body);
    const saved = gid ? digitalShelf.find((x) => x.gid === gid) : null;
    setReader({
      gid: gid || `text:${title}`, title, author: author || "",
      loading: false, pages, page: Math.min(saved?.pos || 0, pages.length - 1),
      mark: saved?.mark || null, isText: true,
    });
  };

  const openReader = async (item) => {
    window.__slReadStart = Date.now();
    setReader({ gid: item.gid, title: item.title, author: item.author, loading: true, pages: [], page: item.pos || 0 });
    try {
      const d = await fetchBookText(item.gid); // instant after the first open (cached)
      if (!d.text) throw new Error(d.error || "no text");
      // Split into gentle pages (~1600 chars, breaking at whitespace)
      const pages = [];
      let i = 0;
      const text = d.text;
      while (i < text.length) {
        let end = Math.min(i + 1600, text.length);
        if (end < text.length) {
          const brk = text.lastIndexOf("\n", end);
          const sp = text.lastIndexOf(" ", end);
          end = Math.max(brk, sp) > i + 800 ? Math.max(brk, sp) : end;
        }
        pages.push(text.slice(i, end));
        i = end;
      }
      const savedMark = (latestRef.current.digitalShelf || []).find((x) => x.gid === item.gid)?.mark || null;
      setReader((prev) => prev && { ...prev, loading: false, pages, page: Math.min(prev.page, pages.length - 1), mark: savedMark });
    } catch {
      flash("Couldn't open that book — try another");
      setReader(null);
    }
  };

  const bankMinutes = () => {
    const started = window.__slReadStart;
    if (!started) return 0;
    const mins = Math.min(30, Math.round((Date.now() - started) / 60000)); // cap a forgotten-open tab
    window.__slReadStart = Date.now();
    return mins;
  };

  const turnPage = (delta, keepAudio) => {
    const rd = readerRef.current;
    if (!rd?.pages?.length) return;
    if (!keepAudio) stopAllSpeech();
    const total = rd.pages.length;
    const page = Math.max(0, Math.min(total - 1, rd.page + delta));
    setReader({ ...rd, page });
    readerRef.current = { ...rd, page };   // callbacks can rely on it immediately
    const atEnd = page >= total - 1;
    // Sync progress to the linked book on My Shelf; last page = a real finish
    let earned = 0;
    const nextBooks = (latestRef.current.books || books).map((x) => {
      if (x.gid !== rd.gid) return x;
      if (atEnd && x.status !== "done") {
        earned = 25;
        return { ...x, pages: total, currentPage: total, status: "done", finishedAt: Date.now() };
      }
      return { ...x, pages: total, currentPage: atEnd ? total : page, status: x.status === "done" ? "done" : "reading" };
    });
    const mins = bankMinutes();
    persist({
      digitalShelf: (latestRef.current.digitalShelf || []).map((x) => (x.gid === rd.gid ? { ...x, pos: page } : x)),
      readDays: delta > 0 ? withToday(readDays) : readDays,
      books: nextBooks,
      points: points + earned,
      readLog: mins ? logActivity({ min: mins }) : latestRef.current.readLog,
    });
    if (earned) { celebrate(); flash("You finished the whole book! +25 pts 🎉"); }
  };

  // ----- The log nobody has to fill out: built from what actually happened -----
  const logActivity = (patch) => {
    const d = new Date().toISOString().slice(0, 10);
    const cur = latestRef.current.readLog || [];
    const row = cur.find((x) => x.d === d) || { d, min: 0, ch: 0, qz: 0 };
    const next = { ...row, min: row.min + (patch.min || 0), ch: row.ch + (patch.ch || 0), qz: row.qz + (patch.qz || 0) };
    const rest = cur.filter((x) => x.d !== d);
    return [...rest, next].sort((a, b) => a.d.localeCompare(b.d)).slice(-180); // ~6 months
  };

  // ----- Daily spotlight: a little delight when you open the app -----
  useEffect(() => {
    if (!loaded || !onboarded) return;
    if (tab === "news") return; // never interrupt someone already in the Reading Room
    const today = new Date().toISOString().slice(0, 10);
    if (lastSpotlight === today) return;
    const t = setTimeout(() => {
      const anns = newsDigest?.data?.anniversaries || [];
      if (anns.length) {
        const a = anns[new Date().getDate() % anns.length];
        setSpotlight({ kind: "news", emoji: a.emoji || "📰", title: a.title, blurb: a.blurb });
      } else if (points > 0 || myWords.length > 0 || readDays.length > 0) {
        setSpotlight({ kind: "stats" });
      } else {
        setSpotlight({ kind: "welcome" });
      }
      persist({ lastSpotlight: today });
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, onboarded, newsDigest]);

  // ----- Reading Room: expandable "read more" per story -----
  const readMoreNews = async (i, item) => {
    if (newsMore[i]?.text || newsMore[i]?.loading) {
      setNewsMore((m) => ({ ...m, [i]: { ...m[i], open: !m[i].open } }));
      return;
    }
    setNewsMore((m) => ({ ...m, [i]: { loading: true, open: true } }));
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5", max_tokens: 400,
          messages: [{ role: "user", content: `Tell the fuller story behind this literary moment, for a beginner reader: "${item.title} — ${item.blurb}". 4-6 warm, simple sentences. Real literary history only, no invented events. End with one sentence on why it still matters to readers today. Respond with only the story.` }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).filter((x) => x.type === "text").map((x) => x.text).join(" ").trim();
      setNewsMore((m) => ({ ...m, [i]: { text: text || "The full story is being shy — try again!", open: true, loading: false } }));
    } catch {
      setNewsMore((m) => ({ ...m, [i]: { text: "Couldn't fetch the full story — try again in a moment.", open: true, loading: false } }));
    }
  };

  // ----- The Reading Room: this month in the reading world (AI-curated, cached monthly) -----
  const loadReadingRoom = async (force) => {
    const monthKey = new Date().toISOString().slice(0, 7);
    if ((!force && newsDigest?.month === monthKey && newsDigest?.data) || newsLoading) return;
    setNewsLoading(true);
    try {
      const monthName = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5", max_tokens: 1200,
          messages: [{
            role: "user",
            content: `Create a fun "this month in the reading world" digest for ${monthName}, for beginner readers. Use only REAL, verifiable literary history — author birthdays this month, famous book publication anniversaries this month, classic authors born this month. NO invented current events, NO made-up news. Warm, playful, 1-2 sentences each. Respond with ONLY JSON, no markdown: {"anniversaries":[{"emoji":"🎂","title":"...","blurb":"..."}] (exactly 5 items),"classic":{"title":"...","author":"...","why":"one sentence on why this month is perfect for it"},"challenge":"a one-sentence reading challenge for this month tied to one of the items above"}`,
          }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).filter((x) => x.type === "text").map((x) => x.text).join("\n");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (!parsed.anniversaries) throw new Error("bad digest");
      // Strip markdown the AI sneaks in (*emphasis*, `code`)
      const clean = (x) => typeof x === "string" ? x.replace(/[*`]/g, "") : Array.isArray(x) ? x.map(clean) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clean(v)])) : x;
      persist({ newsDigest: { month: monthKey, data: clean(parsed) } });
    } catch {
      flash("The Reading Room needs a moment — try again");
    }
    setNewsLoading(false);
  };
  useEffect(() => {
    if (tab === "news" || tab === "today") loadReadingRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ----- Sound check: diagnoses audio on THIS device, results on screen -----
  const runSoundCheck = () => {
    const lines = [];
    const log = (t) => { lines.push(t); setSoundCheck({ running: true, lines: [...lines] }); };
    setSoundCheck({ running: true, lines: [] });

    // 1) Simple beep through the basic audio system (not text-to-speech)
    let beepOk = false;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      ctx.resume();
      log(`Audio system: ${ctx.state === "running" ? "running ✓" : `state = ${ctx.state} ⚠️`}`);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      osc.frequency.value = 523;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
      beepOk = true;
      log("Beep test: played a half-second beep 🎵 (did you hear it?)");
    } catch (e) {
      log(`Beep test: FAILED to play (${String(e && e.message ? e.message : e).slice(0, 60)})`);
    }

    // 2) Voices available to text-to-speech
    const vs = window.speechSynthesis?.getVoices?.() || [];
    log(`Voices found: ${vs.length}${vs.length ? " — e.g. " + vs.slice(0, 3).map((v) => v.name).join(", ") : " ⚠️ (none — this browser can't speak)"}`);

    // 3) Speak with the DEFAULT voice and report exactly what the engine does
    try {
      const u = new SpeechSynthesisUtterance("Hello! If you can hear me, the reader will work.");
      u.rate = 0.95;
      let started = false;
      u.onstart = () => { started = true; log("Speech engine: STARTED speaking ✓"); };
      u.onend = () => log(started ? "Speech engine: finished normally ✓ — if you heard nothing, this device is muting the site (check tab mute, volume mixer, Bluetooth)." : "Speech engine: ended without starting ⚠️");
      u.onerror = (e) => log(`Speech engine: ERROR — ${e.error || "unknown"} ⚠️`);
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(u);
      setTimeout(() => {
        if (!started) log("Speech engine: never started within 3s ⚠️ — this browser is blocking speech. Try Chrome or Edge.");
        setSoundCheck((sc) => sc && { ...sc, running: false });
      }, 3000);
    } catch (e) {
      log(`Speech engine: crashed (${String(e && e.message ? e.message : e).slice(0, 60)})`);
      setSoundCheck((sc) => sc && { ...sc, running: false });
    }
  };

  // ----- Fresh on the shelves: new releases matched to the reader's taste -----
  const loadFreshBooks = async () => {
    if (freshBooks || freshLoading) return;
    setFreshLoading(true);
    try {
      const { tagScores, lang } = quiz ? scoreQuiz(quiz) : { tagScores: {}, lang: "en" };
      const top = Object.entries(tagScores).sort((a, b) => b[1] - a[1]).map(([t]) => t).find((t) => TAG_SUBJECTS[t]);
      const subj = top ? TAG_SUBJECTS[top] : "fiction";
      const langParam = lang === "es" ? "&langRestrict=es" : "";
      const collect = (d, seen, out) => {
        for (const it of d.items || []) {
          const v = it.volumeInfo || {};
          const t = (v.title || "").toLowerCase();
          if (!v.title || seen.has(t)) continue;
          seen.add(t);
          const cover = v.imageLinks?.smallThumbnail?.replace("http://", "https://") || null;
          if (!cover) continue; // real covers only — it's a bookstore window, not a filing cabinet
          out.push({
            key: it.id, title: v.title, author: (v.authors || [])[0] || "",
            pages: v.pageCount || "", year: (v.publishedDate || "").slice(0, 4),
            cover,
          });
          if (out.length >= 8) break;
        }
      };
      const seen = new Set(onShelfTitles);
      const out = [];
      // Newest first…
      const langQ = lang === "es" ? "&langRestrict=es" : "";
      const gFetch = async (extra) => {
        try {
          const r = await fetch(`/api/gbooks?q=${encodeURIComponent("subject:" + subj)}${langQ}&maxResults=24${extra}`);
          if (r.ok) return await r.json();
        } catch { /* proxy missing? fall through */ }
        const r2 = await fetch(`https://www.googleapis.com/books/v1/volumes?q=subject:${encodeURIComponent(subj)}${langParam}&maxResults=24${extra}`);
        return await r2.json();
      };
      try {
        collect(await gFetch("&orderBy=newest"), seen, out);
        // …but "newest" can be sparse; top up with popular picks in the same subject
        if (out.length < 4) collect(await gFetch(""), seen, out);
      } catch { /* Google unreachable on this network — Open Library below */ }
      // Final fallback: Open Library's newest additions in the same subject
      if (out.length < 4) {
        const olSubj = subj.split(" ")[0];
        const r3 = await fetch(`https://openlibrary.org/search.json?q=subject:${encodeURIComponent(olSubj)}&sort=new&limit=20&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median`);
        const d3 = await r3.json();
        for (const doc of d3.docs || []) {
          const t = (doc.title || "").toLowerCase();
          if (!doc.title || !doc.cover_i || seen.has(t)) continue; // covers only
          seen.add(t);
          out.push({
            key: doc.key, title: doc.title, author: (doc.author_name || [])[0] || "",
            pages: doc.number_of_pages_median || "", year: doc.first_publish_year || "",
            cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
          });
          if (out.length >= 8) break;
        }
      }
      setFreshBooks(out);
    } catch {
      setFreshBooks([]);
    }
    setFreshLoading(false);
  };;
  useEffect(() => {
    if (tab === "today" && loaded && onboarded) loadFreshBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loaded, onboarded]);

  // ----- Browse a whole subject, including free titles in that subject -----
  // Session cache: tapping the same subject pill twice is instant
  const subjectCacheRef = useRef({});
  const subjectEntryRef = useRef(null);   // the subject currently open
  const subjectPageRef = useRef({});      // how deep into each subject we've paged
  const [loadingMore, setLoadingMore] = useState(false);

  // Pulls one "page" of a subject from FOUR sources at once:
  // Google Books (proxy + direct), Open Library's subject catalog, and
  // Project Gutenberg. Each page adds ~120 unique books; the catalogs
  // behind them hold thousands, so "Load more" never really runs dry.
  const loadSubjectBatch = async (entry, page) => {
    const [label, gq, topic] = entry;
    const merge = (items) => setSearchResults((prev) => {
      const seen = new Set((prev || []).map((x) => `${(x.title || "").toLowerCase()}`));
      const out = [...(prev || [])];
      for (const it of items) {
        const t = (it.title || "").toLowerCase();
        if (it.title && !seen.has(t)) { seen.add(t); out.push(it); }
      }
      return out.slice(0, 600);
    });
    const esQ = label.includes("español") ? "&langRestrict=es" : "";
    const mapGb = (d) => (d.items || []).map((it) => {
      const v = it.volumeInfo || {};
      return {
        key: `gb-${it.id}`, title: v.title, author_name: v.authors || [],
        number_of_pages_median: v.pageCount || null,
        first_publish_year: (v.publishedDate || "").slice(0, 4) || null,
        gbCover: v.imageLinks?.smallThumbnail?.replace("http://", "https://") || null,
      };
    });
    const land = (items) => { if (items && items.length) { merge(items); setSearching(false); } };
    const start = (page - 1) * 40;
    const startQ = start > 0 ? `&startIndex=${start}` : "";
    const olOffset = (page - 1) * 50;

    const proxyP = fetchT(`/api/gbooks?q=${encodeURIComponent(gq)}${esQ}&maxResults=40${startQ}`, 6000)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) land(mapGb(d)); })
      .catch(() => {});
    const directP = fetchT(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(gq)}${esQ}&maxResults=40${startQ}`, 7000)
      .then((r) => r.json())
      .then((d) => land(mapGb(d)))
      .catch(() => {});
    // Open Library's subject shelves run tens of thousands deep
    const olLang = label.includes("español") ? "&lang=spa" : "";
    const olP = fetchT(`https://openlibrary.org/search.json?q=${encodeURIComponent(`subject:"${topic}"`)}&limit=50&offset=${olOffset}${olLang}&fields=key,title,author_name,number_of_pages_median,cover_i,first_publish_year`, 8000)
      .then((r) => r.json())
      .then((d) => land((d.docs || []).filter((x) => x.title).map((x) => ({ ...x, key: `ol-${x.key}` }))))
      .catch(() => {});
    const gutenP = gutenbergLookup("", topic, page).then((glist) => {
      if (!glist.length) return;
      setSearchResults((prev) => {
        const annotated = (prev || []).map((doc) => {
          if (doc.gutenId) return doc;
          const g = matchGuten(glist, doc.title, (doc.author_name || [])[0] || "");
          return g ? { ...doc, gutenId: g.gid, gutenAuthor: g.author } : doc;
        });
        // Free classics fill the grid even when Google is slow or blocked
        const seen = new Set(annotated.map((x) => normTitle(x.title)));
        const extras = glist.filter((g) => !seen.has(g.key)).map((g) => ({
          key: `gt-${g.gid}`, title: g.title, author_name: g.author ? [g.author] : [],
          gutenId: g.gid, gutenAuthor: g.author,
        }));
        const out = [...annotated, ...extras].slice(0, 600);
        if (out.length) setSearching(false);
        return out;
      });
    }).catch(() => {});

    await Promise.allSettled([proxyP, directP, olP, gutenP]);
    setSearching(false);
    huntCovers(); // fill in any coverless results in the background
    // Remember what this subject produced for instant replays
    setSearchResults((prev) => {
      if (prev && prev.length) subjectCacheRef.current[label] = prev;
      return prev;
    });
  };

  const browseSubject = async (entry) => {
    const [label] = entry;
    setSubject(label);
    setBookQuery("");
    subjectEntryRef.current = entry;
    subjectPageRef.current[label] = 1;
    // Instant replay from cache — refreshes silently underneath
    const cached = subjectCacheRef.current[label];
    setSearchResults(cached ? [...cached] : []);
    setSearching(!cached);
    await loadSubjectBatch(entry, 1);
  };

  // "Load more books" — digs one page deeper into every source
  const loadMoreSubject = async () => {
    const entry = subjectEntryRef.current;
    if (!entry || loadingMore) return;
    const [label] = entry;
    setLoadingMore(true);
    const page = (subjectPageRef.current[label] || 1) + 1;
    subjectPageRef.current[label] = page;
    await loadSubjectBatch(entry, page);
    setLoadingMore(false);
  };

  // ----- Readers can correct a wrong "free to read" badge -----
  const flagNotFree = async (key, title, gid) => {
    setFlagged((f) => ({ ...f, [key]: true }));
    flash("Thanks — badge removed. That report helps us fix the match. 🙏");
    try {
      await storage.set(`flag:${String(Date.now()).padStart(15, "0")}-${uid()}`,
        JSON.stringify({ title: String(title).slice(0, 120), gid: gid || null, at: Date.now() }), true);
    } catch { /* the local correction still stands */ }
  };

  // ----- Quick book summaries in search results -----
  const fetchBlurb = async (key, title, author) => {
    if (blurbs[key]?.text || blurbs[key]?.loading) { setBlurbs((b) => ({ ...b, [key]: { ...b[key], open: !b[key].open } })); return; }
    setBlurbs((b) => ({ ...b, [key]: { loading: true, open: true } }));
    let text = "";
    try {
      const q = `intitle:${title}` + (author ? ` inauthor:${author}` : "");
      // Proxy and direct race in parallel with timeouts — first good answer wins
      const attempt = async (url) => {
        const r = await fetchT(url, 5000);
        if (!r.ok) throw new Error("bad");
        const dd = await r.json();
        if (!dd.items?.length) throw new Error("empty");
        return dd;
      };
      const d = await Promise.any([
        attempt(`/api/gbooks?q=${encodeURIComponent(q)}&maxResults=1`),
        attempt(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`),
      ]).catch(() => null);
      if (!d) throw new Error("no result");
      text = d.items?.[0]?.volumeInfo?.description || "";
      if (text.length > 380) text = text.slice(0, 380).replace(/\s+\S*$/, "") + "…";
    } catch { /* fall through to AI */ }
    if (!text) {
      try {
        const r = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-haiku-4-5", max_tokens: 200,
            messages: [{ role: "user", content: `In 2 short, friendly sentences and with no spoilers, tell a beginner reader what the book "${title}"${author ? ` by ${author}` : ""} is about. If you don't know it, say "This one's a bit of a mystery to us — sometimes that's the fun part!" Respond with only the summary.` }],
          }),
        });
        const d = await r.json();
        text = (d.content || []).filter((x) => x.type === "text").map((x) => x.text).join(" ").trim();
      } catch { /* noop */ }
    }
    setBlurbs((b) => ({ ...b, [key]: { text: text || "Couldn't find a summary for this one.", open: true, loading: false } }));
  };

  // ----- Rate the app (feedback lands in shared storage for the founder) -----
  const submitAppRating = async () => {
    if (!appRating) return;
    try {
      await storage.set(`apprating:${String(Date.now()).padStart(15, "0")}-${uid()}`,
        JSON.stringify({ stars: appRating, note: appFeedback.trim().slice(0, 300), at: Date.now() }), true);
    } catch { /* still thank them */ }
    setAppRated(true);
    celebrate();
  };

  // ----- "More like this": live wider-library picks matched to quiz taste -----
  const TAG_SUBJECTS = {
    Funny: "humorous fiction", Adventure: "adventure stories", Heartwarming: "friendship fiction",
    Fantasy: "fantasy fiction", Mystery: "detective and mystery stories", Romance: "romance fiction",
    "Sci-fi": "science fiction", Nonfiction: "biography", Classics: "classic literature",
    "Short reads": "novellas", "Pictures inside": "graphic novels",
  };
  const fetchMorePicks = async () => {
    if (!quiz) return;
    setMorePicksLoading(true);
    try {
      const { tagScores, audience, lang } = scoreQuiz(quiz);
      const topTags = Object.entries(tagScores).sort((a, b) => b[1] - a[1]).map(([t]) => t)
        .filter((t) => TAG_SUBJECTS[t]).slice(0, 2);
      const subjects = topTags.length ? topTags.map((t) => TAG_SUBJECTS[t]) : ["fiction"];
      const curated = new Set(PICKS.map((x) => x.title.toLowerCase()));
      const seen = new Set([...onShelfTitles, ...curated]);
      const out = [];
      for (const subj of subjects) {
        const q = audience === "kid" ? `subject:"juvenile fiction" ${subj}` : `subject:"${subj}"`;
        const langParam = lang === "es" ? "&langRestrict=es" : "";
        const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}${langParam}&maxResults=14&orderBy=relevance`);
        const d = await r.json();
        for (const it of d.items || []) {
          const v = it.volumeInfo || {};
          const t = (v.title || "").toLowerCase();
          if (!v.title || seen.has(t)) continue;
          seen.add(t);
          out.push({
            key: it.id, title: v.title, author: (v.authors || [])[0] || "",
            pages: v.pageCount || "", why: subj,
            cover: v.imageLinks?.smallThumbnail?.replace("http://", "https://") || null,
          });
          if (out.length >= 12) break;
        }
        if (out.length >= 12) break;
      }
      setMorePicks(out);
    } catch {
      flash("Couldn't load more picks — try again in a moment");
    }
    setMorePicksLoading(false);
  };

  // ----- First-run onboarding -----
  const finishOnboarding = (chosenRole) => {
    persist({ onboarded: true, role: chosenRole });
    if (chosenRole === "teacher") { setClassForm((f) => ({ ...f, kind: "class" })); setTab("classroom"); setClassMode("teacher-setup"); }
    else if (chosenRole === "family") { setClassForm((f) => ({ ...f, kind: "family" })); setTab("classroom"); setClassMode("teacher-setup"); }
    else if (chosenRole === "student") { setTab("classroom"); setClassMode("student-join"); }
    else { setTab("today"); }
    flash("Welcome to Shelf Life! 🌱");
  };;

  // ----- Device sync: move your shelf to another device with a 6-letter code -----
  const createSyncCode = async () => {
    setSyncBusy(true);
    try {
      const code = makeClassCode() + makeClassCode().slice(0, 1);
      const data = { books, readDays, goalDays, quiz, points, quizResults, classroom, teaching, digitalShelf, myWords, voicePref, at: Date.now() };
      await storage.set(`sync:${code}`, JSON.stringify(data), true);
      setSyncCode(code);
    } catch {
      flash("Couldn't create a sync code — try again");
    }
    setSyncBusy(false);
  };
  const receiveSyncCode = async () => {
    const code = syncInput.trim().toUpperCase();
    if (code.length < 5) return;
    setSyncBusy(true);
    try {
      const r = await storage.get(`sync:${code}`, true);
      const d = JSON.parse(r.value);
      persist({
        books: d.books || [], readDays: d.readDays || [], goalDays: d.goalDays || 4,
        quiz: d.quiz || null, points: d.points || 0, quizResults: d.quizResults || {},
        classroom: d.classroom || null, teaching: d.teaching || null,
        digitalShelf: d.digitalShelf || [], myWords: d.myWords || [],
      });
      setSyncInput("");
      flash("Your shelf is here! Everything synced 📚");
      setTab("shelf");
    } catch {
      flash("No shelf found for that code — double-check it?");
    }
    setSyncBusy(false);
  };

  // ----- "Catch me up": spoiler-safe recap of the story so far -----
  const catchMeUp = async (book) => {
    const pct = Math.round(((book.currentPage || 0) / (book.pages || 1)) * 100);
    setRecap({ bookId: book.id, loading: true });
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: `A beginner reader is about ${pct}% of the way through "${book.title}"${book.author ? ` by ${book.author}` : ""} and is coming back after a break. In 3-4 warm, simple sentences, remind them what has happened in the story UP TO roughly that point ONLY — absolutely no spoilers past it. End with one encouraging line welcoming them back. If you don't know this specific book, instead offer a friendly note that it's okay to skim back a few pages to rejoin the story. Respond with only the recap, no preamble.`,
          }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).filter((x) => x.type === "text").map((x) => x.text).join(" ").trim();
      if (!text) throw new Error("empty");
      setRecap({ bookId: book.id, loading: false, text });
    } catch {
      flash("Couldn't build a recap — try again in a moment");
      setRecap(null);
    }
  };

  // ----- My Words review quiz -----
  const startWordQuiz = () => {
    if (myWords.length < 4) return;
    const pool = [...myWords].sort(() => Math.random() - 0.5);
    const questions = pool.slice(0, Math.min(5, pool.length)).map((w) => {
      const wrong = pool.filter((x) => x.word !== w.word).sort(() => Math.random() - 0.5).slice(0, 3).map((x) => x.definition);
      const options = [...wrong, w.definition].sort(() => Math.random() - 0.5);
      return { word: w.word, options, answer: options.indexOf(w.definition) };
    });
    setWordQuiz({ questions, answers: [], submitted: false });
  };

  const submitWordQuiz = () => {
    if (!wordQuiz) return;
    const score = wordQuiz.questions.reduce((s2, q, i) => s2 + (wordQuiz.answers[i] === q.answer ? 1 : 0), 0);
    const earned = score * 2;
    persist({ points: points + earned });
    setWordQuiz({ ...wordQuiz, submitted: true, score, earned });
    if (score >= wordQuiz.questions.length - 1) celebrate();
  };

  // ----- Personality quiz helpers -----
  const finishQuiz = (answers) => {
    persist({ quiz: answers });
    setPickTag(topTag(scoreQuiz(answers).tagScores));
    setAiPicks(null);
    flash("Your reading personality is in! 📖");
  };
  const retakeQuiz = () => {
    setQuizDraft([]);
    setQuizStep(0);
    setAiPicks(null);
    setPickTag("All");
    persist({ quiz: null });
  };
  const askClaude = async () => {
    if (!quiz) return;
    setAiLoading(true);
    const { tagScores, maxPages, audience } = scoreQuiz(quiz);
    const { lang } = scoreQuiz(quiz);
    const langNote = lang === "es" ? " Recommend books in SPANISH (books originally in or translated to Spanish), and write the 'why' in Spanish." : lang === "both" ? " Include at least one Spanish-language book." : "";
    const audienceNote = (audience === "adult" ? "The reader is an adult." : audience === "teen" ? "The reader is a teenager." : "The reader is a child — recommend only age-appropriate books.") + langNote;
    const likes = Object.entries(tagScores).sort((a, b) => b[1] - a[1]).map(([t]) => t).join(", ");
    const avoid = [...PICKS.map((p) => p.title), ...books.map((b) => b.title)].join("; ");
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Recommend exactly 3 real, well-known books for a beginner reader building a reading habit. ${audienceNote} Their taste: ${likes}. ${maxPages !== Infinity ? `Prefer books under ${maxPages} pages.` : ""} Do NOT recommend any of these (already known to them): ${avoid}. Respond with ONLY a JSON array, no markdown fences, no other text: [{"title": "...", "author": "...", "pages": 123, "why": "one friendly sentence on why it fits them"}]`,
          }],
        }),
      });
      const data = await response.json();
      const text = data.content.filter((i) => i.type === "text").map((i) => i.text).join("\n");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setAiPicks(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
    } catch (e) {
      console.error(e);
      flash("Couldn't fetch extra picks — try again in a moment");
    }
    setAiLoading(false);
  };

  const submitPost = async () => {
    if (!postForm.name.trim() || !postForm.text.trim()) return;
    setPosting(true);
    const post = {
      name: postForm.name.trim().slice(0, 30),
      book: postForm.book.trim().slice(0, 60),
      text: postForm.text.trim().slice(0, 300),
      arch: myArch ? `${myArch.emoji} ${myArch.name}` : null,
      at: Date.now(),
    };
    try {
      await savePost(post);
      setPosts([post, ...posts]);
      setPostForm({ ...postForm, book: "", text: "" });
      persist({ points: points + 5 });
      flash("Posted to the club wall! +5 pts");
    } catch {
      flash("Couldn't post — try again");
    }
    setPosting(false);
  };

  const input = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px",
    border: `1.5px solid ${T.rule}`, borderRadius: 8, background: T.card,
    color: T.ink, fontSize: 15, fontFamily: "'Atkinson Hyperlegible', sans-serif", outline: "none",
  };
  const btn = (bg = T.blue) => ({
    background: bg, color: "#FFF", border: "none", borderRadius: 8,
    padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer",
    fontFamily: "'Atkinson Hyperlegible', sans-serif",
  });
  const ghostBtn = {
    background: "transparent", color: T.blue, border: `1.5px solid ${T.blue}`,
    borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
    fontFamily: "'Atkinson Hyperlegible', sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: "'Atkinson Hyperlegible', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        input:focus, textarea:focus, select:focus { border-color: ${T.blue} !important; }
        button:focus-visible { outline: 3px solid ${T.blue}; outline-offset: 2px; }
        @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes confettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0.7; }
        }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      {/* Header */}
      <header style={{ maxWidth: 880, margin: "0 auto", padding: "28px 18px 6px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark size={44} />
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "clamp(30px, 6vw, 44px)", margin: 0, letterSpacing: "-0.02em" }}>
              Shelf Life
            </h1>
          </div>
          <div style={{
            border: `2px solid ${T.stamp}`, color: T.stamp, borderRadius: 6, padding: "3px 10px",
            fontWeight: 700, fontSize: 12,
          }} className="sl-stamp">
            NEW READERS WELCOME
          </div>
        </div>
        <p style={{ margin: "6px 0 0", color: T.inkSoft, fontSize: 15 }}>
          Track your books, find your next one, and talk about them with other readers. Go at your own pace — this is your shelf, not a race.
          <span style={{ fontSize: 11, opacity: 0.55, marginLeft: 8 }}>v57</span>
        </p>
      </header>

      {/* Tabs */}
      <nav style={{ maxWidth: 880, margin: "18px auto 0", padding: "0 18px", display: "flex", gap: 8, overflowX: "auto" }}>
        {[
          ["today", "Today"],
          ["shelf", "My shelf"],
          ["discover", "Find a book"],
          ["read", "Read 📱"],
          ["classroom", unreadFamily > 0 ? `Classroom (${unreadFamily})` : "Classroom"],
          ["more", "More"],
        ].map(([id, label]) => (
          <button
            key={id}
            className="sl-tab"
            onClick={() => setTab(id)}
            style={{
              flex: "0 0 auto", padding: "10px 18px", borderRadius: "10px 10px 0 0",
              boxShadow: (tab === id || (id === "more" && ["personality", "foryou", "club", "rewards"].includes(tab))) ? "0 -2px 6px rgba(34,51,77,0.06)" : "none",
              border: `1.5px solid ${T.rule}`, borderBottom: "none", cursor: "pointer",
              background: (tab === id || (id === "more" && ["personality", "foryou", "club", "rewards"].includes(tab))) ? T.card : "rgba(255,255,255,0.35)",
              color: (tab === id || (id === "more" && ["personality", "foryou", "club", "rewards"].includes(tab))) ? T.ink : T.inkSoft,
              fontWeight: (tab === id || (id === "more" && ["personality", "foryou", "club", "rewards"].includes(tab))) ? 700 : 400, fontSize: 15,
              fontFamily: "'Atkinson Hyperlegible', sans-serif",
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main style={{
        maxWidth: 880, margin: "0 auto 60px", padding: "26px 22px 34px",
        background: T.card, border: `1.5px solid ${T.rule}`, borderRadius: "0 14px 14px 14px",
        minHeight: 420, boxShadow: T.lift3,
      }}>
        {/* ---------------- TODAY ---------------- */}
        {tab === "today" && (() => {
          const hour = new Date().getHours();
          const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
          const currentBook = reading[0] || null;
          const currentDigital = digitalShelf.find((d) => d.pos > 0) || null;
          return (
            <div style={{ animation: "rise .3s ease" }}>
              <div style={{ fontSize: 13, color: T.inkSoft, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 28, margin: "2px 0 14px" }}>
                {greeting}{userName ? `, ${userName}` : ""} 📚
              </h2>

              {/* Today's encouragement — the heart of the app, front and center */}
              <div style={{
                borderLeft: `5px solid ${T.green}`, background: "#F0F5F0", borderRadius: "0 12px 12px 0",
                padding: "16px 18px", marginBottom: 16,
              }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 19, lineHeight: 1.4 }}>
                  “{todaysEncouragement()}”
                </div>
              </div>

              {/* This month's challenge — the reason to come back */}
              {newsDigest?.data?.challenge && (
                <button onClick={() => setTab("news")} style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  border: `2px dashed ${T.stamp}`, borderRadius: 12, background: "#FDF6EE",
                  padding: "13px 16px", marginBottom: 12, fontFamily: "'Atkinson Hyperlegible', sans-serif",
                }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.13em", color: T.stamp, fontWeight: 700 }}>
                    ✨ THIS MONTH'S CHALLENGE
                  </div>
                  <div style={{ fontSize: 15, marginTop: 3, color: T.ink }}>{newsDigest.data.challenge}</div>
                  <div style={{ fontSize: 11.5, color: T.blue, fontWeight: 700, marginTop: 5 }}>
                    Open the Reading Room 📰
                  </div>
                </button>
              )}

              {/* Check in / streak */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
                background: T.paper, border: `1px solid ${T.rule}`, borderRadius: 12, padding: "12px 16px", marginBottom: 12,
              }}>
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22 }}>{streak} 🔥</div>
                  <div style={{ fontSize: 12, color: T.inkSoft }}>
                    day streak{streak === 0 && readDays.length > 0 ? " · streaks rest too — today's a fresh page 🌱" : ""}
                  </div>
                </div>
                <button style={readToday ? ghostBtn : btn(T.stamp)} onClick={markToday}>
                  {readToday ? "Read today ✓" : "I read today — any amount counts 🌱"}
                </button>
              </div>

              {/* Keep reading */}
              {(currentBook || currentDigital) && (
                <div style={{
                  background: T.paper, border: `1px solid ${T.rule}`, borderLeft: `6px solid ${spineColor((currentBook || currentDigital).title)}`,
                  borderRadius: 12, padding: "14px 16px", marginBottom: 12,
                }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.blue, fontWeight: 700 }}>KEEP READING</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 19 }}>
                    {(currentBook || currentDigital).title}
                  </div>
                  {currentBook && (
                    <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 8 }}>
                      Page {currentBook.currentPage} of {currentBook.pages} · {Math.round((currentBook.currentPage / currentBook.pages) * 100)}%
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {currentBook?.gid || currentDigital ? (
                      <button style={btn(T.green)} onClick={() => {
                        const d = digitalShelf.find((x) => x.gid === (currentBook?.gid || currentDigital?.gid));
                        if (d) openReader(d);
                      }}>
                        📱 Open the book
                      </button>
                    ) : (
                      <button style={btn(T.green)} onClick={() => setTab("shelf")}>Update my progress</button>
                    )}
                    {currentBook && currentBook.currentPage > 0 && (
                      <button style={ghostBtn} onClick={() => { setTab("shelf"); catchMeUp(currentBook); }}>
                        Catch me up 🕯️
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Class at a glance */}
              {classroom && (
                <div style={{
                  background: "#F0F5F0", border: `1.5px solid ${T.green}`, borderRadius: 12,
                  padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: 10, flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.green, fontWeight: 700 }}>
                      {classroom.kind === "family" ? "FAMILY CIRCLE" : "YOUR CLASS"}
                    </div>
                    <div style={{ fontSize: 14 }}>
                      Chapter <strong>{classroom.chapter || 0}</strong> of {classroom.chapters} in “{classroom.book}”
                    </div>
                  </div>
                  <button style={ghostBtn} onClick={() => setTab("classroom")}>Open →</button>
                </div>
              )}
              {teaching && (
                <div style={{
                  background: "#F5F8FC", border: `1.5px solid ${T.blue}`, borderRadius: 12,
                  padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: 10, flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.blue, fontWeight: 700 }}>
                      {teaching.kind === "family" ? "YOUR FAMILY CIRCLE" : "YOUR CLASS"} · CODE {teaching.code}
                    </div>
                    <div style={{ fontSize: 14 }}>“{teaching.book}” · see where your readers are</div>
                  </div>
                  <button style={btn()} onClick={() => { setTab("classroom"); loadRoster(teaching.code); }}>Dashboard →</button>
                </div>
              )}

              {/* Word review nudge */}
              {myWords.length >= 4 && (
                <div style={{
                  background: T.paper, border: `1px solid ${T.rule}`, borderRadius: 12,
                  padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: 10, flexWrap: "wrap",
                }}>
                  <div style={{ fontSize: 14 }}>
                    📖 You've collected <strong>{myWords.length} words</strong> — up for a 2-minute review?
                  </div>
                  <button style={ghostBtn} onClick={() => { setTab("shelf"); startWordQuiz(); }}>Quick quiz 🧠</button>
                </div>
              )}

              {/* Empty-state pointers */}
              {/* Fresh on the shelves */}
              {freshLoading && (
                <div style={{ fontSize: 12, color: T.inkSoft, margin: "0 0 12px" }}>🔥 Finding fresh books for you…</div>
              )}
              {freshBooks && freshBooks.length === 0 && (
                <div style={{ fontSize: 12, color: T.inkSoft, margin: "0 0 12px" }}>
                  🔥 Couldn't load new releases just now.
                  <button style={{ ...ghostBtn, marginLeft: 8, padding: "2px 10px", fontSize: 11 }}
                    onClick={() => { setFreshBooks(null); setTimeout(loadFreshBooks, 50); }}>
                    Try again ↻
                  </button>
                </div>
              )}
              {freshBooks && freshBooks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.stamp, fontWeight: 700, marginBottom: 6 }}>
                    🔥 FRESH ON THE SHELVES — NEW THIS SEASON
                  </div>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                    {freshBooks.map((b) => {
                      const owned = onShelfTitles.has(b.title.toLowerCase());
                      return (
                        <div key={b.key} style={{
                          flex: "0 0 128px", background: T.paper, border: `1px solid ${T.rule}`,
                          borderRadius: 10, padding: 8, textAlign: "center",
                        }}>
                          <CoverThumb src={b.cover} title={b.title} w={72} h={104} center />
                          <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.2, marginTop: 5, height: 28, overflow: "hidden" }}>{b.title}</div>
                          <div style={{ fontSize: 10, color: T.inkSoft }}>{b.author}</div>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 5 }}>
                            <button
                              style={{ ...(owned ? ghostBtn : btn(T.green)), padding: "3px 8px", fontSize: 10.5, opacity: owned ? 0.6 : 1 }}
                              disabled={owned}
                              onClick={() => addBook({ title: b.title, author: b.author, pages: b.pages || 200, status: "want" })}>
                              {owned ? "✓" : "+ Shelf"}
                            </button>
                            <button
                              style={{ ...ghostBtn, padding: "3px 8px", fontSize: 10.5 }}
                              onClick={() => fetchBlurb(b.key, b.title, b.author)}>
                              {blurbs[b.key]?.open ? "▲" : "About?"}
                            </button>
                          </div>
                          {blurbs[b.key]?.open && (
                            <div style={{ fontSize: 10.5, textAlign: "left", marginTop: 5, background: "#F5F8FC", borderRadius: 6, padding: "5px 7px" }}>
                              {blurbs[b.key].loading ? "…" : blurbs[b.key].text}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {totalReaders !== null && totalReaders >= 1 && (
                <div style={{ fontSize: 11.5, color: T.inkSoft, textAlign: "center", margin: "0 0 12px" }}>
                  {totalReaders <= 3
                    ? `📚 You're one of the very first readers on Shelf Life — reader #${totalReaders.toLocaleString()} 🌱`
                    : `📚 You're reading alongside ${totalReaders.toLocaleString()} readers across Shelf Life`}
                </div>
              )}

              {/* Word of the day (from My Words) */}
              {myWords.length > 0 && (() => {
                const w = myWords[new Date().getDate() % myWords.length];
                return (
                  <div style={{
                    background: "#F5F8FC", border: `1.5px dashed ${T.blue}`, borderRadius: 12,
                    padding: "12px 16px", marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.blue, fontWeight: 700 }}>YOUR WORD OF THE DAY</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22 }}>{w.word}</span>
                      <button style={{ ...ghostBtn, padding: "2px 10px", fontSize: 12 }} onClick={() => speakWord(w.word)}>🔊</button>
                    </div>
                    <div style={{ fontSize: 14, marginTop: 2 }}>{w.definition}</div>
                    {myWords.length >= 4 && (
                      <button style={{ ...ghostBtn, marginTop: 8, padding: "4px 12px", fontSize: 12 }}
                        onClick={() => { setTab("shelf"); startWordQuiz(); }}>
                        Review my words 🧠 (+2 pts each)
                      </button>
                    )}
                  </div>
                );
              })()}

              {!currentBook && !currentDigital && !classroom && !teaching && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button onClick={() => setTab("personality")} style={{
                    flex: "1 1 200px", background: T.card, border: `2px solid ${T.blue}`, borderRadius: 12,
                    padding: "18px 16px", cursor: "pointer", textAlign: "center", fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    <div style={{ fontSize: 28 }}>🎭</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 16, color: T.ink }}>Find your reading type</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>2-minute quiz, books matched to you</div>
                  </button>
                  <button onClick={() => setTab("read")} style={{
                    flex: "1 1 200px", background: T.card, border: `2px solid ${T.green}`, borderRadius: 12,
                    padding: "18px 16px", cursor: "pointer", textAlign: "center", fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    <div style={{ fontSize: 28 }}>📱</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 16, color: T.ink }}>Read something free</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>70,000 classics, built right in</div>
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ---------------- MY SHELF ---------------- */}
        {tab === "shelf" && (
          <div style={{ animation: "rise .3s ease" }}>
            {/* Daily encouragement */}
            <div style={{
              borderLeft: `4px solid ${T.green}`, background: "#F0F5F0", borderRadius: "0 8px 8px 0",
              padding: "8px 14px", marginBottom: 16, fontSize: 14, fontStyle: "italic", color: T.ink,
            }}>
              “{todaysEncouragement()}”
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              {[
                [`${streak} 🔥`, "day streak"],
                [`${points} ${level.emoji}`, `pts · ${level.name}`],
                [done.length, "finished"],
                [reading.length, "reading now"],
                [pagesRead.toLocaleString(), "pages read"],
              ].map(([n, l]) => (
                <div key={l} style={{ background: T.paper, border: `1px solid ${T.rule}`, borderRadius: 10, padding: "10px 16px", minWidth: 100 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26 }}>{n}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, letterSpacing: "0.06em", textTransform: "uppercase" }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Bookshelf — the signature */}
            {books.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div className="sl-rule" style={{ marginBottom: 10 }}>
                  <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: 0 }}>
                    Your shelf
                  </h2>
                </div>
                <Shelf books={books.slice(0, 30)} onPick={(b) => flash(`${b.title}${b.author ? " — " + b.author : ""}`)} />
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 9, textAlign: "center" }}>
                  {books.length} book{books.length !== 1 ? "s" : ""} on the shelf · faded spines are ones you want to read · a dot means finished
                </div>
              </div>
            )}

            {/* My words — the vocabulary shelf */}
            {myWords.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, borderBottom: `2px solid ${T.rule}`, paddingBottom: 6 }}>
                  <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: 0 }}>
                    📖 My words <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 400 }}>{myWords.length} collected</span>
                  </h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...ghostBtn, padding: "4px 12px", fontSize: 12 }} onClick={() => setReport("me")}>
                      📄 My reading log
                    </button>
                    <button style={{ ...ghostBtn, padding: "4px 12px", fontSize: 12 }} onClick={() => setShowWords(!showWords)}>
                      {showWords ? "Hide" : "See my words"}
                    </button>
                    {myWords.length >= 4 && (
                      <button style={{ ...btn(), padding: "4px 12px", fontSize: 12 }} onClick={startWordQuiz}>
                        Review quiz 🧠 (+2 pts each)
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: T.inkSoft, margin: "6px 0 0" }}>
                  Every word you tap in the reader lands here — watch your vocabulary grow.
                </p>

                {showWords && (
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                      {myWords.slice(0, 60).map((w) => (
                        <button key={w.word}
                          onClick={() => {
                            speakWord(w.word);
                            setSelectedWord(selectedWord?.word === w.word ? null : w);
                          }}
                          style={{
                            fontSize: 13, fontWeight: 700, borderRadius: 999, padding: "3px 12px", cursor: "pointer",
                            border: `1.5px solid ${selectedWord?.word === w.word ? T.blue : "transparent"}`,
                            color: T.blue, background: "#E8EEF7",
                            fontFamily: "'Atkinson Hyperlegible', sans-serif",
                          }}>
                          {w.word} 🔊
                        </button>
                      ))}
                    </div>
                    {selectedWord && (
                      <div style={{ marginTop: 10, border: `1.5px solid ${T.blue}`, borderRadius: 10, background: "#F5F8FC", padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <strong style={{ fontSize: 17 }}>{selectedWord.word}</strong>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button style={{ ...ghostBtn, padding: "4px 11px", fontSize: 12 }} onClick={() => speakWord(selectedWord.word)}>🔊 Hear it again</button>
                            <button aria-label="Close" style={{ background: "none", border: "none", color: T.inkSoft, cursor: "pointer", fontSize: 15 }} onClick={() => setSelectedWord(null)}>✕</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, marginTop: 4 }}>{selectedWord.definition}</div>
                      </div>
                    )}
                  </div>
                )}

                {wordQuiz && (
                  <div style={{ marginTop: 12, border: `1.5px solid ${T.blue}`, borderRadius: 10, background: "#F5F8FC", padding: "14px 16px" }}>
                    {!wordQuiz.submitted ? (
                      <div>
                        <strong>Which meaning matches?</strong>
                        {wordQuiz.questions.map((q, qi) => (
                          <div key={qi} style={{ margin: "10px 0" }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{qi + 1}. “{q.word}”</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6 }}>
                              {q.options.map((opt, oi) => (
                                <button key={oi}
                                  onClick={() => { const answers = [...wordQuiz.answers]; answers[qi] = oi; setWordQuiz({ ...wordQuiz, answers }); }}
                                  style={{
                                    textAlign: "left", padding: "8px 10px", borderRadius: 8, fontSize: 12.5, cursor: "pointer",
                                    border: `1.5px solid ${wordQuiz.answers[qi] === oi ? T.blue : T.rule}`,
                                    background: wordQuiz.answers[qi] === oi ? "#DDE8F6" : T.card,
                                    color: T.ink, fontFamily: "'Atkinson Hyperlegible', sans-serif",
                                  }}>
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            style={{ ...btn(), opacity: wordQuiz.answers.filter((a) => a !== undefined).length === wordQuiz.questions.length ? 1 : 0.5 }}
                            disabled={wordQuiz.answers.filter((a) => a !== undefined).length !== wordQuiz.questions.length}
                            onClick={submitWordQuiz}>
                            Check my answers
                          </button>
                          <button style={ghostBtn} onClick={() => setWordQuiz(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 34 }}>{wordQuiz.score >= wordQuiz.questions.length - 1 ? "🎉" : "📖"}</div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22 }}>{wordQuiz.score} / {wordQuiz.questions.length}</div>
                        <div style={{ fontSize: 13, margin: "4px 0 10px" }}>+{wordQuiz.earned} pts — these words are becoming yours.</div>
                        <button style={btn()} onClick={() => setWordQuiz(null)}>Done</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Reading now */}
            {reading.length > 0 && (
              <Section title="Reading now">
                {reading.map((b) => (
                  <BookRow key={b.id} book={b} onRemove={() => removeBook(b.id)}>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <Stars value={b.rating} onChange={(n) => updateBook(b.id, { rating: n })} size={16} />
                        <span style={{ fontSize: 11, color: T.inkSoft }}>{b.rating ? "" : "rate it as you go"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.inkSoft }}>
                        <span>Page {b.currentPage} of {b.pages}</span>
                        <span>{Math.round((b.currentPage / b.pages) * 100)}%</span>
                      </div>
                      <input
                        type="range" min="0" max={b.pages} value={b.currentPage}
                        onChange={(e) => updateBook(b.id, { currentPage: parseInt(e.target.value) })}
                        style={{ width: "100%", accentColor: T.blue }}
                        aria-label={`Progress for ${b.title}`}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <button style={ghostBtn} onClick={() => updateBook(b.id, { currentPage: Math.min(b.pages, b.currentPage + 5) })}>
                          +5 pages
                        </button>
                        <button style={btn(T.stamp)} onClick={() => finishBook(b.id)}>I finished it!</button>
                        {!b.gid && (
                          <button style={ghostBtn} onClick={() => setGetBook({ title: b.title, author: b.author, pages: b.pages })}>
                            Where do I get it?
                          </button>
                        )}
                        {b.currentPage > 0 && (
                          <button style={ghostBtn} onClick={() => catchMeUp(b)}>
                            {b.lastReadAt && Date.now() - b.lastReadAt > 4 * 86400000 ? "Been a while — catch me up 🕯️" : "Catch me up 🕯️"}
                          </button>
                        )}
                      </div>
                      {recap && recap.bookId === b.id && (
                        <div style={{
                          marginTop: 10, border: `1.5px dashed ${T.blue}`, borderRadius: 10,
                          background: "#F5F8FC", padding: "10px 14px", fontSize: 14,
                        }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.blue, fontWeight: 700, marginBottom: 4 }}>
                            THE STORY SO FAR (no spoilers)
                          </div>
                          {recap.loading ? "Remembering where you were…" : recap.text}
                          {!recap.loading && (
                            <div style={{ marginTop: 6 }}>
                              <button style={{ ...ghostBtn, padding: "3px 10px", fontSize: 11 }} onClick={() => setRecap(null)}>Got it ✓</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </BookRow>
                ))}
              </Section>
            )}

            {/* Want to read */}
            {want.length > 0 && (
              <Section title="Want to read">
                {want.map((b) => (
                  <BookRow key={b.id} book={b} onRemove={() => removeBook(b.id)}>
                    <button style={{ ...ghostBtn, marginTop: 8 }} onClick={() => updateBook(b.id, { status: "reading" })}>
                      Start reading
                    </button>
                  </BookRow>
                ))}
              </Section>
            )}

            {/* Finished */}
            {done.length > 0 && (
              <Section title="Finished">
                {done.map((b) => {
                  const result = quizResults[b.id];
                  const active = bookQuiz && bookQuiz.bookId === b.id;
                  return (
                    <BookRow key={b.id} book={b} onRemove={() => removeBook(b.id)}
                      stamp={b.finishedAt ? `FINISHED ${stampDate(b.finishedAt)}` : "FINISHED"}>
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Stars value={b.rating} onChange={(n) => updateBook(b.id, { rating: n })} />
                        <span style={{ fontSize: 13, color: T.inkSoft }}>{b.rating ? "" : "Tap to rate it"}</span>
                        {result && (
                          <span style={{
                            fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "2px 10px",
                            background: result.passed ? "#E5F0E7" : "#F6E9E6",
                            color: result.passed ? T.green : T.stamp,
                            border: `1px solid ${result.passed ? T.green : T.stamp}`,
                          }}>
                            🧠 Quiz: {result.score}/{result.total}{result.passed ? " · Passed!" : ""}
                          </span>
                        )}
                      </div>
                      {!active && (
                        <button style={{ ...ghostBtn, marginTop: 8 }} onClick={() => startBookQuiz(b)}>
                          {result ? "Retake the book quiz 🧠" : "Take the book quiz 🧠 (earn up to 50 pts)"}
                        </button>
                      )}

                      {/* Inline quiz panel */}
                      {active && (
                        <div style={{
                          marginTop: 12, border: `1.5px solid ${T.blue}`, borderRadius: 10,
                          background: "#F5F8FC", padding: "14px 16px",
                        }}>
                          {bookQuiz.loading && (
                            <p style={{ margin: 0, color: T.inkSoft }}>
                              📚 Writing 5 questions about “{b.title}” just for you…
                            </p>
                          )}
                          {!bookQuiz.loading && bookQuiz.questions && !bookQuiz.submitted && (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                <strong>Pop quiz: {b.title}</strong>
                                <span style={{ fontSize: 12, color: T.inkSoft }}>
                                  10 pts per correct answer{quizResults[b.id] ? " (points already earned — this one's for fun)" : ""} · 4/5 to pass
                                </span>
                              </div>
                              {bookQuiz.questions.map((q, qi) => (
                                <div key={qi} style={{ marginBottom: 12 }}>
                                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{qi + 1}. {q.q}</div>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
                                    {q.options.map((opt, oi) => (
                                      <button key={oi}
                                        onClick={() => {
                                          const answers = [...bookQuiz.answers];
                                          answers[qi] = oi;
                                          setBookQuiz({ ...bookQuiz, answers });
                                        }}
                                        style={{
                                          textAlign: "left", padding: "8px 10px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                                          border: `1.5px solid ${bookQuiz.answers[qi] === oi ? T.blue : T.rule}`,
                                          background: bookQuiz.answers[qi] === oi ? "#DDE8F6" : T.card,
                                          color: T.ink, fontFamily: "'Atkinson Hyperlegible', sans-serif",
                                        }}>
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  style={{ ...btn(), opacity: bookQuiz.answers.filter((a) => a !== undefined).length === bookQuiz.questions.length ? 1 : 0.5 }}
                                  disabled={bookQuiz.answers.filter((a) => a !== undefined).length !== bookQuiz.questions.length}
                                  onClick={submitBookQuiz}>
                                  Check my answers
                                </button>
                                <button style={ghostBtn} onClick={() => setBookQuiz(null)}>Cancel</button>
                              </div>
                            </div>
                          )}
                          {bookQuiz.submitted && (
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 40 }}>{bookQuiz.score >= 4 ? "🎉" : bookQuiz.score >= 3 ? "👏" : "📖"}</div>
                              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 24 }}>
                                {bookQuiz.score} / {bookQuiz.questions.length}
                              </div>
                              <div style={{ fontSize: 14, margin: "4px 0 10px" }}>
                                {bookQuiz.score >= 4
                                  ? `You really read that book! ${bookQuiz.earned ? `+${bookQuiz.earned} pts` : "Passed"} — quiz gifts unlock in the vault.`
                                  : bookQuiz.earned
                                    ? `+${bookQuiz.earned} pts! Skim your favorite parts and retake it to pass (4/5).`
                                    : "So close — flip through the book and try again to pass (4/5)."}
                              </div>
                              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                                <button style={ghostBtn} onClick={() => startBookQuiz(b)}>New questions ↻</button>
                                <button style={btn()} onClick={() => setBookQuiz(null)}>Done</button>
                              </div>
                            </div>
                          )}
                          <p style={{ fontSize: 11, color: T.inkSoft, margin: "10px 0 0", textAlign: "center" }}>
                            Questions are AI-generated — if one seems off about the book, skip it and grab new questions.
                          </p>
                        </div>
                      )}
                    </BookRow>
                  );
                })}
              </Section>
            )}
          </div>
        )}

        {/* ---------------- DISCOVER ---------------- */}
        {tab === "discover" && (
          <div style={{ animation: "rise .3s ease" }}>
            {!quiz && !quizNudgeDismissed && (
              <div style={{
                background: "#F5F8FC", border: `2px solid ${T.blue}`, borderRadius: 12,
                padding: "14px 16px", marginBottom: 14,
              }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 17 }}>
                  First time hunting for a book? ✨
                </div>
                <p style={{ fontSize: 13.5, color: T.inkSoft, margin: "4px 0 10px" }}>
                  Take the 2-minute personality quiz first — then every search and recommendation knows your taste.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={btn()} onClick={() => setTab("personality")}>Find my reading type ✨</button>
                  <button style={ghostBtn} onClick={() => persist({ quizNudgeDismissed: true })}>I'll browse on my own</button>
                </div>
              </div>
            )}
            {/* Search all books */}
            <Ruled style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, lineHeight: "28px" }}>Search millions of books</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
                <input
                  style={{ ...input, flex: "1 1 220px" }}
                  placeholder="Title, author, or topic…"
                  value={bookQuery}
                  onChange={(e) => setBookQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchBooks()}
                />
                <button style={{ ...btn(), opacity: bookQuery.trim() && !searching ? 1 : 0.5 }}
                  disabled={!bookQuery.trim() || searching} onClick={searchBooks}>
                  {searching ? "Searching…" : "Search"}
                </button>
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: "28px" }}>Or browse a subject:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 6 }}>
                {SUBJECTS.map((entry) => (
                  <button key={entry[0]} onClick={() => browseSubject(entry)} style={{
                    padding: "5px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", fontWeight: 700,
                    border: `1.5px solid ${subject === entry[0] ? T.blue : T.rule}`,
                    background: subject === entry[0] ? T.blue : "transparent",
                    color: subject === entry[0] ? "#FFF" : T.ink,
                    fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    {entry[0]}
                  </button>
                ))}
              </div>
            </Ruled>

            {searchResults && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "0 0 10px" }}>
                    {searchResults.length
                      ? (subject ? `${subject} books · ${searchResults.length}` : `Results for “${bookQuery}”`)
                      : searching
                        ? "Finding books… 📚"
                        : subject
                          ? `Couldn't load ${subject} right now — tap it again to retry`
                          : `Nothing found for “${bookQuery}” — try fewer words?`}
                  </h2>
                  <button style={{ ...ghostBtn, padding: "4px 12px", fontSize: 12 }}
                    onClick={() => { setSearchResults(null); setBookQuery(""); }}>
                    Clear ✕
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                  {searchResults.map((r) => {
                    const author = (r.author_name || [])[0] || "";
                    const pages = r.number_of_pages_median || "";
                    const owned = onShelfTitles.has(r.title.toLowerCase());
                    return (
                      <div key={r.key} style={{
                        border: `1px solid ${T.rule}`, borderRadius: 10, padding: 12,
                        background: T.paper, display: "flex", gap: 10,
                      }}>
                        <CoverThumb
                          src={r.gbCover
                            || (r.cover_i ? `https://covers.openlibrary.org/b/id/${r.cover_i}-M.jpg?default=false` : null)
                            || (r.gutenId ? gutenCover(r.gutenId) : null)}
                          title={r.title}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{r.title}</div>
                          <div style={{ fontSize: 12, color: T.inkSoft }}>
                            {author}{r.first_publish_year ? ` · ${r.first_publish_year}` : ""}{pages ? ` · ${pages} pages` : ""}
                          </div>
                          <button
                            style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0, textAlign: "left", fontFamily: "'Atkinson Hyperlegible', sans-serif" }}
                            onClick={() => fetchBlurb(r.key, r.title, author)}>
                            {blurbs[r.key]?.open ? "Hide summary ▲" : "What's it about? ▼"}
                          </button>
                          {blurbs[r.key]?.open && (
                            <div style={{ fontSize: 12.5, color: T.ink, background: "#F5F8FC", borderRadius: 8, padding: "6px 9px" }}>
                              {blurbs[r.key].loading ? "Getting the gist…" : blurbs[r.key].text}
                            </div>
                          )}
                          {r.gutenId && !flagged[r.key] && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: T.blue, letterSpacing: "0.06em" }}>
                              📱 FREE DIGITAL — read it in this app
                            </span>
                          )}
                          <div style={{ display: "flex", gap: 6, marginTop: "auto", flexWrap: "wrap" }}>
                            <button
                              style={{ ...(owned ? ghostBtn : btn(T.green)), padding: "6px 12px", fontSize: 12, opacity: owned ? 0.6 : 1, cursor: owned ? "default" : "pointer" }}
                              disabled={owned}
                              onClick={() => addBook({ title: r.title, author, pages: pages || 200, status: "want" })}>
                              {owned ? "On your shelf ✓" : "Add to shelf"}
                            </button>
                            {r.gutenId && !flagged[r.key] && (
                              <button
                                style={{ ...btn(), padding: "6px 12px", fontSize: 12 }}
                                onClick={() => { addDigital({ gid: r.gutenId, title: r.title, author: r.gutenAuthor || author }); setTab("read"); }}>
                                Read free 📱
                              </button>
                            )}
                          </div>
                          {r.gutenId && !flagged[r.key] ? (
                            <button
                              style={{ background: "none", border: "none", color: T.inkSoft, cursor: "pointer", fontSize: 10.5, padding: "2px 0", textDecoration: "underline", fontFamily: "'Atkinson Hyperlegible', sans-serif", textAlign: "left" }}
                              onClick={() => flagNotFree(r.key, r.title, r.gutenId)}>
                              Not the right book? Tell us
                            </button>
                          ) : (
                            <button
                              style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontSize: 11, padding: "2px 0", textDecoration: "underline", fontFamily: "'Atkinson Hyperlegible', sans-serif", textAlign: "left", fontWeight: 700 }}
                              onClick={() => setGetBook({ title: r.title, author, pages })}>
                              How do I get this book?
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {subject && searchResults.length > 0 && (
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <button style={{ ...btn(), opacity: loadingMore ? 0.6 : 1 }} disabled={loadingMore} onClick={loadMoreSubject}>
                      {loadingMore ? "Finding more books…" : "Load more books ↓"}
                    </button>
                    <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6 }}>
                      {searchResults.length} so far — there are thousands more in {subject}
                    </div>
                  </div>
                )}
              </div>
            )}
            <p style={{ marginTop: 0, color: T.inkSoft }}>
              Hand-picked books that are kind to new readers — short chapters, clear writing, hard to put down.
              {quiz && myArch && <strong style={{ color: T.blue }}> Sorted for {myArch.name} {myArch.emoji} — your best matches are first.</strong>}
              {!quiz && <> Take the <button onClick={() => setTab("personality")} style={{ background: "none", border: "none", color: T.blue, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: "inherit", fontFamily: "inherit", textDecoration: "underline" }}>personality quiz</button> to sort these by your taste.</>}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {ALL_TAGS.map((t) => (
                <button key={t} onClick={() => setPickTag(t)}
                  style={{
                    padding: "6px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                    border: `1.5px solid ${pickTag === t ? T.blue : T.rule}`,
                    background: pickTag === t ? T.blue : "transparent",
                    color: pickTag === t ? "#FFF" : T.ink, fontWeight: 700,
                    fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {(quiz ? matchBooks(quiz) : PICKS).filter((p) => pickTag === "All" || p.tags.includes(pickTag)).map((p) => {
                const owned = onShelfTitles.has(p.title.toLowerCase());
                return (
                  <div key={p.title} style={{
                    border: `1px solid ${T.rule}`, borderRadius: 10, padding: 14,
                    background: T.paper, display: "flex", flexDirection: "column", gap: 6,
                    borderTop: `6px solid ${spineColor(p.title)}`,
                  }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, lineHeight: 1.2 }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: T.inkSoft }}>{p.author} · {p.pages} pages</div>
                    <div style={{ fontSize: 14, flex: 1 }}>{p.blurb}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.tags.map((t) => (
                        <span key={t} style={{ fontSize: 11, color: T.blue, border: `1px solid ${T.rule}`, borderRadius: 999, padding: "2px 8px" }}>{t}</span>
                      ))}
                    </div>
                    <button
                      style={{ ...(owned ? ghostBtn : btn(T.green)), marginTop: 6, opacity: owned ? 0.6 : 1, cursor: owned ? "default" : "pointer" }}
                      disabled={owned}
                      onClick={() => addBook({ title: p.title, author: p.author, pages: p.pages, status: "want" })}
                    >
                      {owned ? "On your shelf ✓" : "Add to shelf"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- BOOK CLUB ---------------- */}
        {tab === "club" && (
          <div style={{ animation: "rise .3s ease" }}>
            {!sharedIsLive && (
              <div style={{
                border: `1.5px solid ${T.stamp}`, background: "#FBF3EE", borderRadius: 8,
                padding: "8px 12px", fontSize: 12.5, marginBottom: 14, color: T.ink,
              }}>
                <strong style={{ color: T.stamp }}>Single-device mode:</strong> the shared database isn't connected yet,
                so classes, wall posts, and meetups only exist on this device. Connect Supabase (see README step 4)
                to sync across everyone's phones.
              </div>
            )}
            {/* Conversation starter */}
            <div style={{
              border: `2px dashed ${T.stamp}`, borderRadius: 10, padding: "14px 16px",
              marginBottom: 18, background: "#FBF3EE",
            }}>
              <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.stamp, fontWeight: 700, marginBottom: 4 }}>
                CONVERSATION STARTER
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600 }}>{PROMPTS[promptIdx]}</div>
              <button style={{ ...ghostBtn, marginTop: 10, borderColor: T.stamp, color: T.stamp }}
                onClick={() => setPromptIdx((promptIdx + 1) % PROMPTS.length)}>
                Give me another
              </button>
            </div>

            {/* Composer */}
            <Ruled>
              <div style={{ fontWeight: 700, marginBottom: 8, lineHeight: "28px" }}>Leave a note on the club wall</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
                <input style={input} placeholder="Your first name *" maxLength={30} value={postForm.name}
                  onChange={(e) => setPostForm({ ...postForm, name: e.target.value })} />
                <input style={input} placeholder="Book you're talking about" maxLength={60} value={postForm.book}
                  onChange={(e) => setPostForm({ ...postForm, book: e.target.value })} />
              </div>
              <textarea
                style={{ ...input, minHeight: 70, resize: "vertical" }}
                placeholder="What did you love? What confused you? Recommend something!"
                maxLength={300}
                value={postForm.text}
                onChange={(e) => setPostForm({ ...postForm, text: e.target.value })}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: T.inkSoft }}>
                  Heads up: notes on this wall are public — everyone using this app can read them.
                </span>
                <button
                  style={{ ...btn(), opacity: postForm.name.trim() && postForm.text.trim() && !posting ? 1 : 0.5 }}
                  disabled={!postForm.name.trim() || !postForm.text.trim() || posting}
                  onClick={submitPost}
                >
                  {posting ? "Posting…" : "Post to the wall"}
                </button>
              </div>
            </Ruled>

            {/* Wall */}
            <div style={{ marginTop: 18 }}>
              {postsLoading && <p style={{ color: T.inkSoft }}>Checking the wall…</p>}
              {!postsLoading && posts.length === 0 && (
                <p style={{ color: T.inkSoft }}>The wall is empty — be the first to pin a note!</p>
              )}
              {posts.map((p, i) => (
                <div key={p.at + p.name + i} style={{
                  border: `1px solid ${T.rule}`, borderLeft: `5px solid ${spineColor(p.book || p.name)}`,
                  borderRadius: 8, padding: "10px 14px", marginBottom: 10, background: T.paper,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{p.name}</strong>
                      {p.arch && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: T.blue, border: `1px solid ${T.rule}`,
                          borderRadius: 999, padding: "1px 8px",
                        }}>
                          {p.arch}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: T.inkSoft }}>{timeAgo(p.at)}</span>
                  </div>
                  {p.book && <div style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>on “{p.book}”</div>}
                  <div style={{ marginTop: 4, fontSize: 15 }}>{p.text}</div>
                </div>
              ))}
            </div>

            {/* ----- Book meetups ----- */}
            <div style={{ marginTop: 28 }}>
              <h2 style={{
                fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "0 0 4px",
                borderBottom: `2px solid ${T.rule}`, paddingBottom: 6,
              }}>
                📍 Book meetups
              </h2>
              <p style={{ margin: "8px 0 12px", fontSize: 13, color: T.inkSoft }}>
                Plan a get-together to talk about what you're reading — a library corner, a classroom, a café table.
                Reading alone is lovely; talking about books makes them stick.
              </p>
              <div style={{
                border: `1.5px solid ${T.stamp}`, background: "#FBF3EE", borderRadius: 8,
                padding: "8px 12px", fontSize: 12, marginBottom: 14,
              }}>
                <strong style={{ color: T.stamp }}>Safety first:</strong> always pick public places — libraries, schools, bookstores, cafés.
                Younger readers, bring a parent, teacher, or trusted adult. Meetup posts are public to everyone using this app.
              </div>

              {!showMeetupForm ? (
                <button style={btn()} onClick={() => setShowMeetupForm(true)}>+ Plan a meetup</button>
              ) : (
                <Ruled style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, lineHeight: "28px" }}>Plan a book meetup</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
                    <input style={input} placeholder="Your first name *" maxLength={30} value={meetupForm.host}
                      onChange={(e) => setMeetupForm({ ...meetupForm, host: e.target.value })} />
                    <input style={input} placeholder="Place * (e.g. Central Library, 2nd floor)" maxLength={80} value={meetupForm.place}
                      onChange={(e) => setMeetupForm({ ...meetupForm, place: e.target.value })} />
                    <input style={input} placeholder="When * (e.g. Sat Jul 18, 3pm)" maxLength={60} value={meetupForm.when}
                      onChange={(e) => setMeetupForm({ ...meetupForm, when: e.target.value })} />
                    <input style={input} placeholder="Book or topic (optional)" maxLength={60} value={meetupForm.book}
                      onChange={(e) => setMeetupForm({ ...meetupForm, book: e.target.value })} />
                  </div>
                  <input style={{ ...input, marginBottom: 10 }} placeholder="A note for attendees (optional)" maxLength={200} value={meetupForm.note}
                    onChange={(e) => setMeetupForm({ ...meetupForm, note: e.target.value })} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{ ...btn(), opacity: meetupForm.host.trim() && meetupForm.place.trim() && meetupForm.when.trim() && !savingMeetup ? 1 : 0.5 }}
                      disabled={!meetupForm.host.trim() || !meetupForm.place.trim() || !meetupForm.when.trim() || savingMeetup}
                      onClick={createMeetup}>
                      {savingMeetup ? "Posting…" : "Post meetup"}
                    </button>
                    <button style={ghostBtn} onClick={() => setShowMeetupForm(false)}>Cancel</button>
                  </div>
                </Ruled>
              )}

              <div style={{ marginTop: 14 }}>
                {meetupsLoading && <p style={{ color: T.inkSoft }}>Checking for meetups…</p>}
                {!meetupsLoading && meetups.length === 0 && (
                  <p style={{ color: T.inkSoft }}>No meetups planned yet — be the first to pick a spot!</p>
                )}
                {meetups.map((m) => (
                  <div key={m.key} style={{
                    border: `1px solid ${T.rule}`, borderRadius: 10, padding: "12px 14px",
                    marginBottom: 10, background: T.paper, borderLeft: `5px solid ${T.blue}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>
                        📍 {m.place}
                      </div>
                      <span style={{ fontSize: 12, color: T.inkSoft }}>posted {timeAgo(m.at)}</span>
                    </div>
                    <div style={{ fontSize: 14, marginTop: 2 }}>
                      🗓 <strong>{m.when}</strong>{m.book && <> · talking about <strong style={{ color: T.blue }}>“{m.book}”</strong></>} · hosted by {m.host}
                    </div>
                    {m.note && <div style={{ fontSize: 14, marginTop: 4, fontStyle: "italic" }}>{m.note}</div>}
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {(m.attendees || []).map((a, i) => (
                        <span key={i} style={{
                          fontSize: 12, background: "#E8EEF7", color: T.blue, fontWeight: 700,
                          borderRadius: 999, padding: "2px 10px",
                        }}>
                          {a}
                        </span>
                      ))}
                      <span style={{ fontSize: 12, color: T.inkSoft }}>
                        {(m.attendees || []).length} going
                      </span>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        style={{ ...input, flex: "1 1 140px", maxWidth: 220, padding: "7px 10px", fontSize: 13 }}
                        placeholder="Your first name"
                        maxLength={30}
                        value={rsvpDrafts[m.key] || ""}
                        onChange={(e) => setRsvpDrafts({ ...rsvpDrafts, [m.key]: e.target.value })}
                      />
                      <button
                        style={{ ...ghostBtn, opacity: (rsvpDrafts[m.key] || "").trim() ? 1 : 0.5 }}
                        disabled={!(rsvpDrafts[m.key] || "").trim()}
                        onClick={() => rsvpMeetup(m)}>
                        Count me in ✋
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- PERSONALITY ---------------- */}
        {tab === "personality" && (
          <div style={{ animation: "rise .3s ease" }}>
            {!quiz ? (
              /* ----- Quiz flow ----- */
              <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26 }}>
                    What kind of reader are you?
                  </div>
                  <p style={{ color: T.inkSoft, margin: "6px 0 0", fontSize: 14 }}>
                    {QUIZ.length} quick questions. No wrong answers — just honest ones.
                  </p>
                </div>
                {/* Progress dots */}
                <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 18 }}>
                  {QUIZ.map((_, i) => (
                    <div key={i} style={{
                      width: 10, height: 10, borderRadius: 99,
                      background: i < quizStep ? T.green : i === quizStep ? T.blue : T.rule,
                    }} />
                  ))}
                </div>
                <Ruled>
                  <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.stamp, fontWeight: 700, lineHeight: "28px" }}>
                    QUESTION {quizStep + 1} OF {QUIZ.length}
                  </div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, lineHeight: "28px", marginBottom: 10 }}>
                    {QUIZ[quizStep].q}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 4 }}>
                    {QUIZ[quizStep].options.map((opt, oi) => (
                      <button
                        key={opt.label}
                        onClick={() => {
                          const next = [...quizDraft];
                          next[quizStep] = oi;
                          setQuizDraft(next);
                          if (quizStep + 1 < QUIZ.length) setQuizStep(quizStep + 1);
                          else finishQuiz(next);
                        }}
                        style={{
                          textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                          border: `1.5px solid ${quizDraft[quizStep] === oi ? T.blue : T.rule}`,
                          background: quizDraft[quizStep] === oi ? "#EAF0F9" : T.card,
                          color: T.ink, fontSize: 15, fontFamily: "'Atkinson Hyperlegible', sans-serif",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {quizStep > 0 && (
                    <button style={{ ...ghostBtn, marginTop: 10 }} onClick={() => setQuizStep(quizStep - 1)}>
                      ← Back
                    </button>
                  )}
                </Ruled>
              </div>
            ) : (
              /* ----- Results ----- */
              (() => {
                const { tagScores, audience } = scoreQuiz(quiz);
                const arch = ARCHETYPES[topTag(tagScores)];
                const matches = matchBooks(quiz).filter((m) => !onShelfTitles.has(m.title.toLowerCase())).slice(0, 12);
                return (
                  <div>
                    {/* Archetype card */}
                    <div style={{
                      border: `2px solid ${T.stamp}`, borderRadius: 14, padding: "18px 20px",
                      background: "#FBF3EE", display: "flex", gap: 16, alignItems: "center",
                      flexWrap: "wrap", marginBottom: 20,
                    }}>
                      <div style={{ fontSize: 52 }}>{arch.emoji}</div>
                      <div style={{ flex: "1 1 240px" }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.stamp, fontWeight: 700 }}>
                          YOUR READING PERSONALITY
                        </div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 28 }}>{arch.name}</div>
                        <div style={{ fontSize: 14, marginTop: 4 }}>{arch.line}</div>
                      </div>
                      <button style={ghostBtn} onClick={retakeQuiz}>Retake quiz</button>
                    </div>

                    {/* Matched books */}
                    <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "0 0 4px" }}>
                      Picked for you
                    </h2>
                    <p style={{ margin: "0 0 14px", fontSize: 13, color: T.inkSoft }}>
                      Matched to your answers from our beginner-friendly list.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                      {matches.map((p) => (
                        <div key={p.title} style={{
                          border: `1px solid ${T.rule}`, borderRadius: 10, padding: 14,
                          background: T.paper, display: "flex", flexDirection: "column", gap: 6,
                          borderTop: `6px solid ${spineColor(p.title)}`,
                        }}>
                          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, lineHeight: 1.2 }}>{p.title}</div>
                          <div style={{ fontSize: 13, color: T.inkSoft }}>{p.author} · {p.pages} pages</div>
                          <div style={{ fontSize: 14, flex: 1 }}>{p.blurb}</div>
                          {p.reasons.length > 0 && (
                            <div style={{ fontSize: 12, color: T.green, fontWeight: 700 }}>
                              ✓ Matches your taste for {p.reasons.map((r) => r.toLowerCase()).join(" & ")}
                            </div>
                          )}
                          <button style={{ ...btn(T.green), marginTop: 4 }}
                            onClick={() => addBook({ title: p.title, author: p.author, pages: p.pages, status: "want" })}>
                            Add to shelf
                          </button>
                        </div>
                      ))}
                      {matches.length === 0 && (
                        <p style={{ color: T.inkSoft }}>
                          You've already shelved all your best matches — impressive! Try the button below for fresh ideas.
                        </p>
                      )}
                    </div>

                    {/* Live wider-library picks */}
                    <div style={{ marginTop: 18 }}>
                      <button style={{ ...ghostBtn, opacity: morePicksLoading ? 0.6 : 1 }} disabled={morePicksLoading} onClick={fetchMorePicks}>
                        {morePicksLoading ? "Searching the stacks…" : morePicks ? "Refresh the stacks ↻" : "📚 Show more like this (from the wider library)"}
                      </button>
                      {morePicks && morePicks.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
                          {morePicks.map((r) => {
                            const owned = onShelfTitles.has(r.title.toLowerCase());
                            return (
                              <div key={r.key} style={{
                                border: `1px solid ${T.rule}`, borderRadius: 10, padding: 12,
                                background: T.paper, display: "flex", gap: 10,
                              }}>
                                <CoverThumb src={r.cover} title={r.title} />
                                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{r.title}</div>
                                  <div style={{ fontSize: 12, color: T.inkSoft }}>{r.author}{r.pages ? ` · ${r.pages} pages` : ""}</div>
                                  <div style={{ fontSize: 12, color: T.green, fontWeight: 700 }}>✓ {r.why}</div>
                                  <button
                                    style={{ ...(owned ? ghostBtn : btn(T.green)), marginTop: "auto", padding: "6px 12px", fontSize: 12, opacity: owned ? 0.6 : 1, cursor: owned ? "default" : "pointer" }}
                                    disabled={owned}
                                    onClick={() => addBook({ title: r.title, author: r.author, pages: r.pages || 200, status: "want" })}>
                                    {owned ? "On your shelf ✓" : "Add to shelf"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* AI-powered extras */}
                    <div style={{ marginTop: 22 }}>
                      <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "0 0 4px" }}>
                        Want more?
                      </h2>
                      <p style={{ margin: "0 0 12px", fontSize: 13, color: T.inkSoft }}>
                        Get 3 fresh picks beyond our list, matched to your personality.
                      </p>
                      <button style={{ ...btn(), opacity: aiLoading ? 0.6 : 1 }} disabled={aiLoading} onClick={askClaude}>
                        {aiLoading ? "Thinking…" : aiPicks ? "Get 3 different picks ↻" : "✨ Get 3 more picks"}
                      </button>
                      {aiPicks && aiPicks.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 14 }}>
                          {aiPicks.map((p) => (
                            <div key={p.title} style={{
                              border: `1.5px dashed ${T.blue}`, borderRadius: 10, padding: 14,
                              background: "#F5F8FC", display: "flex", flexDirection: "column", gap: 6,
                            }}>
                              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, lineHeight: 1.2 }}>{p.title}</div>
                              <div style={{ fontSize: 13, color: T.inkSoft }}>{p.author}{p.pages ? ` · ~${p.pages} pages` : ""}</div>
                              <div style={{ fontSize: 14, flex: 1 }}>{p.why}</div>
                              <button style={{ ...btn(T.green), marginTop: 4 }}
                                onClick={() => addBook({ title: p.title, author: p.author, pages: p.pages, status: "want" })}>
                                Add to shelf
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ----- The After Dark Shelf: adults only ----- */}
                    {SHOW_AFTER_DARK && !SCHOOL_MODE && audience === "adult" && (
                      <div style={{
                        marginTop: 26, background: T.ink, borderRadius: 14, padding: "18px 18px 16px",
                        color: T.paper,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 21, margin: 0 }}>
                            🌙 The After Dark Shelf
                          </h2>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
                            border: "1.5px solid #F0A860", color: "#F0A860", borderRadius: 5,
                            padding: "2px 8px", transform: "rotate(-2deg)",
                          }}>
                            GROWN-UPS ONLY
                          </span>
                        </div>
                        <p style={{ fontSize: 13, opacity: 0.85, margin: "6px 0 12px" }}>
                          Because adult beginner readers deserve the fun stuff too. These titles include explicit,
                          frightening, or graphic content — they never appear in young readers' recommendations.
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                          {Object.entries(MATURE_SHELF).map(([id, cat]) => (
                            <button key={id} onClick={() => setMatureTab(id)}
                              style={{
                                padding: "6px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontWeight: 700,
                                border: `1.5px solid ${matureTab === id ? "#F0A860" : "rgba(244,238,221,0.35)"}`,
                                background: matureTab === id ? "#F0A860" : "transparent",
                                color: matureTab === id ? T.ink : T.paper,
                                fontFamily: "'Atkinson Hyperlegible', sans-serif",
                              }}>
                              {cat.emoji} {cat.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                          {MATURE_SHELF[matureTab].books.map((b) => {
                            const owned = onShelfTitles.has(b.title.toLowerCase());
                            return (
                              <div key={b.title} style={{
                                background: "rgba(244,238,221,0.07)", border: "1px solid rgba(244,238,221,0.22)",
                                borderRadius: 10, padding: 13, display: "flex", flexDirection: "column", gap: 5,
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17, lineHeight: 1.2 }}>{b.title}</div>
                                  <span style={{ fontSize: 12, flexShrink: 0 }}>{b.level}</span>
                                </div>
                                <div style={{ fontSize: 12.5, opacity: 0.75 }}>{b.author} · {b.pages} pages</div>
                                <div style={{ fontSize: 13.5, flex: 1, opacity: 0.92 }}>{b.note}</div>
                                <button
                                  style={{
                                    marginTop: 5, padding: "8px 14px", borderRadius: 8, fontWeight: 700, fontSize: 13,
                                    cursor: owned ? "default" : "pointer", border: "none",
                                    background: owned ? "rgba(244,238,221,0.25)" : "#F0A860",
                                    color: owned ? T.paper : T.ink,
                                    fontFamily: "'Atkinson Hyperlegible', sans-serif", opacity: owned ? 0.7 : 1,
                                  }}
                                  disabled={owned}
                                  onClick={() => addBook({ title: b.title, author: b.author, pages: b.pages, status: "want" })}>
                                  {owned ? "On your shelf ✓" : "Add to shelf"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ---------------- CLASSROOM ---------------- */}
        {tab === "classroom" && (
          <div style={{ animation: "rise .3s ease" }}>
            {!sharedIsLive && (
              <div style={{
                border: `1.5px solid ${T.stamp}`, background: "#FBF3EE", borderRadius: 8,
                padding: "8px 12px", fontSize: 12.5, marginBottom: 14, color: T.ink,
              }}>
                <strong style={{ color: T.stamp }}>Single-device mode:</strong> the shared database isn't connected yet,
                so classes, wall posts, and meetups only exist on this device. Connect Supabase (see README step 4)
                to sync across everyone's phones.
              </div>
            )}
            {/* Entry choice */}
            {!teaching && !classroom && !classMode && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26 }}>Classroom</div>
                  <p style={{ color: T.inkSoft, margin: "6px auto 0", fontSize: 14, maxWidth: 480 }}>
                    Read a book together, chapter by chapter — as a classroom or as a family.
                    Whoever leads sees where each reader is — to help, never to rank.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button onClick={() => { setClassForm({ ...classForm, kind: "class" }); setClassMode("teacher-setup"); }} style={{
                    flex: "1 1 240px", background: T.card, border: `2px solid ${T.blue}`, borderRadius: 12,
                    padding: "22px 18px", cursor: "pointer", textAlign: "center", fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    <div style={{ fontSize: 34 }}>🍎</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: T.ink }}>I'm a teacher</div>
                    <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>Set up a class book and get a join code for your students</div>
                  </button>
                  <button onClick={() => { setClassForm({ ...classForm, kind: "family" }); setClassMode("teacher-setup"); }} style={{
                    flex: "1 1 240px", background: T.card, border: `2px solid ${T.stamp}`, borderRadius: 12,
                    padding: "22px 18px", cursor: "pointer", textAlign: "center", fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    <div style={{ fontSize: 34 }}>👨‍👩‍👧</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: T.ink }}>We're a family</div>
                    <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>Read together at home — set family rewards like movie night</div>
                  </button>
                  <button onClick={() => setClassMode("partner")} style={{
                    flex: "1 1 240px", background: T.card, border: `2px solid ${T.gold}`, borderRadius: 12,
                    padding: "22px 18px", cursor: "pointer", textAlign: "center", fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    <div style={{ fontSize: 34 }}>🏪</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: T.ink }}>Bookstore or library</div>
                    <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>Offer rewards to local classrooms and bring readers through your door</div>
                  </button>
                  <button onClick={() => setClassMode("family-join")} style={{
                    flex: "1 1 240px", background: T.card, border: `2px solid ${T.blue}`, borderRadius: 12,
                    padding: "22px 18px", cursor: "pointer", textAlign: "center", fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    <div style={{ fontSize: 34 }}>💛</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: T.ink }}>Follow my reader</div>
                    <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>Parents: enter your family code to see progress & teacher notes</div>
                  </button>
                  <button onClick={() => { setClassForm({ ...classForm, kind: "class" }); setClassMode("student-join"); }} style={{
                    flex: "1 1 240px", background: T.card, border: `2px solid ${T.green}`, borderRadius: 12,
                    padding: "22px 18px", cursor: "pointer", textAlign: "center", fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    <div style={{ fontSize: 34 }}>🎒</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: T.ink }}>I'm a student</div>
                    <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>Join your class with the code your teacher gave you</div>
                  </button>
                </div>
              </div>
            )}

            {/* Teacher setup */}
            {classMode === "teacher-setup" && (
              <Ruled>
                <div style={{ fontWeight: 700, marginBottom: 8, lineHeight: "28px" }}>
                  {classForm.kind === "family"
                    ? (teaching ? "Set up a new family circle" : "Set up your family circle")
                    : (teaching ? "Set up a new class — your other classes stay right where they are" : "Set up your class")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
                  <input style={input} placeholder={classForm.kind === "family" ? "Your name * (e.g. Mom, Papá Luis)" : "Your name * (e.g. Ms. Rivera)"} maxLength={40} value={classForm.teacher}
                    onChange={(e) => setClassForm({ ...classForm, teacher: e.target.value })} />
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Who are your readers?</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.entries(GRADES).map(([k, g]) => (
                        <button key={k} type="button" onClick={() => setClassForm({ ...classForm, level: k })} style={{
                          padding: "6px 13px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", fontWeight: 700,
                          border: `1.5px solid ${classForm.level === k ? T.blue : T.rule}`,
                          background: classForm.level === k ? T.blue : "transparent",
                          color: classForm.level === k ? "#FFF" : T.ink,
                          fontFamily: "'Atkinson Hyperlegible', sans-serif",
                        }}>
                          {g.short}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>
                      {lvl(classForm).label} — {classForm.level === "prek"
                        ? "activities go to the grown-up; nothing asks a child to read alone"
                        : classForm.level === "g912"
                        ? "analysis, text evidence and argument — no baby talk"
                        : classForm.level === "adult"
                        ? "simple language, adult subject matter, never childish"
                        : `questions, homework and word help are written for ${lvl(classForm).short} readers`}
                    </div>
                  </div>
                  <input style={input} placeholder={classForm.kind === "family" ? "Family name * (e.g. The Mondragóns)" : "Class name * (e.g. Period 3 ELA)"} maxLength={50} value={classForm.className}
                    onChange={(e) => setClassForm({ ...classForm, className: e.target.value })} />
                  <BookTitleInput
                    placeholder="Book you're reading * (type to search)"
                    value={classForm.book}
                    onChange={(v) => setClassForm({ ...classForm, book: v })}
                    onPick={(b) => { setClassForm((f) => ({ ...f, book: b.title, bookAuthor: b.author || "" })); estimateChapters(b.title, b.author || ""); }}
                  />
                  <div>
                    <input style={input} placeholder={`Number of ${lvl(classForm).units}`} inputMode="numeric" value={classForm.chapters}
                      onChange={(e) => { setChapGuess(""); setClassForm({ ...classForm, chapters: e.target.value.replace(/\D/g, "") }); }} />
                    {chapGuess === "loading" && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>Counting chapters for you…</div>}
                    {chapGuess === "done" && <div style={{ fontSize: 11, color: T.green, marginTop: 3 }}>✓ Filled in automatically — adjust if your edition differs</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...btn(), opacity: classForm.teacher.trim() && classForm.className.trim() && classForm.book.trim() && !classBusy ? 1 : 0.5 }}
                    disabled={!classForm.teacher.trim() || !classForm.className.trim() || !classForm.book.trim() || classBusy}
                    onClick={createClass}>
                    {classBusy ? "Creating…" : classForm.kind === "family" ? "Create family circle & get code" : "Create class & get code"}
                  </button>
                  <button style={ghostBtn} onClick={() => setClassMode(null)}>Back</button>
                </div>
              </Ruled>
            )}

            {/* Student join */}
            {classMode === "student-join" && !classroom && (
              <Ruled>
                <div style={{ fontWeight: 700, marginBottom: 8, lineHeight: "28px" }}>Join your class</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
                  <input style={{ ...input, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700 }}
                    placeholder="CLASS CODE" maxLength={5} value={joinForm.code}
                    onChange={(e) => setJoinForm({ ...joinForm, code: e.target.value.toUpperCase() })} />
                  <input style={input} placeholder="Your first name *" maxLength={30} value={joinForm.name}
                    onChange={(e) => setJoinForm({ ...joinForm, name: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...btn(T.green), opacity: joinForm.code.trim().length === 5 && joinForm.name.trim() && !classBusy ? 1 : 0.5 }}
                    disabled={joinForm.code.trim().length !== 5 || !joinForm.name.trim() || classBusy}
                    onClick={joinClass}>
                    {classBusy ? "Joining…" : "Join class"}
                  </button>
                  <button style={ghostBtn} onClick={() => setClassMode(null)}>Back</button>
                </div>
              </Ruled>
            )}

            {/* Bookstore / library */}
            {classMode === "partner" && !partner && (
              <Ruled>
                <div style={{ fontWeight: 700, marginBottom: 3, lineHeight: "28px" }}>Set up your shop 🏪</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: "26px", paddingBottom: 6 }}>
                  Publish an offer, share your code with local teachers, and students unlock it by
                  <strong> provably reading</strong> — chapters finished or quizzes passed, verified in the app. Free, and you decide what you give away.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 8 }}>
                  <input style={input} maxLength={60} placeholder="Shop or library name *"
                    value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} />
                  <select style={input} value={partnerForm.kind} onChange={(e) => setPartnerForm({ ...partnerForm, kind: e.target.value })}>
                    <option value="bookstore">Independent bookstore</option>
                    <option value="library">Library</option>
                    <option value="other">Literacy program / other</option>
                  </select>
                  <input style={input} maxLength={40} placeholder="City *"
                    value={partnerForm.city} onChange={(e) => setPartnerForm({ ...partnerForm, city: e.target.value })} />
                  <input style={input} maxLength={120} placeholder="Address (optional)"
                    value={partnerForm.address} onChange={(e) => setPartnerForm({ ...partnerForm, address: e.target.value })} />
                  <input style={{ ...input, gridColumn: "1 / -1" }} maxLength={160} placeholder="One line about you (optional)"
                    value={partnerForm.blurb} onChange={(e) => setPartnerForm({ ...partnerForm, blurb: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={{ ...btn(T.green), opacity: partnerForm.name.trim() && partnerForm.city.trim() && !partnerBusy ? 1 : 0.5 }}
                    disabled={!partnerForm.name.trim() || !partnerForm.city.trim() || partnerBusy} onClick={createPartner}>
                    {partnerBusy ? "Setting up…" : "Create my shop"}
                  </button>
                  <button style={ghostBtn} onClick={() => setClassMode(null)}>Back</button>
                </div>
              </Ruled>
            )}

            {partner && (
              <div>
                <div style={{ background: T.card, border: `2px solid ${T.gold}`, borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 700 }}>
                    {partner.kind === "library" ? "LIBRARY PARTNER" : partner.kind === "bookstore" ? "BOOKSHOP PARTNER" : "LITERACY PARTNER"}
                  </div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 24 }}>{partner.name}</div>
                  <div style={{ fontSize: 13, color: T.inkSoft }}>{partner.city}{partner.address ? ` · ${partner.address}` : ""}</div>
                  {partner.blurb && <div style={{ fontSize: 13.5, marginTop: 4 }}>{partner.blurb}</div>}
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, color: T.inkSoft }}>Give teachers this code:</span>
                    <strong style={{ fontFamily: "'Fraunces', serif", fontSize: 24, letterSpacing: 4, color: T.stamp }}>{partner.code}</strong>
                    <button style={{ ...ghostBtn, padding: "3px 11px", fontSize: 12 }} onClick={() => copyCode(partner.code)}>
                      {copied === partner.code ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                </div>

                <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, margin: "0 0 4px" }}>Your offers</h3>
                <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 10px" }}>
                  Codes are handed out one at a time, so you always know how many are in the wild.
                </p>
                {(partner.offers || []).map((o) => (
                  <div key={o.id} style={{ border: `1px solid ${T.rule}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, background: T.paper }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <strong>{o.prize}</strong>
                        <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                          Unlocks at {o.need} {o.metric === "chapters" ? "chapters read" : "quizzes passed"}
                          {" · "}{(o.codes || []).length} code{(o.codes || []).length !== 1 ? "s" : ""} left
                          {o.used ? ` · ${o.used} claimed by classes` : ""}
                        </div>
                        {o.note && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{o.note}</div>}
                      </div>
                      <button aria-label="Remove offer" style={{ background: "none", border: "none", color: T.stamp, cursor: "pointer", fontSize: 15 }}
                        onClick={() => removeOffer(o.id)}>✕</button>
                    </div>
                  </div>
                ))}

                {!showOfferForm ? (
                  <button style={btn(T.green)} onClick={() => setShowOfferForm(true)}>+ Publish an offer</button>
                ) : (
                  <Ruled>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 8 }}>
                      <input style={{ ...input, gridColumn: "1 / -1" }} maxLength={90}
                        placeholder="What do they get? * e.g. $5 off any book"
                        value={offerForm.prize} onChange={(e) => setOfferForm({ ...offerForm, prize: e.target.value })} />
                      <select style={input} value={offerForm.metric} onChange={(e) => setOfferForm({ ...offerForm, metric: e.target.value })}>
                        <option value="chapters">Chapters read</option>
                        <option value="quizzes">Quizzes passed</option>
                      </select>
                      <input style={input} inputMode="numeric" placeholder="How many? *"
                        value={offerForm.need} onChange={(e) => setOfferForm({ ...offerForm, need: e.target.value.replace(/\D/g, "") })} />
                      <input style={{ ...input, gridColumn: "1 / -1" }} maxLength={2000}
                        placeholder="Coupon codes, separated by spaces or commas (optional)"
                        value={offerForm.codes} onChange={(e) => setOfferForm({ ...offerForm, codes: e.target.value })} />
                      <input style={{ ...input, gridColumn: "1 / -1" }} maxLength={120}
                        placeholder="Anything they should know? e.g. Show at the register, one per family"
                        value={offerForm.note} onChange={(e) => setOfferForm({ ...offerForm, note: e.target.value })} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...btn(T.green), opacity: offerForm.prize.trim() && parseInt(offerForm.need) ? 1 : 0.5 }}
                        disabled={!offerForm.prize.trim() || !parseInt(offerForm.need)} onClick={addOffer}>
                        Publish it
                      </button>
                      <button style={ghostBtn} onClick={() => setShowOfferForm(false)}>Cancel</button>
                    </div>
                  </Ruled>
                )}

                <button style={{ ...ghostBtn, marginTop: 14, borderColor: T.stamp, color: T.stamp }}
                  onClick={() => { persist({ partner: null }); setClassMode(null); }}>
                  Close my shop on this device
                </button>
              </div>
            )}

            {/* Family join */}
            {classMode === "family-join" && !family && (
              <Ruled>
                <div style={{ fontWeight: 700, marginBottom: 4, lineHeight: "28px" }}>Follow your reader 💛</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: "28px" }}>
                  Ask your child's teacher for your family code. We never ask for your email or phone number.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
                  <input style={{ ...input, flex: "1 1 160px", letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}
                    placeholder="FAMILY CODE" maxLength={6} value={famCodeInput}
                    onChange={(e) => setFamCodeInput(e.target.value.toUpperCase())} />
                  <button style={{ ...btn(), opacity: famCodeInput.trim().length >= 4 && !famBusy ? 1 : 0.5 }}
                    disabled={famCodeInput.trim().length < 4 || famBusy} onClick={joinFamily}>
                    {famBusy ? "Looking…" : "Follow"}
                  </button>
                  <button style={ghostBtn} onClick={() => setClassMode(null)}>Back</button>
                </div>
              </Ruled>
            )}

            {/* Parent dashboard */}
            {family && (() => {
              const pct = Math.round(((famProgress?.chapter || 0) / (family.chapters || 1)) * 100);
              const qs = Object.values(famProgress?.quizzes || {});
              const nextDue = (family.assignments || []).find((a) => (famProgress?.chapter || 0) < a.chapter);
              return (
                <div>
                  <div style={{ background: T.card, border: `2px solid ${T.blue}`, borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.blue, fontWeight: 700 }}>FOLLOWING</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 24 }}>{family.student}</div>
                    <div style={{ fontSize: 13, color: T.inkSoft }}>
                      {family.className} · {family.teacher} · reading <strong>{family.book}</strong>
                    </div>
                    <div style={{ height: 10, background: "#E4DECB", borderRadius: 99, marginTop: 12 }}>
                      <div style={{ height: 10, borderRadius: 99, width: `${pct}%`, background: pct >= 100 ? T.green : T.blue, transition: "width .3s" }} />
                    </div>
                    <div style={{ fontSize: 13, marginTop: 5 }}>
                      Chapter <strong>{famProgress?.chapter || 0}</strong> of {family.chapters}
                      {qs.length > 0 ? <> · <strong>{qs.filter((q) => q.passed).length}</strong> chapter checks passed</> : null}
                      {famProgress?.minWeek ? <> · <strong>{famProgress.minWeek}</strong> min read this week</> : null}
                    </div>
                    {nextDue && (
                      <div style={{ fontSize: 13, marginTop: 6, color: T.stamp }}>
                        📋 Next up: chapter {nextDue.chapter} by {dueLabel(nextDue.due).text}
                      </div>
                    )}
                    <button style={{ ...ghostBtn, marginTop: 10, padding: "4px 12px", fontSize: 12 }} onClick={() => refreshFamily()}>Refresh ↻</button>
                  </div>

                  {/* ----- Talk to the teacher — front and center, right under progress ----- */}
                  <div style={{ background: T.card, border: `2px solid ${T.green}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.green, fontWeight: 700 }}>💬 TALK TO THE TEACHER</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, margin: "2px 0 6px" }}>
                      Send a message to {family.teacher}
                    </div>
                    <textarea
                      style={{ ...input, width: "100%", boxSizing: "border-box", minHeight: 64, resize: "vertical", fontFamily: "'Atkinson Hyperlegible', sans-serif" }}
                      placeholder="A question, a heads-up, or how reading is going at home — anything helps…"
                      maxLength={400} value={famDraft} onChange={(e) => setFamDraft(e.target.value)} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: T.inkSoft }}>{famDraft.length}/400 · goes straight to {family.teacher}'s Shelf Life</span>
                      <button style={{ ...btn(T.green), padding: "7px 18px", fontSize: 13.5, opacity: famDraft.trim() && !famBusy ? 1 : 0.5 }}
                        disabled={!famDraft.trim() || famBusy} onClick={sendFromFamily}>
                        {famBusy ? "Sending…" : "Send ✉️"}
                      </button>
                    </div>
                  </div>

                  {family.notice && (
                    <div style={{ background: "#FDF6EE", border: `2px dashed ${T.stamp}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.stamp, fontWeight: 700 }}>📣 NOTE TO THE WHOLE CLASS</div>
                      <div style={{ fontSize: 14.5, marginTop: 2 }}>{family.notice}</div>
                    </div>
                  )}

                  <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>
                    Messages with {family.teacher}
                    {unreadFamily > 0 && <span style={{ fontSize: 12, background: T.stamp, color: "#FFF", borderRadius: 999, padding: "2px 9px", marginLeft: 8 }}>{unreadFamily} new</span>}
                  </h3>
                  {famMsgs.length === 0 && <p style={{ fontSize: 13.5, color: T.inkSoft }}>No messages yet — notes from {family.teacher} will appear here, along with anything you send.</p>}
                  {famMsgs.slice().reverse().map((m) => (
                    <div key={m.id} style={{
                      background: m.who === "family" ? "#F0F5F0" : m.at > (famSeen || 0) ? "#F5F8FC" : T.paper,
                      border: `1px solid ${m.who === "family" ? T.green : m.at > (famSeen || 0) ? T.blue : T.rule}`,
                      borderRadius: 10, padding: "11px 14px", marginBottom: 8,
                    }}>
                      <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                        {new Date(m.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {m.who === "family" ? "You" : m.from}
                      </div>
                      <div style={{ fontSize: 14.5, marginTop: 3, whiteSpace: "pre-wrap" }}>{m.text}</div>
                      {m.who !== "family" && (m.ack ? (
                        <div style={{ fontSize: 11.5, color: T.green, marginTop: 5 }}>✓ You let the teacher know you saw this</div>
                      ) : (
                        <button style={{ ...ghostBtn, marginTop: 6, padding: "3px 12px", fontSize: 12 }} onClick={() => ackMessage(m.id)}>👍 Got it</button>
                      ))}
                    </div>
                  ))}


                  <button style={{ ...btn(T.green), marginTop: 8, opacity: famBusy ? 0.6 : 1 }} disabled={famBusy} onClick={familyDigest}>
                    ✨ This week, and one thing to do tonight
                  </button>
                  {tool?.kind === "digest" && tool.text && (
                    <div style={{ marginTop: 10, border: `1.5px dashed ${T.green}`, borderRadius: 10, background: "#F0F5F0", padding: "12px 15px", fontSize: 14.5 }}>
                      {tool.text}
                      <div><button style={{ ...ghostBtn, marginTop: 8, padding: "3px 11px", fontSize: 11.5 }} onClick={() => setTool(null)}>Close</button></div>
                    </div>
                  )}

                  <button style={{ ...ghostBtn, marginTop: 14, borderColor: T.stamp, color: T.stamp }}
                    onClick={() => { persist({ family: null }); setFamProgress(null); setFamMsgs([]); setClassMode(null); }}>
                    Stop following
                  </button>
                </div>
              );
            })()}

            {/* Teacher dashboard */}
            {teaching && classMode !== "teacher-setup" && (
              <div>
                <div style={{
                  border: `2px solid ${T.blue}`, borderRadius: 14, padding: "16px 18px",
                  background: "#F5F8FC", marginBottom: 16, display: "flex", justifyContent: "space-between",
                  alignItems: "center", flexWrap: "wrap", gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.blue, fontWeight: 700 }}>
                      {teaching.kind === "family" ? "YOUR FAMILY CIRCLE" : "YOUR CLASS"}
                    </div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22 }}>{teaching.className}</div>
                    <div style={{ fontSize: 14 }}>Reading <strong>“{teaching.book}”</strong> · {teaching.chapters} chapters · {teaching.teacher}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.inkSoft, fontWeight: 700 }}>JOIN CODE</div>
                    <div style={{
                      fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 32, letterSpacing: "0.15em",
                      border: `2.5px dashed ${T.stamp}`, borderRadius: 10, padding: "4px 16px", color: T.stamp,
                    }}>
                      {teaching.code}
                    </div>
                    <button style={{ ...ghostBtn, marginTop: 6, fontSize: 12, padding: "4px 10px" }} onClick={() => copyCode(teaching.code)}>
                      {copied === teaching.code ? "Copied ✓" : "Copy code"}
                    </button>
                  </div>
                </div>

                {/* Class switcher — one row per class this teacher runs */}
                {(classes || []).length >= 1 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                    {classes.length > 1 && <span style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 700 }}>MY CLASSES:</span>}
                    {classes.map((c) => (
                      <button key={c.code} onClick={() => switchClass(c.code)} style={{
                        padding: "6px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontWeight: 700,
                        border: `1.5px solid ${c.code === teaching.code ? T.blue : T.rule}`,
                        background: c.code === teaching.code ? T.blue : "transparent",
                        color: c.code === teaching.code ? "#FFF" : T.ink,
                        fontFamily: "'Atkinson Hyperlegible', sans-serif",
                      }}>
                        {c.className}
                      </button>
                    ))}
                    <button onClick={() => { setClassForm({ teacher: teaching.teacher, className: "", book: "", chapters: "", kind: teaching.kind || "class" }); setClassMode("teacher-setup"); }}
                      style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontWeight: 700, border: `1.5px dashed ${T.green}`, background: "transparent", color: T.green, fontFamily: "'Atkinson Hyperlegible', sans-serif" }}>
                      + New class
                    </button>
                  </div>
                )}

                {/* Calm sub-navigation: one job per pane */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14, borderBottom: `2px solid ${T.rule}`, paddingBottom: 8 }}>
                  {[["home", "🏠 Start here"], ["readers", "👀 My readers"], ["assign", "📋 Homework"], ["toolkit", "🧰 Do it for me"], ["rewards", "🎁 Rewards"]].map(([k, label]) => (
                    <button key={k} onClick={() => setTPane(k)} style={{
                      padding: "7px 14px", borderRadius: 8, fontSize: 13.5, cursor: "pointer", fontWeight: 700,
                      border: "none", background: tPane === k ? "#DDE8F6" : "transparent",
                      color: tPane === k ? T.blue : T.inkSoft, fontFamily: "'Atkinson Hyperlegible', sans-serif",
                    }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* START HERE — the one screen that answers "what do I do?" */}
                {tPane === "home" && (() => {
                  const r = roster || [];
                  const weekAgo = Date.now() - 7 * 86400000;
                  const stuck = r.filter((x) => (x.chapter || 0) === 0 || (x.updatedAt || 0) < weekAgo);
                  const quizWeek = r.reduce((a, x) => a + Object.values(x.quizzes || {}).filter((q) => q.at > weekAgo && q.passed).length, 0);
                  const nextDue = (teaching.assignments || []).find((a) => new Date(a.due + "T23:59:59") >= new Date());
                  return (
                    <div>
                      {/* Needs your attention */}
                      <div style={{ background: "#F5F8FC", border: `2px solid ${T.blue}`, borderRadius: 12, padding: "14px 17px", marginBottom: 14 }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.13em", color: T.blue, fontWeight: 700 }}>NEEDS YOU THIS WEEK</div>
                        {r.length === 0 ? (
                          <div style={{ fontSize: 14.5, marginTop: 4 }}>
                            No readers yet. Share your class code <strong>{teaching.code}</strong> with your students — they tap Classroom → I'm a student.
                          </div>
                        ) : (
                          <div style={{ fontSize: 14.5, marginTop: 4 }}>
                            {stuck.length > 0
                              ? <>💛 <strong>{stuck.length}</strong> reader{stuck.length !== 1 ? "s" : ""} haven't read this week: {stuck.slice(0, 4).map((x) => x.name).join(", ")}{stuck.length > 4 ? "…" : ""}</>
                              : <>🎉 Everyone has read this week. {quizWeek} chapter check{quizWeek !== 1 ? "s" : ""} passed.</>}
                            {nextDue && <div style={{ marginTop: 4 }}>📋 Next due: chapter {nextDue.chapter}, {dueLabel(nextDue.due).text}</div>}
                          </div>
                        )}
                      </div>

                      {/* Plain-language actions — each says what it DOES, not what it's called */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10 }}>
                        {[
                          ["📝", "Assign reading homework", "Pick a chapter and a due date. Students do it in the app; it grades itself.", () => setTPane("assign"), T.green],
                          ["👀", "See who's where", "Every reader's chapter, quiz scores and read-aloud pace. Alphabetical, never ranked.", () => setTPane("readers"), T.blue],
                          ["👥", "Make my small groups", "One tap. Built from real reading data, grouped by what they need.", () => { setTPane("toolkit"); makeGroups(); }, T.blue],
                          ["💬", "Plan tomorrow's discussion", "Warm-up, four questions and a debate prompt for your book.", () => { setTPane("toolkit"); makeDiscussion(Math.max(1, Math.round(r.reduce((a, x) => a + (x.chapter || 0), 0) / Math.max(1, r.length)) || 1)); }, T.blue],
                          ["📄", "Print a progress report", "A one-page report for a principal or a parent conference.", () => setReport("class"), T.stamp],
                          ["🎁", "Set up a class reward", "Pizza party, movie night, a bookstore coupon — you choose.", () => setTPane("rewards"), T.stamp],
                        ].map(([emoji, title, desc, onClick, color]) => (
                          <button key={title} onClick={onClick} style={{
                            background: T.card, border: `1.5px solid ${T.rule}`, borderRadius: 12,
                            padding: "14px 16px", cursor: "pointer", textAlign: "left",
                            fontFamily: "'Atkinson Hyperlegible', sans-serif",
                          }}>
                            <div style={{ fontSize: 22 }}>{emoji}</div>
                            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 16, color, marginTop: 2 }}>{title}</div>
                            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{desc}</div>
                          </button>
                        ))}
                      </div>

                      <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 14, textAlign: "center" }}>
                        Everything else lives in the tabs above — nothing is hidden, you just don't have to look at it.
                      </p>
                    </div>
                  );
                })()}

                {tPane === "readers" && roster && roster.length > 0 && (() => {
                  const avgCh = (roster.reduce((a, x) => a + (x.chapter || 0), 0) / roster.length).toFixed(1);
                  const weekAgo = Date.now() - 7 * 86400000;
                  const quizWeek = roster.reduce((a, x) => a + Object.values(x.quizzes || {}).filter((q) => q.at > weekAgo && q.passed).length, 0);
                  const stale = roster.filter((x) => (x.chapter || 0) === 0 || (x.updatedAt || 0) < weekAgo).map((x) => x.name);
                  return (
                    <div style={{
                      background: "#F5F8FC", border: `1.5px solid ${T.blue}`, borderRadius: 12,
                      padding: "12px 16px", marginBottom: 14, fontSize: 13.5,
                    }}>
                      <strong>{roster.length} reader{roster.length !== 1 ? "s" : ""}</strong> · averaging <strong>chapter {avgCh}</strong> of {teaching.chapters} · <strong>{quizWeek}</strong> quiz{quizWeek !== 1 ? "zes" : ""} passed this week
                      {stale.length > 0 && (
                        <div style={{ marginTop: 4, color: T.stamp, fontSize: 12.5 }}>
                          💛 Could use a check-in: {stale.slice(0, 4).join(", ")}{stale.length > 4 ? ` +${stale.length - 4} more` : ""}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {tPane === "readers" && (<>
                {/* ----- Family Link: codes + two-way messages ----- */}
                <Ruled style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, lineHeight: "28px" }}>💛 Family Link — invite families & hear back</div>
                  <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "2px 0 8px" }}>
                    Type a reader's name to make their family code — it works even before that reader joins the class.
                    Families enter it on their own phone under <strong>"I'm a parent"</strong> to follow progress, get your notes, and write back to you.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 8 }}>
                    <input style={{ ...input, flex: "1 1 180px" }} placeholder="Reader's first name" maxLength={30}
                      value={famNameInput} onChange={(e) => setFamNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && generateFamilyCode()} />
                    <button style={{ ...btn(T.green), opacity: famNameInput.trim() && !famGenBusy ? 1 : 0.5 }}
                      disabled={!famNameInput.trim() || famGenBusy} onClick={generateFamilyCode}>
                      {famGenBusy ? "Creating…" : "Make family code 💛"}
                    </button>
                  </div>
                  {Object.keys(teaching.family || {}).length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 8 }}>
                      {Object.entries(teaching.family || {}).map(([code, nm]) => (
                        <span key={code} style={{ fontSize: 12, border: `1.5px solid ${T.green}`, borderRadius: 999, padding: "4px 11px", color: T.ink }}>
                          <strong>{nm}</strong> · <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, letterSpacing: "0.08em" }}>{code}</span>
                          <button style={{ ...ghostBtn, marginLeft: 6, padding: "1px 8px", fontSize: 10.5 }} onClick={() => copyCode(code)}>
                            {copied === code ? "copied ✓" : "copy"}
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ borderTop: `1px solid ${T.rule}`, paddingTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13.5 }}>💬 Messages from families</strong>
                      <button style={{ ...ghostBtn, padding: "4px 12px", fontSize: 12 }} disabled={famInboxBusy} onClick={loadFamilyInbox}>
                        {famInboxBusy ? "Checking…" : famInbox ? "Refresh ↻" : "Check messages"}
                      </button>
                    </div>
                    {famInbox && Object.keys(famInbox).length === 0 && (
                      <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "6px 0 2px" }}>No family messages yet — replies to your notes will land here.</p>
                    )}
                    {famInbox && Object.entries(famInbox).map(([nm, msgs]) => (
                      <div key={nm} style={{ border: `1px solid ${T.rule}`, borderRadius: 10, padding: "9px 12px", margin: "8px 0", background: T.paper }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{nm}'s family</div>
                        {msgs.slice(-4).map((m) => (
                          <div key={m.id} style={{
                            fontSize: 13, margin: "4px 0", padding: "6px 9px", borderRadius: 8,
                            background: m.who === "family" ? "#F0F5F0" : "#F5F8FC",
                            borderLeft: `3px solid ${m.who === "family" ? T.green : T.blue}`,
                          }}>
                            <span style={{ fontSize: 10.5, color: T.inkSoft, display: "block" }}>
                              {m.who === "family" ? "👪 Family" : `You (${m.from})`} · {new Date(m.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              {m.who !== "family" && m.ack ? " · seen ✓" : ""}
                            </span>
                            {m.text}
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <input style={{ ...input, flex: 1, padding: "7px 10px", fontSize: 13 }} placeholder={`Reply to ${nm}'s family…`} maxLength={400}
                            value={famReplyDraft[nm] || ""} onChange={(e) => setFamReplyDraft((d) => ({ ...d, [nm]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && replyToFamily(nm)} />
                          <button style={{ ...btn(), padding: "6px 13px", fontSize: 12.5, opacity: (famReplyDraft[nm] || "").trim() ? 1 : 0.5 }}
                            disabled={!(famReplyDraft[nm] || "").trim()} onClick={() => replyToFamily(nm)}>Send</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Ruled>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: 0 }}>
                    Where your readers are
                  </h2>
                  <button style={ghostBtn} onClick={() => loadRoster(teaching.code)}>
                    {rosterLoading ? "Refreshing…" : "Refresh ↻"}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: T.inkSoft, margin: "4px 0 12px" }}>
                  Sorted by name, never by rank — that's the Shelf Life way. Use this to spot who could use a check-in, not a chart.
                </p>

                {roster === null && !rosterLoading && (
                  <button style={btn()} onClick={() => loadRoster(teaching.code)}>Load my class</button>
                )}
                {rosterLoading && <p style={{ color: T.inkSoft }}>Gathering your readers…</p>}
                {roster && roster.length === 0 && !rosterLoading && (
                  <Ruled>
                    <p style={{ margin: 0, lineHeight: "28px" }}>
                      No students yet. Share the code <strong>{teaching.code}</strong> — they join from this same
                      Classroom tab, and their chapter progress appears here.
                    </p>
                  </Ruled>
                )}
                {roster && roster.map((s) => {
                  const pct = Math.round(((s.chapter || 0) / teaching.chapters) * 100);
                  const finished = s.chapter >= teaching.chapters;
                  return (
                    <div key={s.name} style={{
                      border: `1px solid ${T.rule}`, borderRadius: 10, padding: "10px 14px",
                      marginBottom: 8, background: T.paper,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                        <strong>{s.name}</strong>
                        <span style={{ fontSize: 13, color: finished ? T.green : T.inkSoft, fontWeight: finished ? 700 : 400 }}>
                          {finished ? "Finished! 🎉" : s.chapter > 0 ? `Chapter ${s.chapter} of ${teaching.chapters}` : "Getting started"}
                          <span style={{ color: T.inkSoft, fontWeight: 400 }}> · updated {timeAgo(s.updatedAt)}</span>
                        </span>
                      </div>
                      <div style={{ height: 8, background: "#E4DECB", borderRadius: 99, marginTop: 6 }}>
                        <div style={{
                          height: 8, borderRadius: 99, width: `${pct}%`,
                          background: finished ? T.green : T.blue, transition: "width .3s",
                        }} />
                      </div>
                      {(() => {
                        const nm = s.name;
                        const editing = noteDraft[nm] !== undefined;
                        return (
                          <div style={{ marginTop: 7 }}>
                            {notes[nm] && !editing && (
                              <div style={{ fontSize: 12.5, background: "#FDF6EE", borderLeft: `3px solid ${T.stamp}`, padding: "4px 9px", borderRadius: 4 }}>
                                📝 {notes[nm]}
                              </div>
                            )}
                            {editing ? (
                              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                                <input style={{ ...input, flex: "1 1 200px", fontSize: 13, padding: "6px 10px" }} maxLength={400}
                                  placeholder="Conference note — what to check in about"
                                  value={noteDraft[nm]} onChange={(e) => setNoteDraft((d) => ({ ...d, [nm]: e.target.value }))} />
                                <button style={{ ...btn(), padding: "5px 12px", fontSize: 12 }} onClick={() => saveNote(nm)}>Save</button>
                                <button style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }} onClick={() => setNoteDraft((d) => ({ ...d, [nm]: undefined }))}>Cancel</button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                <button style={{ background: "none", border: "none", color: T.inkSoft, cursor: "pointer", fontSize: 11.5, padding: "3px 0", textDecoration: "underline", fontFamily: "'Atkinson Hyperlegible', sans-serif" }}
                                  onClick={() => setNoteDraft((d) => ({ ...d, [nm]: notes[nm] || "" }))}>
                                  {notes[nm] ? "edit note" : "+ add a conference note"}
                                </button>
                                <button style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontSize: 11.5, padding: "3px 0", textDecoration: "underline", fontFamily: "'Atkinson Hyperlegible', sans-serif" }}
                                  onClick={() => { setTPane("toolkit"); makeFamilyNote(s, "en"); }}>
                                  ✉️ write a family note
                                </button>
                                {(() => {
                                  const fc = Object.entries(teaching.family || {}).find(([, n]) => n === nm)?.[0];
                                  return fc ? (
                                    <span style={{ fontSize: 11.5, color: T.green, fontWeight: 700 }}>
                                      💛 family code: {fc}
                                      <button style={{ ...ghostBtn, marginLeft: 6, padding: "1px 8px", fontSize: 10.5 }} onClick={() => copyCode(fc)}>
                                        {copied === fc ? "copied ✓" : "copy"}
                                      </button>
                                    </span>
                                  ) : (
                                    <button style={{ background: "none", border: "none", color: T.green, cursor: "pointer", fontSize: 11.5, padding: "3px 0", textDecoration: "underline", fontFamily: "'Atkinson Hyperlegible', sans-serif" }}
                                      onClick={async () => { const c = await makeFamilyCode(nm); if (c) flash(`Family code for ${nm}: ${c} — share it with the family 💛`); }}>
                                      💛 invite the family
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {s.quizzes && Object.keys(s.quizzes).length > 0 && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                          {Object.entries(s.quizzes).filter(([, q]) => q.think).map(([n, q]) => (
                            <div key={`t${n}`} style={{ width: "100%", fontSize: 12.5, background: "#F5F8FC", borderLeft: `3px solid ${T.blue}`, padding: "5px 9px", borderRadius: 4, marginBottom: 4 }}>
                              💭 <strong>Ch{n}:</strong> {q.think}
                            </div>
                          ))}
                          {Object.entries(s.quizzes).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, q]) => (
                            <span key={n} style={{
                              fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 9px",
                              background: q.passed ? "#E5F0E7" : "#F6E9E6",
                              color: q.passed ? T.green : T.stamp,
                              border: `1px solid ${q.passed ? T.green : T.stamp}`,
                            }}>
                              🧠 Ch{n}: {q.score}/{q.total}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                </>)}

                {/* Teacher toolbox */}
                {(tPane === "assign" || tPane === "toolkit") && (
                <div style={{ marginTop: 4 }}>
                  {tPane === "assign" && (<>
                  {/* Homework builder */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19 }}>📝 Reading homework</div>
                    <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "2px 0 10px" }}>
                      You pick the {lvl(teaching).unit} — we write it for <strong>{lvl(teaching).label}</strong>, and it grades itself.
                      {lvl(teaching).homeworkFor === "family" ? " Activities are written for a grown-up to do with the child." : ""}
                      {" "}Nothing gets posted until you read it and approve it.
                    </p>

                    {(teaching.homework || []).map((h) => {
                      const done = (roster || []).filter((r) => (r.homeworkDone || {})[h.id]).length;
                      const d = h.due ? dueLabel(h.due) : null;
                      return (
                        <div key={h.id} style={{ border: `1px solid ${T.rule}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, background: T.paper }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div>
                              <strong>{h.title}</strong>
                              <div style={{ fontSize: 12.5, color: d?.late ? T.stamp : T.inkSoft }}>
                                {lvl(teaching).Unit} {h.chapter} · {h.items.length} questions{d ? ` · due ${d.text}` : ""}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: (roster || []).length && done === roster.length ? T.green : T.ink }}>
                                {done}/{(roster || []).length} turned in
                              </span>
                              <button style={{ ...ghostBtn, padding: "3px 11px", fontSize: 12 }} onClick={() => setHwResults(hwResults?.id === h.id ? null : h)}>
                                {hwResults?.id === h.id ? "Hide" : "See answers"}
                              </button>
                              <button aria-label="Remove" style={{ background: "none", border: "none", color: T.stamp, cursor: "pointer", fontSize: 15 }} onClick={() => deleteHomework(h.id)}>✕</button>
                            </div>
                          </div>

                          {hwResults?.id === h.id && (
                            <div style={{ marginTop: 10, borderTop: `1px solid ${T.rule}`, paddingTop: 8 }}>
                              {(roster || []).length === 0 && <div style={{ fontSize: 13, color: T.inkSoft }}>No readers yet.</div>}
                              {(roster || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((st) => {
                                const sub = (st.homeworkDone || {})[h.id];
                                return (
                                  <div key={st.name} style={{ padding: "7px 0", borderBottom: `1px solid ${T.rule}` }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                      <strong style={{ fontSize: 14 }}>{st.name}</strong>
                                      <span style={{ fontSize: 12.5, color: sub ? T.green : T.inkSoft }}>
                                        {sub ? (sub.mcCount ? `${sub.correct}/${sub.mcCount} correct` : "turned in ✓") : "not yet"}
                                      </span>
                                    </div>
                                    {(sub?.written || []).map((w, wi) => (
                                      <div key={wi} style={{ fontSize: 12.5, marginTop: 4, background: "#F5F8FC", borderLeft: `3px solid ${T.blue}`, padding: "5px 9px", borderRadius: 4 }}>
                                        <div style={{ color: T.inkSoft }}>{w.q}</div>
                                        <div style={{ marginTop: 2 }}>💬 {w.a}</div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!hwShow ? (
                      <button style={btn(T.green)} onClick={() => setHwShow(true)}>+ Create homework</button>
                    ) : !hwDraft ? (
                      <Ruled>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 8 }}>
                          <input style={input} inputMode="numeric" placeholder={`${lvl(teaching).Unit} *`} value={hwForm.chapter}
                            onChange={(e) => setHwForm({ ...hwForm, chapter: e.target.value.replace(/\D/g, "") })} />
                          <input style={input} type="date" value={hwForm.due} onChange={(e) => setHwForm({ ...hwForm, due: e.target.value })} />
                          <select style={input} value={hwForm.kind} onChange={(e) => setHwForm({ ...hwForm, kind: e.target.value })}>
                            {Object.keys(lvl(teaching).hwKinds).map((k) => (
                              <option key={k} value={k}>{({
                                readtogether: "Read together at home", letters: "Letter & sound hunt", talk: "Talk about it",
                                sight: "Sight words & sounds", comprehension: "What happened & why", draw: "Draw and tell",
                                vocabulary: "Vocabulary", response: "Written response", evidence: "Text evidence",
                                analysis: "Literary analysis", argument: "Argument / take a position", mixed: "A mix of everything",
                              })[k] || k}</option>
                            ))}
                          </select>
                          <select style={input} value={hwForm.count} onChange={(e) => setHwForm({ ...hwForm, count: e.target.value })}>
                            {[3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n} questions</option>)}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={{ ...btn(T.green), opacity: hwForm.chapter ? 1 : 0.5 }} disabled={!hwForm.chapter} onClick={draftHomework}>
                            Write it for me ✨
                          </button>
                          <button style={{ ...ghostBtn, opacity: hwForm.chapter ? 1 : 0.5 }} disabled={!hwForm.chapter} onClick={blankHomework}>
                            I'll write my own
                          </button>
                          <button style={ghostBtn} onClick={() => setHwShow(false)}>Cancel</button>
                        </div>
                      </Ruled>
                    ) : (
                      <div style={{ border: `2px solid ${T.blue}`, borderRadius: 12, background: "#F5F8FC", padding: "14px 16px" }}>
                        {hwDraft.loading ? (
                          <div style={{ color: T.inkSoft }}>Writing chapter {hwDraft.chapter} homework…</div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.blue, fontWeight: 700 }}>YOUR DRAFT — NOTHING IS POSTED YET</div>
                            <input style={{ ...input, fontWeight: 700, marginTop: 6 }} value={hwDraft.title}
                              onChange={(e) => setHwDraft({ ...hwDraft, title: e.target.value })} />
                            {hwDraft.items.map((it, i) => (
                              <div key={i} style={{ marginTop: 10, background: T.card, border: `1px solid ${T.rule}`, borderRadius: 8, padding: "9px 12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <span style={{ fontSize: 11, color: it.type === "mc" ? T.blue : T.stamp, fontWeight: 700 }}>
                                    {it.type === "mc" ? "MULTIPLE CHOICE" : "WRITTEN ANSWER"}
                                  </span>
                                  <button aria-label="Remove question" style={{ background: "none", border: "none", color: T.stamp, cursor: "pointer", fontSize: 13 }}
                                    onClick={() => setHwDraft({ ...hwDraft, items: hwDraft.items.filter((_, k) => k !== i) })}>✕</button>
                                </div>
                                <textarea style={{ width: "100%", boxSizing: "border-box", border: "none", background: "transparent", fontSize: 14, fontFamily: "'Atkinson Hyperlegible', sans-serif", color: T.ink, resize: "vertical", minHeight: 42, outline: "none" }}
                                  value={it.q} onChange={(e) => { const items = [...hwDraft.items]; items[i] = { ...it, q: e.target.value }; setHwDraft({ ...hwDraft, items }); }} />
                                {it.type === "mc" && it.options.map((o, oi) => (
                                  <div key={oi} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 4, marginTop: 3 }}>
                                    <button title="Mark as the correct answer" onClick={() => { const items = [...hwDraft.items]; items[i] = { ...it, answer: oi }; setHwDraft({ ...hwDraft, items }); }}
                                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: oi === it.answer ? T.green : T.rule, width: 20 }}>
                                      {oi === it.answer ? "✓" : "○"}
                                    </button>
                                    <input value={o} placeholder={`Choice ${oi + 1}`}
                                      onChange={(e) => { const items = [...hwDraft.items]; const opts = [...it.options]; opts[oi] = e.target.value; items[i] = { ...it, options: opts }; setHwDraft({ ...hwDraft, items }); }}
                                      style={{ flex: 1, border: "none", borderBottom: `1px solid ${T.rule}`, background: "transparent", fontSize: 13, padding: "3px 2px", color: oi === it.answer ? T.green : T.ink, fontWeight: oi === it.answer ? 700 : 400, fontFamily: "'Atkinson Hyperlegible', sans-serif", outline: "none" }} />
                                  </div>
                                ))}
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                              <button style={{ ...ghostBtn, padding: "5px 12px", fontSize: 12.5 }} onClick={() => addHwItem("mc")}>+ Multiple choice</button>
                              <button style={{ ...ghostBtn, padding: "5px 12px", fontSize: 12.5 }} onClick={() => addHwItem("open")}>+ Written answer</button>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                              <button style={btn(T.green)} onClick={publishHomework}>Looks good — post it 📝</button>
                              {!hwDraft.mine && <button style={ghostBtn} onClick={draftHomework}>Rewrite it ↻</button>}
                              <button style={ghostBtn} onClick={() => setHwDraft(null)}>Start over</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button style={{ ...btn(), marginBottom: 12 }} onClick={() => setReport("class")}>
                    📄 Class progress report (print / PDF)
                  </button>

                  {/* Assignments */}
                  <Ruled style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, lineHeight: "28px" }}>📋 Reading assignments</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: "28px" }}>
                      "Read chapter 3 by Friday." Readers see what's due; you see who's there — no paper logs.
                    </div>
                    {(teaching.assignments || []).map((a) => {
                      const done = (roster || []).filter((r) => (r.chapter || 0) >= a.chapter).length;
                      const total = (roster || []).length;
                      const d = dueLabel(a.due);
                      return (
                        <div key={a.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                          flexWrap: "wrap", padding: "8px 0", borderTop: `1px solid ${T.rule}`,
                        }}>
                          <div>
                            <strong>Chapter {a.chapter}</strong>
                            <span style={{ fontSize: 12.5, color: d.late ? T.stamp : T.inkSoft, marginLeft: 8 }}>
                              due {d.text}
                            </span>
                            {a.note && <div style={{ fontSize: 12.5, color: T.inkSoft }}>{a.note}</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: total && done === total ? T.green : T.ink }}>
                              {done}/{total} there
                            </span>
                            <button aria-label="Remove assignment" style={{ background: "none", border: "none", color: T.stamp, cursor: "pointer", fontSize: 15 }}
                              onClick={() => deleteAssignment(a.id)}>✕</button>
                          </div>
                        </div>
                      );
                    })}
                    {!showAssignForm ? (
                      <button style={{ ...btn(T.green), marginTop: 8 }} onClick={() => setShowAssignForm(true)}>+ Add an assignment</button>
                    ) : (
                      <div style={{ paddingTop: 8 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 8 }}>
                          <input style={input} inputMode="numeric" placeholder={`${lvl(teaching).Unit} *`} value={assignForm.chapter}
                            onChange={(e) => setAssignForm({ ...assignForm, chapter: e.target.value.replace(/\D/g, "") })} />
                          <input style={input} type="date" value={assignForm.due}
                            onChange={(e) => setAssignForm({ ...assignForm, due: e.target.value })} />
                          <input style={input} maxLength={120} placeholder="Note (optional)" value={assignForm.note}
                            onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={{ ...btn(T.green), opacity: assignForm.chapter && assignForm.due ? 1 : 0.5 }}
                            disabled={!assignForm.chapter || !assignForm.due} onClick={saveAssignment}>Post assignment</button>
                          <button style={ghostBtn} onClick={() => setShowAssignForm(false)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </Ruled>

                  </>)}

                  {tPane === "toolkit" && (<>
                  {/* Tools that use this class's book + real reading data */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 18, marginBottom: 2 }}>Save yourself an hour 🧰</div>
                    <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 10px" }}>
                      Built from your book and what your readers actually did — not generic templates.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
                      <button style={{ ...btn(T.green), padding: "12px 14px", fontSize: 13.5 }} onClick={makeGroups}>
                        👥 Make my small groups
                      </button>
                      <button style={{ ...btn(), padding: "12px 14px", fontSize: 13.5 }}
                        onClick={() => makeDiscussion(Math.max(1, Math.min(teaching.chapters, Math.round((roster || []).reduce((a, x) => a + (x.chapter || 0), 0) / Math.max(1, (roster || []).length)) || 1)))}>
                        💬 Discussion questions
                      </button>
                      <button style={{ ...btn(), padding: "12px 14px", fontSize: 13.5 }} onClick={makeVocab}>
                        📖 Class vocabulary report
                      </button>
                      <button style={{ ...ghostBtn, padding: "12px 14px", fontSize: 13.5 }} onClick={() => { setTPane("readers"); flash("Tap a reader's name row to write a family note ✉️"); }}>
                        ✉️ Family notes
                      </button>
                    </div>

                    {tool && (
                      <div style={{ marginTop: 12, border: `1.5px solid ${T.blue}`, borderRadius: 12, background: "#F5F8FC", padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <strong style={{ fontSize: 15 }}>
                            {tool.kind === "groups" ? "👥 Suggested small groups" : tool.kind === "discuss" ? `💬 Chapter ${tool.chapter} discussion` : tool.kind === "vocab" ? "📖 What your class is stumbling on" : "✉️ Family note"}
                          </strong>
                          <button aria-label="Close" style={{ background: "none", border: "none", color: T.inkSoft, cursor: "pointer", fontSize: 16 }} onClick={() => setTool(null)}>✕</button>
                        </div>
                        {tool.loading && <div style={{ color: T.inkSoft, fontSize: 13.5 }}>Working from your class data…</div>}

                        {tool.kind === "groups" && tool.data && tool.data.map((g, i) => (
                          <div key={i} style={{ background: T.paper, border: `1px solid ${T.rule}`, borderRadius: 10, padding: "10px 13px", marginBottom: 8 }}>
                            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 16 }}>{g.name}</div>
                            <div style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>{(g.members || []).join(" · ")}</div>
                            <div style={{ fontSize: 13, marginTop: 3 }}><strong>Focus:</strong> {g.need}</div>
                            <div style={{ fontSize: 13, marginTop: 2 }}><strong>10 minutes:</strong> {g.activity}</div>
                          </div>
                        ))}

                        {tool.kind === "discuss" && tool.data && (
                          <div style={{ fontSize: 13.5 }}>
                            <div style={{ marginBottom: 8 }}><strong>Warm-up:</strong> {tool.data.warmup}</div>
                            <strong>Discussion:</strong>
                            <ol style={{ margin: "4px 0 8px", paddingLeft: 20 }}>
                              {(tool.data.questions || []).map((q, i) => <li key={i} style={{ marginBottom: 3 }}>{q}</li>)}
                            </ol>
                            <div style={{ marginBottom: 8, padding: "8px 11px", background: "#FDF6EE", borderLeft: `3px solid ${T.stamp}`, borderRadius: 4 }}>
                              <strong>Split the room:</strong> {tool.data.debate}
                            </div>
                            <div><strong>Exit ticket:</strong> {tool.data.exit}</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                              <button style={{ ...ghostBtn, padding: "4px 11px", fontSize: 12 }} onClick={() => makeDiscussion(Math.max(1, (tool.chapter || 1) - 1))}>← Earlier chapter</button>
                              <button style={{ ...ghostBtn, padding: "4px 11px", fontSize: 12 }} onClick={() => makeDiscussion(Math.min(teaching.chapters, (tool.chapter || 1) + 1))}>Later chapter →</button>
                            </div>
                          </div>
                        )}

                        {tool.kind === "vocab" && tool.data && (
                          <div style={{ fontSize: 13.5 }}>
                            <p style={{ margin: "0 0 8px", color: T.inkSoft, fontSize: 12.5 }}>
                              These are the words your readers actually tapped for help this week.
                            </p>
                            {(tool.data.words || []).map((w, i) => (
                              <div key={i} style={{ padding: "6px 0", borderTop: `1px solid ${T.rule}` }}>
                                <strong>{w.word}</strong>
                                {tool.counts?.[w.word] > 1 && <span style={{ fontSize: 11.5, color: T.stamp, marginLeft: 6 }}>{tool.counts[w.word]} readers</span>}
                                <div>{w.meaning}</div>
                                <div style={{ color: T.inkSoft, fontStyle: "italic" }}>{w.example}</div>
                              </div>
                            ))}
                            {tool.data.warmup && (
                              <div style={{ marginTop: 10, padding: "9px 12px", background: "#F0F5F0", borderRadius: 8 }}>
                                <strong>5-minute warm-up:</strong> {tool.data.warmup}
                              </div>
                            )}
                          </div>
                        )}

                        {tool.kind === "note" && tool.text && (
                          <div>
                            <div style={{ fontSize: 14, background: T.card, border: `1px solid ${T.rule}`, borderRadius: 8, padding: "11px 13px", whiteSpace: "pre-wrap" }}>
                              {tool.text}
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                              <button style={{ ...btn(T.green), padding: "5px 13px", fontSize: 12.5 }}
                                onClick={() => sendToFamily(tool.forName, tool.text)}>
                                ✉️ Send to their family
                              </button>
                              <button style={{ ...ghostBtn, padding: "5px 13px", fontSize: 12.5 }} onClick={() => copyCode(tool.text)}>
                                {copied === tool.text ? "Copied ✓" : "Copy note"}
                              </button>
                              <button style={{ ...ghostBtn, padding: "5px 13px", fontSize: 12.5 }}
                                onClick={() => makeFamilyNote((roster || []).find((r) => r.name === tool.forName) || { name: tool.forName }, tool.lang === "es" ? "en" : "es")}>
                                {tool.lang === "es" ? "Switch to English" : "Escribir en español 🇲🇽"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Any text */}
                  <Ruled style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, lineHeight: "28px" }}>📄 Use your own text</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: "28px" }}>
                      An article, a primary source, a poem, a science passage — paste it and it becomes a full
                      Shelf Life reading: tap-a-word, read-aloud, and questions written from the actual text.
                    </div>
                    {teaching.customText ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "6px 0 4px" }}>
                        <div>
                          <strong>{teaching.customText.title}</strong>
                          <div style={{ fontSize: 12, color: T.inkSoft }}>
                            {teaching.customText.body.split(/\s+/).length.toLocaleString()} words · your readers see this in Classroom
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={{ ...ghostBtn, padding: "4px 12px", fontSize: 12 }}
                            onClick={() => openTextReader(teaching.customText.title, teaching.teacher, teaching.customText.body)}>
                            Preview
                          </button>
                          <button aria-label="Remove text" style={{ background: "none", border: "none", color: T.stamp, cursor: "pointer", fontSize: 15 }}
                            onClick={removeClassText}>✕</button>
                        </div>
                      </div>
                    ) : !showTextForm ? (
                      <button style={{ ...btn(T.green), marginTop: 4 }} onClick={() => setShowTextForm(true)}>+ Paste a text</button>
                    ) : (
                      <div style={{ paddingTop: 6 }}>
                        <input style={{ ...input, marginBottom: 8 }} maxLength={90} placeholder="Title * (e.g. The Gettysburg Address)"
                          value={textForm.title} onChange={(e) => setTextForm({ ...textForm, title: e.target.value })} />
                        <textarea
                          style={{ width: "100%", boxSizing: "border-box", minHeight: 150, padding: "10px 12px", border: `1.5px solid ${T.rule}`, borderRadius: 8, background: T.card, color: T.ink, fontSize: 14, fontFamily: "'Atkinson Hyperlegible', sans-serif", outline: "none", resize: "vertical" }}
                          placeholder="Paste the passage here…"
                          value={textForm.body} onChange={(e) => setTextForm({ ...textForm, body: e.target.value })} />
                        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <button style={{ ...btn(T.green), opacity: textForm.title.trim() && textForm.body.trim().length > 40 ? 1 : 0.5 }}
                            disabled={!textForm.title.trim() || textForm.body.trim().length <= 40} onClick={saveClassText}>
                            Post this text
                          </button>
                          <button style={ghostBtn} onClick={() => setShowTextForm(false)}>Cancel</button>
                          <span style={{ fontSize: 11.5, color: T.inkSoft }}>
                            {textForm.body.trim() ? `${textForm.body.trim().split(/\s+/).length} words` : "at least a short paragraph"}
                          </span>
                        </div>
                      </div>
                    )}
                  </Ruled>

                  {/* Message to the class */}
                  <Ruled style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, lineHeight: "28px" }}>📣 Message to your readers</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: "28px" }}>
                      Shows at the top of every reader's classroom page — encouragement, reminders, shout-outs.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
                      <input style={{ ...input, flex: "1 1 220px" }} maxLength={200}
                        placeholder={teaching.notice ? `Current: "${teaching.notice}"` : 'e.g. "Great quiz scores this week — chapter 5 by Friday! 🌟"'}
                        value={noticeDraft} onChange={(e) => setNoticeDraft(e.target.value)} />
                      <button style={btn()} onClick={saveNotice}>Post</button>
                    </div>
                  </Ruled>

                  {/* Chapters edit */}
                  <Ruled style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, lineHeight: "28px" }}>📖 Book length: {teaching.chapters} {lvl(teaching).units}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: "28px" }}>
                      Different edition? Update it here — every reader's tracker adjusts instantly.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
                      <input style={{ ...input, flex: "0 1 140px" }} inputMode="numeric" placeholder="New count"
                        value={chaptersDraft} onChange={(e) => setChaptersDraft(e.target.value.replace(/\D/g, ""))} />
                      <button style={{ ...btn(), opacity: parseInt(chaptersDraft) ? 1 : 0.5 }} disabled={!parseInt(chaptersDraft)} onClick={saveChapters}>Update</button>
                    </div>
                  </Ruled>

                  {/* Quiz bank */}
                  <Ruled>
                    <div style={{ fontWeight: 700, lineHeight: "28px" }}>🧠 Chapter quiz bank</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: "28px" }}>
                      Every reader gets the same 3 questions per chapter. Peek at any quiz — answers marked with ✓.
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "4px 0 8px" }}>
                      {Array.from({ length: teaching.chapters }, (_, i) => i + 1).map((n) => (
                        <button key={n} onClick={() => viewClassQuiz(n)} style={{
                          padding: "5px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", fontWeight: 700,
                          border: `1.5px solid ${quizBank[n]?.isOpen ? T.blue : T.rule}`,
                          background: quizBank[n]?.isOpen ? "#DDE8F6" : "transparent", color: T.ink,
                          fontFamily: "'Atkinson Hyperlegible', sans-serif",
                        }}>
                          Ch {n}
                        </button>
                      ))}
                    </div>
                    {Object.entries(quizBank).filter(([, v]) => v.isOpen).map(([n, v]) => (
                      <div key={n} style={{ background: "#F5F8FC", border: `1px solid ${T.rule}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, fontSize: 13 }}>
                        <strong>Chapter {n} quiz</strong>
                        {!v.loading && v.open && (
                          <div style={{ margin: "8px 0", padding: "6px 9px", background: "#FDF6EE", borderLeft: `3px solid ${T.stamp}`, borderRadius: 4 }}>
                            💭 <strong>Thinking question:</strong> {v.open}
                          </div>
                        )}
                        {v.loading ? <div style={{ color: T.inkSoft }}>Writing the questions…</div> :
                          (v.questions || []).map((q, qi) => (
                            <div key={qi} style={{ margin: "8px 0" }}>
                              <div style={{ fontWeight: 700 }}>{qi + 1}. {q.q}</div>
                              {q.options.map((opt, oi) => (
                                <div key={oi} style={{ paddingLeft: 12, color: oi === q.answer ? T.green : T.inkSoft, fontWeight: oi === q.answer ? 700 : 400 }}>
                                  {oi === q.answer ? "✓ " : "· "}{opt}
                                </div>
                              ))}
                            </div>
                          ))}
                      </div>
                    ))}
                  </Ruled>
                  </>)}
                </div>
                )}

                {/* Class rewards manager */}
                {tPane === "rewards" && (
                <div style={{ marginTop: 4 }}>
                  <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "0 0 4px" }}>
                    {teaching.kind === "family" ? "Family rewards 🎁" : "Class rewards 🎁"}
                  </h2>
                  <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 10px" }}>
                    {teaching.kind === "family"
                      ? "Set your own prizes — movie night, ice cream trip, a new book. Your readers see them instantly with a progress bar."
                      : "Set your own prizes — pizza party, free-book coupon from a local bookstore, extra recess. Students see them instantly with a progress bar toward each one."}
                  </p>
                  {(teaching.rewards || []).map((r) => (
                    <div key={r.id} style={{
                      border: `1px solid ${T.rule}`, borderRadius: 10, padding: "9px 14px", marginBottom: 8,
                      background: T.paper, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
                    }}>
                      <div>
                        <strong>{r.prize}</strong>
                        <div style={{ fontSize: 12, color: T.inkSoft }}>
                          Unlocks at {r.need} {r.metric === "chapters" ? "chapters read" : "chapter quizzes passed"}{r.code ? ` · code: ${r.code}` : ""}
                        </div>
                      </div>
                      <button aria-label="Remove reward" style={{ background: "none", border: "none", color: T.stamp, cursor: "pointer", fontSize: 15 }}
                        onClick={() => deleteClassReward(r.id)}>✕</button>
                    </div>
                  ))}
                  {/* Local partner offers */}
                  <div style={{ background: "#FDF8EE", border: `1.5px solid ${T.gold}`, borderRadius: 11, padding: "12px 15px", marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>🏪 Add a reward from a local bookshop or library</div>
                    <div style={{ fontSize: 12.5, color: T.inkSoft, margin: "2px 0 8px" }}>
                      Ask them for their Shelf Life code. Their offer becomes a class reward, and one coupon code is
                      reserved for your class.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input style={{ ...input, flex: "0 1 170px", letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}
                        maxLength={6} placeholder="SHOP CODE" value={partnerCodeInput}
                        onChange={(e) => setPartnerCodeInput(e.target.value.toUpperCase())} />
                      <button style={{ ...btn(), opacity: partnerCodeInput.trim().length >= 4 && !partnerBusy ? 1 : 0.5 }}
                        disabled={partnerCodeInput.trim().length < 4 || partnerBusy} onClick={lookupPartner}>
                        {partnerBusy ? "Looking…" : "Find their offers"}
                      </button>
                    </div>
                    {foundPartner && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 16 }}>{foundPartner.name}</div>
                        <div style={{ fontSize: 12.5, color: T.inkSoft }}>{foundPartner.city}{foundPartner.address ? ` · ${foundPartner.address}` : ""}</div>
                        {(foundPartner.offers || []).length === 0 && (
                          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>No offers published yet.</div>
                        )}
                        {(foundPartner.offers || []).map((o) => (
                          <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${T.rule}`, padding: "8px 0" }}>
                            <div>
                              <strong style={{ fontSize: 14 }}>{o.prize}</strong>
                              <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                                {o.need} {o.metric === "chapters" ? "chapters read" : "quizzes passed"}
                                {o.codes?.length ? ` · ${o.codes.length} available` : " · no code needed"}
                              </div>
                            </div>
                            <button style={{ ...btn(T.green), padding: "5px 13px", fontSize: 12.5 }}
                              onClick={() => attachPartnerOffer(foundPartner, o)}>
                              Add to my class
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {!showRewardForm ? (
                    <button style={btn(T.green)} onClick={() => setShowRewardForm(true)}>+ Add a class reward</button>
                  ) : (
                    <Ruled>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
                        <input style={input} placeholder="Prize * (e.g. Pizza party, $5 bookstore coupon)" maxLength={80} value={rewardForm.prize}
                          onChange={(e) => setRewardForm({ ...rewardForm, prize: e.target.value })} />
                        <select style={input} value={rewardForm.metric} onChange={(e) => setRewardForm({ ...rewardForm, metric: e.target.value })}>
                          <option value="chapters">Chapters read</option>
                          <option value="quizzes">Chapter quizzes passed</option>
                        </select>
                        <input style={input} placeholder="How many? *" inputMode="numeric" value={rewardForm.need}
                          onChange={(e) => setRewardForm({ ...rewardForm, need: e.target.value.replace(/\D/g, "") })} />
                        <input style={input} placeholder="Coupon code (optional)" maxLength={30} value={rewardForm.code}
                          onChange={(e) => setRewardForm({ ...rewardForm, code: e.target.value })} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ ...btn(T.green), opacity: rewardForm.prize.trim() && parseInt(rewardForm.need) ? 1 : 0.5 }}
                          disabled={!rewardForm.prize.trim() || !parseInt(rewardForm.need)}
                          onClick={saveClassReward}>
                          Add reward
                        </button>
                        <button style={ghostBtn} onClick={() => setShowRewardForm(false)}>Cancel</button>
                      </div>
                    </Ruled>
                  )}
                </div>

                )}

                <button style={{ ...ghostBtn, marginTop: 12, borderColor: T.stamp, color: T.stamp }}
                  onClick={() => closeClass(teaching.code)}>
                  Close this class on my device
                </button>
              </div>
            )}

            {/* Student class view */}
            {classroom && (
              <div style={{ marginTop: teaching ? 24 : 0 }}>
                <div style={{
                  border: `2px solid ${T.green}`, borderRadius: 14, padding: "16px 18px",
                  background: "#F0F5F0", marginBottom: 14,
                }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.green, fontWeight: 700 }}>
                    {classroom.kind === "family" ? "YOUR FAMILY CIRCLE" : "YOUR CLASS"}
                  </div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22 }}>{classroom.className}</div>
                  <div style={{ fontSize: 14 }}>
                    Reading <strong>“{classroom.book}”</strong> with {classroom.teacher} · you're in as <strong>{classroom.name}</strong>
                  </div>
                </div>

                <Ruled>
                  <div style={{ fontWeight: 700, lineHeight: "28px" }}>Where are you in the book?</div>
                  <p style={{ fontSize: 13, color: T.inkSoft, margin: "0 0 10px", lineHeight: "28px" }}>
                    Update when you're ready — no one's timing you, and rereading a chapter counts as reading.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <button aria-label="Back a chapter" style={{ ...ghostBtn, fontSize: 18, padding: "6px 16px" }} onClick={() => updateChapter(-1)}>−</button>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 34 }}>
                        {classroom.chapter || 0}
                      </div>
                      <div style={{ fontSize: 12, color: T.inkSoft, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        of {classroom.chapters} chapters
                      </div>
                    </div>
                    <button aria-label="Finished a chapter" style={{ ...btn(T.green), fontSize: 15 }} onClick={() => updateChapter(1)}>
                      + I finished a chapter
                    </button>
                  </div>
                  <div style={{ height: 10, background: "#E4DECB", borderRadius: 99, marginTop: 14, marginBottom: 6 }}>
                    <div style={{
                      height: 10, borderRadius: 99, transition: "width .3s",
                      width: `${Math.round(((classroom.chapter || 0) / classroom.chapters) * 100)}%`,
                      background: (classroom.chapter || 0) >= classroom.chapters ? T.green : T.blue,
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: "28px" }}>
                    Your teacher can see your chapter and quiz scores — that's how they know when to help, not to rank you.
                  </div>

                  {classroom.customText && (
                    <div style={{
                      marginTop: 10, background: T.paper, border: `1.5px solid ${T.blue}`,
                      borderRadius: 10, padding: "11px 14px", display: "flex",
                      justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
                    }}>
                      <div>
                        <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.blue, fontWeight: 700 }}>📄 CLASS READING</div>
                        <strong style={{ fontSize: 15.5 }}>{classroom.customText.title}</strong>
                      </div>
                      <button style={btn()} onClick={() => openTextReader(classroom.customText.title, classroom.teacher, classroom.customText.body)}>
                        Open it 📖
                      </button>
                    </div>
                  )}

                  {/* Homework from the teacher */}
                  {(classroom.homework || []).length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.stamp, fontWeight: 700 }}>📝 HOMEWORK</div>
                      {classroom.homework.map((h) => {
                        const sub = (classroom.homeworkDone || {})[h.id];
                        const d = h.due ? dueLabel(h.due) : null;
                        return (
                          <div key={h.id} style={{
                            border: `1.5px solid ${sub ? T.green : d?.late ? T.stamp : T.rule}`,
                            background: sub ? "#F0F5F0" : T.paper, borderRadius: 10, padding: "10px 14px", marginTop: 6,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <div>
                                <strong>{sub ? "✓ " : ""}{h.title}</strong>
                                <div style={{ fontSize: 12.5, color: sub ? T.green : d?.late ? T.stamp : T.inkSoft }}>
                                  {sub ? `Turned in${sub.mcCount ? ` · ${sub.correct}/${sub.mcCount} correct` : ""}` : `${h.items.length} questions${d ? ` · due ${d.text}` : ""}`}
                                </div>
                              </div>
                              {!sub && (
                                <button style={btn(T.green)} onClick={() => setHwDoing({ ...h, answers: [], grading: false, done: false })}>
                                  Start it
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {hwDoing && (
                        <div style={{ marginTop: 12, border: `2px solid ${T.blue}`, borderRadius: 12, background: "#F5F8FC", padding: "14px 16px" }}>
                          {!hwDoing.done ? (
                            <div>
                              <strong style={{ fontSize: 16 }}>{hwDoing.title}</strong>
                              <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "2px 0 8px" }}>
                                Take your time. Written answers have no wrong response.
                              </p>
                              {hwDoing.items.map((it, i) => (
                                <div key={i} style={{ margin: "12px 0" }}>
                                  <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>{i + 1}. {it.q}</div>
                                  {it.type === "mc" ? (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 6 }}>
                                      {it.options.map((o, oi) => (
                                        <button key={oi}
                                          onClick={() => { const a = [...hwDoing.answers]; a[i] = oi; setHwDoing({ ...hwDoing, answers: a }); }}
                                          style={{
                                            textAlign: "left", padding: "8px 10px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                                            border: `1.5px solid ${hwDoing.answers[i] === oi ? T.blue : T.rule}`,
                                            background: hwDoing.answers[i] === oi ? "#DDE8F6" : T.card,
                                            color: T.ink, fontFamily: "'Atkinson Hyperlegible', sans-serif",
                                          }}>
                                          {o}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <textarea
                                      style={{ width: "100%", boxSizing: "border-box", minHeight: 76, padding: "9px 12px", border: `1.5px solid ${T.rule}`, borderRadius: 8, background: T.card, color: T.ink, fontSize: 14, fontFamily: "'Atkinson Hyperlegible', sans-serif", outline: "none", resize: "vertical" }}
                                      placeholder="Write what you think — a couple of sentences is plenty."
                                      maxLength={600}
                                      value={hwDoing.answers[i] || ""}
                                      onChange={(e) => { const a = [...hwDoing.answers]; a[i] = e.target.value; setHwDoing({ ...hwDoing, answers: a }); }}
                                    />
                                  )}
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  style={{ ...btn(), opacity: hwDoing.grading || hwDoing.items.some((it, i) => it.type === "mc" && hwDoing.answers[i] === undefined) ? 0.5 : 1 }}
                                  disabled={hwDoing.grading || hwDoing.items.some((it, i) => it.type === "mc" && hwDoing.answers[i] === undefined)}
                                  onClick={submitHomework}>
                                  {hwDoing.grading ? "Checking…" : "Turn it in"}
                                </button>
                                <button style={ghostBtn} onClick={() => setHwDoing(null)}>Finish later</button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 34 }}>{!hwDoing.mcCount || hwDoing.correct >= hwDoing.mcCount - 1 ? "🎉" : "📖"}</div>
                                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 21 }}>
                                  {hwDoing.mcCount ? `${hwDoing.correct} / ${hwDoing.mcCount}` : "Turned in!"}
                                </div>
                                <div style={{ fontSize: 13.5, margin: "4px 0 8px" }}>+{hwDoing.earned} pts · your teacher can see it now</div>
                              </div>
                              {(hwDoing.feedback || []).map((f, k) => (
                                <div key={k} style={{ fontSize: 13.5, background: "#F0F5F0", borderLeft: `3px solid ${T.green}`, padding: "7px 11px", borderRadius: 4, marginBottom: 6 }}>
                                  💬 {f}
                                </div>
                              ))}
                              <div style={{ textAlign: "center" }}>
                                <button style={btn()} onClick={() => setHwDoing(null)}>Done</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {(classroom.assignments || []).length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.blue, fontWeight: 700 }}>📋 WHAT'S DUE</div>
                      {classroom.assignments.map((a) => {
                        const d = dueLabel(a.due);
                        const done = (classroom.chapter || 0) >= a.chapter;
                        return (
                          <div key={a.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap",
                            background: done ? "#F0F5F0" : T.paper, border: `1.5px solid ${done ? T.green : d.late ? T.stamp : T.rule}`,
                            borderRadius: 10, padding: "8px 13px", marginTop: 6,
                          }}>
                            <div>
                              <strong style={{ fontSize: 14.5 }}>{done ? "✓ " : ""}Chapter {a.chapter}</strong>
                              <span style={{ fontSize: 12.5, color: done ? T.green : d.late ? T.stamp : T.inkSoft, marginLeft: 8 }}>
                                {done ? "you're there!" : `due ${d.text}`}
                              </span>
                              {a.note && !done && <div style={{ fontSize: 12.5, color: T.inkSoft }}>{a.note}</div>}
                            </div>
                            {!done && (classroom.chapter || 0) < a.chapter && (
                              <span style={{ fontSize: 12, color: T.inkSoft }}>
                                {a.chapter - (classroom.chapter || 0)} chapter{a.chapter - (classroom.chapter || 0) !== 1 ? "s" : ""} to go
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {classroom.notice && (
                    <div style={{
                      margin: "10px 0 0", background: "#FDF6EE", border: `2px dashed ${T.stamp}`,
                      borderRadius: 10, padding: "10px 14px",
                    }}>
                      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.stamp, fontWeight: 700 }}>
                        📣 MESSAGE FROM {(classroom.teacher || "YOUR TEACHER").toUpperCase()}
                      </div>
                      <div style={{ fontSize: 14.5, marginTop: 2 }}>{classroom.notice}</div>
                    </div>
                  )}

                  {/* Chapter quizzes */}
                  {(classroom.chapter || 0) > 0 && (
                    <div style={{ marginTop: 10, paddingBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: "28px" }}>Chapter quizzes 🧠 <span style={{ fontWeight: 400, fontSize: 12, color: T.inkSoft }}>+5 pts per correct answer</span></div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        {Array.from({ length: classroom.chapter }, (_, i) => i + 1).map((n) => {
                          const q = (classroom.quizzes || {})[n];
                          return (
                            <button key={n} onClick={() => startChapterQuiz(n)}
                              style={{
                                padding: "5px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", fontWeight: 700,
                                border: `1.5px solid ${q ? (q.passed ? T.green : T.stamp) : T.blue}`,
                                background: q ? (q.passed ? "#E5F0E7" : "#F6E9E6") : "transparent",
                                color: q ? (q.passed ? T.green : T.stamp) : T.blue,
                                fontFamily: "'Atkinson Hyperlegible', sans-serif",
                              }}>
                              Ch {n}{q ? ` · ${q.score}/${q.total}` : " · take quiz"}
                            </button>
                          );
                        })}
                      </div>

                      {chapQuiz && (
                        <div style={{ marginTop: 12, border: `1.5px solid ${T.blue}`, borderRadius: 10, background: "#F5F8FC", padding: "14px 16px" }}>
                          {chapQuiz.loading && <p style={{ margin: 0, color: T.inkSoft }}>Writing 3 questions about chapter {chapQuiz.chapter}…</p>}
                          {!chapQuiz.loading && chapQuiz.questions && !chapQuiz.submitted && (
                            <div>
                              <strong>Chapter {chapQuiz.chapter} quiz</strong>
                              {chapQuiz.questions.map((q, qi) => (
                                <div key={qi} style={{ margin: "10px 0" }}>
                                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{qi + 1}. {q.q}</div>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6 }}>
                                    {q.options.map((opt, oi) => (
                                      <button key={oi}
                                        onClick={() => { const answers = [...chapQuiz.answers]; answers[qi] = oi; setChapQuiz({ ...chapQuiz, answers }); }}
                                        style={{
                                          textAlign: "left", padding: "8px 10px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                                          border: `1.5px solid ${chapQuiz.answers[qi] === oi ? T.blue : T.rule}`,
                                          background: chapQuiz.answers[qi] === oi ? "#DDE8F6" : T.card,
                                          color: T.ink, fontFamily: "'Atkinson Hyperlegible', sans-serif",
                                        }}>
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {chapQuiz.openQ && (
                                <div style={{ margin: "14px 0", padding: "12px 14px", background: "#FDF6EE", border: `2px dashed ${T.stamp}`, borderRadius: 10 }}>
                                  <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.stamp, fontWeight: 700 }}>💭 THINK ABOUT IT — no wrong answers</div>
                                  <div style={{ fontWeight: 700, fontSize: 14.5, margin: "4px 0 8px" }}>{chapQuiz.openQ}</div>
                                  <textarea
                                    style={{ width: "100%", boxSizing: "border-box", minHeight: 72, padding: "9px 12px", border: `1.5px solid ${T.rule}`, borderRadius: 8, background: T.card, color: T.ink, fontSize: 14, fontFamily: "'Atkinson Hyperlegible', sans-serif", outline: "none", resize: "vertical" }}
                                    placeholder="Write what you think — a sentence or two is plenty."
                                    maxLength={400}
                                    value={chapQuiz.openAns || ""}
                                    onChange={(e) => setChapQuiz({ ...chapQuiz, openAns: e.target.value })}
                                  />
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  style={{ ...btn(), opacity: chapQuiz.answers.filter((a) => a !== undefined).length === chapQuiz.questions.length ? 1 : 0.5 }}
                                  disabled={chapQuiz.answers.filter((a) => a !== undefined).length !== chapQuiz.questions.length}
                                  onClick={submitChapterQuiz}>
                                  Check my answers
                                </button>
                                <button style={ghostBtn} onClick={() => setChapQuiz(null)}>Cancel</button>
                              </div>
                            </div>
                          )}
                          {chapQuiz.submitted && (
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 34 }}>{chapQuiz.score >= chapQuiz.questions.length - 1 ? "🎉" : "📖"}</div>
                              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22 }}>{chapQuiz.score} / {chapQuiz.questions.length}</div>
                              <div style={{ fontSize: 13, margin: "4px 0 10px" }}>
                                {chapQuiz.earned ? `+${chapQuiz.earned} pts! ` : ""}{chapQuiz.score >= chapQuiz.questions.length - 1 ? "You really read that chapter." : "Flip back through the chapter and try again anytime."}
                              </div>
                              <button style={btn()} onClick={() => setChapQuiz(null)}>Done</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Ruled>

                {/* Class rewards from the teacher */}
                {(classroom.rewards || []).length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, margin: "0 0 8px" }}>
                      {classroom.kind === "family" ? "Family rewards" : "Class rewards"} from {classroom.teacher} 🎁
                    </h3>
                    {classroom.rewards.map((r) => {
                      const passedCount = Object.values(classroom.quizzes || {}).filter((q) => q.passed).length;
                      const progress = r.metric === "chapters" ? Math.min(classroom.chapter || 0, r.need) : Math.min(passedCount, r.need);
                      const unlocked = progress >= r.need;
                      return (
                        <div key={r.id} style={{
                          border: `1.5px solid ${unlocked ? T.green : T.rule}`, borderRadius: 10,
                          padding: "10px 14px", marginBottom: 8, background: unlocked ? "#F0F5F0" : T.paper,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <strong>{unlocked ? "🎉 " : "🎁 "}{r.prize}</strong>
                            <span style={{ fontSize: 12.5, color: unlocked ? T.green : T.inkSoft, fontWeight: unlocked ? 700 : 400 }}>
                              {progress} / {r.need} {r.metric === "chapters" ? "chapters" : "quizzes passed"}
                            </span>
                          </div>
                          <div style={{ height: 7, background: "#E4DECB", borderRadius: 99, marginTop: 6 }}>
                            <div style={{ height: 7, borderRadius: 99, width: `${Math.round((progress / r.need) * 100)}%`, background: unlocked ? T.green : T.blue, transition: "width .3s" }} />
                          </div>
                          {unlocked && r.code && (
                            <div style={{ marginTop: 6, fontSize: 13 }}>
                              {r.partner ? <>Show this at <strong>{r.partner}</strong>{r.partnerCity ? ` (${r.partnerCity})` : ""} — code: </> : <>Show your teacher — code: </>}
                              <strong style={{ color: T.green }}>{r.code}</strong>
                              <button style={{ ...ghostBtn, marginLeft: 8, padding: "2px 10px", fontSize: 11 }} onClick={() => copyCode(r.code)}>
                                {copied === r.code ? "Copied ✓" : "Copy"}
                              </button>
                            </div>
                          )}
                          {unlocked && !r.code && (
                            <div style={{ marginTop: 4, fontSize: 12.5, color: T.green }}>Unlocked — tell your teacher! 🎉</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <button style={{ ...ghostBtn, marginTop: 12, borderColor: T.stamp, color: T.stamp }}
                  onClick={() => persist({ classroom: null })}>
                  Leave this class
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- FOR YOU (recommendations) ---------------- */}
        {tab === "foryou" && (
          <div style={{ animation: "rise .3s ease" }}>
            {done.length === 0 ? (
              <Ruled>
                <p style={{ margin: 0, lineHeight: "28px" }}>
                  <strong>This page fills up when you finish a book.</strong> Mark any book finished
                  on your shelf and we'll line up what to read next — same author, same vibes,
                  same feeling you didn't want to end.
                </p>
              </Ruled>
            ) : (
              <div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22, margin: "0 0 4px" }}>
                  What to read next
                </h2>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: T.inkSoft }}>
                  Pick a book you finished — we'll find its literary cousins.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {done.map((b) => (
                    <button key={b.id}
                      onClick={() => fetchRecs(b)}
                      style={{
                        padding: "7px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontWeight: 700,
                        border: `1.5px solid ${recFor === b.id ? T.blue : T.rule}`,
                        background: recFor === b.id ? T.blue : "transparent",
                        color: recFor === b.id ? "#FFF" : T.ink,
                        fontFamily: "'Atkinson Hyperlegible', sans-serif",
                      }}>
                      {b.title}
                    </button>
                  ))}
                </div>

                {!recFor && <p style={{ color: T.inkSoft }}>Tap one of your finished books above ☝️</p>}
                {recLoading && <p style={{ color: T.inkSoft }}>Hunting down the perfect next reads…</p>}

                {recFor && !recLoading && (() => {
                  const src = done.find((b) => b.id === recFor);
                  const recs = recResults[recFor] || [];
                  return (
                    <div>
                      <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, margin: "0 0 10px" }}>
                        Because you finished “{src?.title}”
                      </h3>
                      {recs.length === 0 && (
                        <p style={{ color: T.inkSoft }}>
                          Hmm — couldn't find close matches for this one. Try the ✨ button below, or another finished book.
                        </p>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                        {recs.map((r) => {
                          const author = (r.author_name || [])[0] || "";
                          const pages = r.number_of_pages_median || "";
                          const owned = onShelfTitles.has((r.title || "").toLowerCase());
                          return (
                            <div key={r.key} style={{
                              border: `1px solid ${T.rule}`, borderRadius: 10, padding: 12,
                              background: T.paper, display: "flex", gap: 10,
                            }}>
                              <CoverThumb src={r.cover_i ? `https://covers.openlibrary.org/b/id/${r.cover_i}-M.jpg?default=false` : null} title={r.title} />
                              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{r.title}</div>
                                <div style={{ fontSize: 12, color: T.inkSoft }}>{author}{pages ? ` · ${pages} pages` : ""}</div>
                                <div style={{ fontSize: 12, color: T.green, fontWeight: 700 }}>✓ {r.why}</div>
                                <button
                                  style={{ ...(owned ? ghostBtn : btn(T.green)), marginTop: "auto", padding: "6px 12px", fontSize: 12, opacity: owned ? 0.6 : 1, cursor: owned ? "default" : "pointer" }}
                                  disabled={owned}
                                  onClick={() => addBook({ title: r.title, author, pages: pages || 200, status: "want" })}>
                                  {owned ? "On your shelf ✓" : "Add to shelf"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* AI layer */}
                      <div style={{ marginTop: 18 }}>
                        <button style={{ ...btn(), opacity: aiNextLoading ? 0.6 : 1 }} disabled={aiNextLoading}
                          onClick={() => askClaudeNext(src)}>
                          {aiNextLoading ? "Thinking…" : "✨ 3 handpicked follow-ups"}
                        </button>
                        {(aiNext[recFor] || []).length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
                            {aiNext[recFor].map((p) => (
                              <div key={p.title} style={{
                                border: `1.5px dashed ${T.blue}`, borderRadius: 10, padding: 14,
                                background: "#F5F8FC", display: "flex", flexDirection: "column", gap: 6,
                              }}>
                                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17, lineHeight: 1.2 }}>{p.title}</div>
                                <div style={{ fontSize: 13, color: T.inkSoft }}>{p.author}{p.pages ? ` · ~${p.pages} pages` : ""}</div>
                                <div style={{ fontSize: 14, flex: 1 }}>{p.why}</div>
                                <button style={{ ...btn(T.green), marginTop: 4 }}
                                  onClick={() => addBook({ title: p.title, author: p.author, pages: p.pages, status: "want" })}>
                                  Add to shelf
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ---------------- READ (digital shelf) ---------------- */}
        {tab === "read" && (
          <div style={{ animation: "rise .3s ease" }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22, margin: "0 0 4px" }}>
              My digital shelf
            </h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: T.inkSoft }}>
              70,000+ classic books, free and legal to read right here — Sherlock, Austen, Dracula, Don Quijote y más.
              Reading in here counts toward your streak. 🔥
            </p>

            {/* My saved digital books */}
            {digitalShelf.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {digitalShelf.map((b) => (
                  <div key={b.gid} style={{
                    border: `1px solid ${T.rule}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8,
                    background: T.paper, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>{b.title}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>{b.author}{b.pos > 0 ? ` · you're on page ${b.pos + 1}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={btn()} onClick={() => openReader(b)}>{b.pos > 0 ? "Keep reading" : "Start reading"}</button>
                      <button aria-label="Remove" style={{ background: "none", border: "none", color: T.inkSoft, cursor: "pointer", fontSize: 16 }}
                        onClick={() => removeDigital(b.gid)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search the free library */}
            <Ruled style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, lineHeight: "28px" }}>Search the free library</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
                <input
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1.5px solid ${T.rule}`, borderRadius: 8, background: T.card, color: T.ink, fontSize: 15, fontFamily: "'Atkinson Hyperlegible', sans-serif", outline: "none", flex: "1 1 220px" }}
                  placeholder="Try 'Sherlock', 'Austen', 'Quijote'…"
                  value={gutenQuery}
                  onChange={(e) => setGutenQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchGutenberg()}
                />
                <button style={{ ...btn(), opacity: gutenQuery.trim() && !gutenLoading ? 1 : 0.5 }} disabled={!gutenQuery.trim() || gutenLoading} onClick={searchGutenberg}>
                  {gutenLoading ? "Searching…" : "Search"}
                </button>
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, margin: "6px 0 6px" }}>Or browse the free shelves by genre:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 6 }}>
                {FREE_GENRES.map((g) => (
                  <button key={g[0]} onClick={() => browseFreeGenre(g)} style={{
                    padding: "6px 13px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", fontWeight: 700,
                    border: `1.5px solid ${freeGenre === g[0] ? T.green : T.rule}`,
                    background: freeGenre === g[0] ? T.green : T.card,
                    color: freeGenre === g[0] ? "#FFF" : T.ink,
                    fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    {g[0]}
                  </button>
                ))}
              </div>
            </Ruled>

            {gutenLoading && !gutenResults && <p style={{ color: T.inkSoft, marginBottom: 16 }}>Finding free books… 📚</p>}
            {gutenResults && (<>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, margin: "0 0 10px" }}>
                {gutenLoading ? "Finding free books… 📚" : freeGenre ? `${freeGenre} — ${gutenResults.length} free books` : `${gutenResults.length} free books found`}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 8 }}>
                {gutenResults.length === 0 && !gutenLoading && <p style={{ color: T.inkSoft }}>Nothing found — try an author's last name, or tap a genre above.</p>}
                {gutenResults.map((b) => (
                  <div key={b.gid} style={{ border: `1px solid ${T.rule}`, borderRadius: 10, padding: 12, background: T.paper, display: "flex", gap: 10 }}>
                    <CoverThumb src={b.cover || gutenCover(b.gid)} title={b.title} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{b.title}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>{b.author}</div>
                      <button style={{ ...btn(T.green), marginTop: "auto", padding: "6px 12px", fontSize: 12 }}
                        onClick={() => addDigital(b)}>
                        Add to digital shelf
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {freeGenre && gutenResults.length > 0 && (
                <div style={{ textAlign: "center", margin: "8px 0 20px" }}>
                  <button style={{ ...btn(T.green), opacity: freeMoreBusy ? 0.6 : 1 }} disabled={freeMoreBusy} onClick={loadMoreFree}>
                    {freeMoreBusy ? "Finding more…" : "Load more free books ↓"}
                  </button>
                </div>
              )}
              {!freeGenre && <div style={{ marginBottom: 12 }} />}
            </>)}

            {/* Featured classics */}
            <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, margin: "0 0 10px" }}>
              Great first classics
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {FEATURED_CLASSICS.map((b) => {
                const owned = digitalShelf.some((x) => x.gid === b.gid);
                return (
                  <div key={b.gid} style={{
                    border: `1px solid ${T.rule}`, borderRadius: 10, padding: 14, background: T.paper,
                    display: "flex", flexDirection: "column", gap: 5, borderTop: `6px solid ${spineColor(b.title)}`,
                  }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, lineHeight: 1.2 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>{b.author}</div>
                    <div style={{ fontSize: 13.5, flex: 1 }}>{b.note}</div>
                    <button style={{ ...(owned ? ghostBtn : btn(T.green)), marginTop: 4, opacity: owned ? 0.6 : 1 }}
                      disabled={owned}
                      onClick={() => addDigital(b)}>
                      {owned ? "On your digital shelf ✓" : "Add & read free"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- MORE ---------------- */}
        {tab === "more" && (
          <div style={{ animation: "rise .3s ease" }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22, margin: "0 0 14px" }}>
              More of Shelf Life
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {[
                ["personality", "🎭", "Personality", "Discover your reading type and get matched books"],
                ["privacy", "🔒", "Privacy & schools", "What we collect, what we never do — for teachers, families & districts"],
                ["news", "📰", "The Reading Room", "This month in the reading world — anniversaries, celebrations & a challenge"],
                ["foryou", "📖", "For you", "What to read next, based on books you finished"],
                ...(SCHOOL_MODE ? [] : [["club", "💬", "Book club", "The community wall and real-world meetups"]]),
                ["rewards", "🎁", "Rewards", "Your points, levels, streak gifts and the vault"],
              ].map(([id, emoji, label, desc]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  background: T.paper, border: `1.5px solid ${T.rule}`, borderRadius: 12,
                  padding: "16px 16px", cursor: "pointer", textAlign: "left",
                  fontFamily: "'Atkinson Hyperlegible', sans-serif",
                }}>
                  <div style={{ fontSize: 26 }}>{emoji}</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 17, color: T.ink }}>{label}</div>
                  <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>

            {/* Device sync */}
            <div style={{ marginTop: 22 }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, margin: "0 0 4px" }}>
                📲 Move my shelf to another device
              </h3>
              <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 10px" }}>
                Reading on your phone AND a Chromebook? Make a code here, type it there — your whole shelf follows you.
              </p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Ruled style={{ flex: "1 1 240px" }}>
                  <div style={{ fontWeight: 700, lineHeight: "28px" }}>Send from this device</div>
                  {syncCode ? (
                    <div style={{ paddingBottom: 4 }}>
                      <div style={{
                        fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26, letterSpacing: "0.18em",
                        border: `2.5px dashed ${T.stamp}`, borderRadius: 10, padding: "4px 14px",
                        color: T.stamp, display: "inline-block", margin: "4px 0",
                      }}>
                        {syncCode}
                      </div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>Type this code on your other device within the next day.</div>
                    </div>
                  ) : (
                    <button style={{ ...btn(), opacity: syncBusy ? 0.6 : 1 }} disabled={syncBusy} onClick={createSyncCode}>
                      {syncBusy ? "Creating…" : "Get my sync code"}
                    </button>
                  )}
                </Ruled>
                <Ruled style={{ flex: "1 1 240px" }}>
                  <div style={{ fontWeight: 700, lineHeight: "28px" }}>Receive on this device</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
                    <input
                      style={{ ...input, flex: "1 1 120px", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700 }}
                      placeholder="SYNC CODE" maxLength={6} value={syncInput}
                      onChange={(e) => setSyncInput(e.target.value.toUpperCase())} />
                    <button style={{ ...btn(T.green), opacity: syncInput.trim().length >= 5 && !syncBusy ? 1 : 0.5 }}
                      disabled={syncInput.trim().length < 5 || syncBusy} onClick={receiveSyncCode}>
                      {syncBusy ? "Syncing…" : "Bring my shelf here"}
                    </button>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: "28px" }}>
                    Heads up: this replaces what's on this device with the synced shelf.
                  </div>
                </Ruled>
              </div>
            </div>

            {/* Rate Shelf Life */}
            <div style={{ marginTop: 22, background: T.card, border: `1.5px solid ${T.rule}`, borderRadius: 12, padding: "16px 18px", textAlign: "center" }}>
              {!appRated ? (
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 18 }}>Enjoying Shelf Life? ⭐</div>
                  <p style={{ fontSize: 13, color: T.inkSoft, margin: "4px 0 10px" }}>Your rating goes straight to the person building this app.</p>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Stars value={appRating} onChange={setAppRating} size={30} />
                  </div>
                  <input
                    style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: `1.5px solid ${T.rule}`, borderRadius: 8, background: T.paper, color: T.ink, fontSize: 14, fontFamily: "'Atkinson Hyperlegible', sans-serif", outline: "none", marginTop: 10 }}
                    placeholder="One thing you'd change or love? (optional)"
                    maxLength={300}
                    value={appFeedback}
                    onChange={(e) => setAppFeedback(e.target.value)}
                  />
                  <button style={{ ...btn(), marginTop: 10, opacity: appRating ? 1 : 0.5 }} disabled={!appRating} onClick={submitAppRating}>
                    Send my rating
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 32 }}>💛</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 18 }}>Thank you!</div>
                  <p style={{ fontSize: 13, color: T.inkSoft, margin: "4px 0 0" }}>Every rating helps this little app grow.</p>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, fontSize: 11.5, color: T.inkSoft, textAlign: "center" }}>
              Shelf Life · your shelf, not a race · made in Houston 🤠
              <div style={{ marginTop: 4 }}>
                <button style={{ background: "none", border: "none", color: T.inkSoft, cursor: "pointer", fontSize: 11, textDecoration: "underline", fontFamily: "'Atkinson Hyperlegible', sans-serif" }}
                  onClick={runSoundCheck}>
                  sound trouble? run a quick check
                </button>
              </div>
              {soundCheck && soundCheck.lines.length > 0 && (
                <div style={{ marginTop: 8, background: T.paper, border: `1px solid ${T.rule}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, fontFamily: "monospace", textAlign: "left" }}>
                  {soundCheck.lines.map((l, i) => <div key={i} style={{ marginBottom: 3 }}>{l}</div>)}
                </div>
              )}
            </div>
          </div>

        )}

        {/* ---------------- PRIVACY & SCHOOLS ---------------- */}
        {tab === "privacy" && (
          <div style={{ animation: "rise .3s ease" }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22, margin: "0 0 2px" }}>
              🔒 Privacy & schools
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: T.inkSoft }}>
              Written for teachers, families, and district technology offices.
            </p>

            {[
              ["What we collect from a reader", "A first name (or nickname) if they join a class, the books on their shelf, chapters and quizzes completed, words they tapped, and reading activity in the app. That's the whole list."],
              ["What we never collect", "No last names. No email addresses or phone numbers from students. No home address. No date of birth. No photos, no camera access. No location tracking. Voice practice is processed by the browser on the device and is never recorded, stored, or uploaded."],
              ["Advertising & selling data", "There is no advertising in Shelf Life, and reader data is never sold, rented, or shared with advertisers or data brokers. Ever."],
              ["Who can see a student's data", "Their teacher (chapters, quiz scores, and reading activity for the class book) and nobody else. Students are always listed alphabetically and never ranked against each other. No student can see another student's scores."],
              ["Where the data lives", "Personal reading data stays on the reader's own device. Classroom data (a class code, first names, chapter numbers, quiz scores) is stored in the app's database so the teacher's dashboard works across devices."],
              ["Deleting data", "A student can leave a class at any time from the Classroom tab, and a teacher can close a class, which removes it. Anything on the device is cleared by clearing the browser's data for this site. Requests for deletion can be sent to the operator of this app."],
              ["Family access", "A family follows their reader with a short code the teacher shares — we never ask a parent for an email address, phone number, or name. Families see only their own child: chapter progress, chapter checks, minutes read, and messages from the teacher. Teacher messages to a family are stored so the family can read them in the app; there is no messaging between families or between students."],
              ["Under-13 readers (COPPA)", "Shelf Life is designed to be usable without any personally identifying information from a child. When a school adopts it for classroom use, the school provides consent on the family's behalf for educational use, as COPPA permits. Families may ask their teacher to remove a child from a class at any time."],
              ["Student records (FERPA)", "Any classroom data created in Shelf Life is held on behalf of the school as a school official with a legitimate educational interest, is used only to provide the service to that classroom, and is never used for any other purpose."],
              ["AI features", "Quizzes, summaries, word definitions, and recaps are generated by an AI model. Only the book title, chapter number, and the tapped word are sent — never a student's name, scores, or personal information. Student work is not used to train AI models."],
              ["Accessibility", "Every page uses a high-legibility typeface, adjustable text size in the reader, tap-to-hear pronunciation for any word, full-page read-aloud, and Spanish throughout. Feedback on accessibility gaps is genuinely welcome."],
            ].map(([h, body]) => (
              <div key={h} style={{ background: T.paper, border: `1px solid ${T.rule}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 16 }}>{h}</div>
                <div style={{ fontSize: 13.5, color: T.ink, marginTop: 3 }}>{body}</div>
              </div>
            ))}

            <div style={{ background: "#F5F8FC", border: `2px solid ${T.blue}`, borderRadius: 12, padding: "14px 16px", marginTop: 12 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 17 }}>For district technology offices</div>
              <p style={{ fontSize: 13.5, margin: "4px 0 0" }}>
                Shelf Life is an independent product built in Houston and is happy to sign a district Data Privacy Agreement,
                complete a vendor questionnaire, or run a limited pilot under your terms. A school-mode build is available that
                removes the community wall and public meetups entirely. Ask the person who shared this app with you for a copy
                of the agreement.
              </p>
            </div>

            <p style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 14, textAlign: "center" }}>
              Last updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} · questions are welcome
            </p>
          </div>
        )}

        {/* ---------------- THE READING ROOM (news) ---------------- */}
        {tab === "news" && (
          <div style={{ animation: "rise .3s ease" }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22, margin: "0 0 2px" }}>
              📰 The Reading Room
            </h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: T.inkSoft }}>
              {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })} in the reading world
            </p>

            {newsLoading && <p style={{ color: T.inkSoft }}>Setting up this month's Reading Room… 📚</p>}

            {!newsLoading && !newsDigest?.data && (
              <div style={{ textAlign: "center", padding: "30px 10px" }}>
                <div style={{ fontSize: 40 }}>📰</div>
                <p style={{ color: T.inkSoft, fontSize: 14, margin: "8px 0 14px" }}>
                  This month's edition is ready to be opened.
                </p>
                <button style={btn()} onClick={() => loadReadingRoom(true)}>Open this month's Reading Room 📰</button>
              </div>
            )}

            {newsDigest?.data && (
              <div>
                {/* Challenge */}
                {newsDigest.data.challenge && (
                  <div style={{
                    marginTop: 12, border: `2px dashed ${T.stamp}`, borderRadius: 12, padding: "13px 16px",
                    background: "#FDF6EE",
                  }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.stamp, fontWeight: 700 }}>✨ THIS MONTH'S CHALLENGE</div>
                    <div style={{ fontSize: 14.5, marginTop: 3 }}>{newsDigest.data.challenge}</div>
                  </div>
                )}

                {/* Anniversaries */}
                {(newsDigest.data.anniversaries || []).map((a, i) => (
                  <button key={i} onClick={() => readMoreNews(i, a)} style={{
                    background: T.paper, border: `1px solid ${newsMore[i]?.open ? T.blue : T.rule}`, borderRadius: 10,
                    padding: "11px 15px", marginBottom: 8, display: "block", width: "100%", textAlign: "left",
                    cursor: "pointer", fontFamily: "'Atkinson Hyperlegible', sans-serif", color: T.ink,
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 24, lineHeight: 1 }}>{a.emoji || "📚"}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{a.title}</div>
                        <div style={{ fontSize: 13, color: T.inkSoft }}>{a.blurb}</div>
                        <div style={{ fontSize: 11.5, color: T.blue, fontWeight: 700, marginTop: 4 }}>
                          {newsMore[i]?.open ? "Show less ▲" : "Read the full story ▼"}
                        </div>
                        {newsMore[i]?.open && (
                          <div style={{ fontSize: 13.5, marginTop: 8, borderTop: `1px solid ${T.rule}`, paddingTop: 8 }}>
                            {newsMore[i].loading ? "Turning the pages of history…" : newsMore[i].text}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {/* Classic of the month */}
                {newsDigest.data.classic && (
                  <div style={{
                    marginTop: 14, background: "#22334D", color: "#F4EEDD", borderRadius: 12,
                    padding: "16px 18px",
                  }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.14em", fontWeight: 700, opacity: 0.8 }}>CLASSIC OF THE MONTH</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 21, margin: "2px 0" }}>
                      {newsDigest.data.classic.title}
                    </div>
                    <div style={{ fontSize: 12.5, opacity: 0.85 }}>{newsDigest.data.classic.author}</div>
                    <div style={{ fontSize: 14, margin: "8px 0 10px" }}>{newsDigest.data.classic.why}</div>
                    <button style={{ ...btn(T.stamp), fontSize: 13 }}
                      onClick={() => { setTab("read"); setGutenQuery(newsDigest.data.classic.title); searchGutenberg(newsDigest.data.classic.title); }}>
                      Read it free in the app 📱
                    </button>
                  </div>
                )}

                <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 14, textAlign: "center" }}>
                  A new Reading Room arrives every month 🗓️
                </p>
              </div>
            )}
          </div>
        )}

        {/* ---------------- REWARDS ---------------- */}
        {tab === "rewards" && (
          <div style={{ animation: "rise .3s ease" }}>
            {/* Streak hero */}
            <div style={{
              display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch", marginBottom: 18,
            }}>
              <div style={{
                flex: "1 1 220px", background: T.paper, border: `1px solid ${T.rule}`,
                borderRadius: 12, padding: "16px 18px", textAlign: "center",
              }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 52, lineHeight: 1 }}>
                  {streak} <span style={{ fontSize: 34 }}>🔥</span>
                </div>
                <div style={{ fontSize: 13, color: T.inkSoft, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>
                  day streak {best > streak ? `· best: ${best}` : ""}
                </div>
                {streak === 0 && readDays.length > 0 && (
                  <div style={{ fontSize: 12, color: T.green, marginTop: 4 }}>
                    Streaks rest too. Today is a fresh page 🌱
                  </div>
                )}
                <button style={{ ...(readToday ? ghostBtn : btn(T.stamp)), marginTop: 12 }} onClick={markToday}>
                  {readToday ? "Read today ✓" : "I read today — any amount counts 🌱"}
                </button>
                <p style={{ fontSize: 12, color: T.inkSoft, margin: "10px 0 0" }}>
                  Updating page progress on your shelf counts too.
                </p>
              </div>

              {/* Level card */}
              <div style={{
                flex: "1 1 220px", background: T.paper, border: `1px solid ${T.rule}`,
                borderRadius: 12, padding: "16px 18px", textAlign: "center",
              }}>
                <div style={{ fontSize: 34 }}>{level.emoji}</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22 }}>{level.name}</div>
                <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>{points} points</div>
                {nextLevel ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 8, background: "#E4DECB", borderRadius: 99 }}>
                      <div style={{
                        height: 8, borderRadius: 99, background: T.blue, transition: "width .3s",
                        width: `${Math.min(100, ((points - level.need) / (nextLevel.need - level.need)) * 100)}%`,
                      }} />
                    </div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                      {nextLevel.need - points} pts to {nextLevel.name} {nextLevel.emoji}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: T.green, fontWeight: 700, marginTop: 8 }}>Top level reached! 🏛️</div>
                )}
                <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 10, textAlign: "left" }}>
                  Earn points: +5 read a day · +25 finish a book · up to +50 ace its quiz · +5 club post
                </div>
              </div>

              {/* Weekly goal */}
              <div style={{
                flex: "1 1 260px", background: T.paper, border: `1px solid ${T.rule}`,
                borderRadius: 12, padding: "16px 18px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18 }}>Weekly goal</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button aria-label="Lower goal" style={{ ...ghostBtn, padding: "4px 12px" }}
                      onClick={() => persist({ goalDays: Math.max(1, goalDays - 1) })}>−</button>
                    <strong style={{ fontSize: 16 }}>{goalDays} days</strong>
                    <button aria-label="Raise goal" style={{ ...ghostBtn, padding: "4px 12px" }}
                      onClick={() => persist({ goalDays: Math.min(7, goalDays + 1) })}>+</button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, margin: "14px 0 8px" }}>
                  {weekKeys().map((k, i) => {
                    const hit = readDays.includes(k);
                    const isToday = k === todayKey();
                    return (
                      <div key={k} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{
                          height: 30, borderRadius: 8,
                          background: hit ? T.green : "transparent",
                          border: `2px ${isToday ? "solid" : "dashed"} ${hit ? T.green : T.rule}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#FFF", fontWeight: 700, fontSize: 14,
                        }}>
                          {hit ? "✓" : ""}
                        </div>
                        <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 3 }}>{"MTWTFSS"[i]}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 14 }}>
                  {weekCount >= goalDays ? (
                    <span style={{ color: T.green, fontWeight: 700 }}>Goal hit this week — gift unlocked below! 🎉</span>
                  ) : (
                    <span style={{ color: T.inkSoft }}>{weekCount} of {goalDays} reading days so far — no pressure, the week isn't over.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Weekly gift */}
            {weekCount >= goalDays && (
              <div style={{
                border: `2px solid ${T.green}`, background: "#EFF6F0", borderRadius: 12,
                padding: "14px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between",
                alignItems: "center", flexWrap: "wrap", gap: 10,
              }}>
                <div>
                  <div style={{ fontWeight: 700 }}>🎉 Weekly goal gift: 10% off your next book</div>
                  <div style={{ fontSize: 13, color: T.inkSoft }}>Resets every Monday — hit your goal again next week to re-earn it.</div>
                </div>
                <button style={btn(T.green)} onClick={() => copyCode("WEEKLYWIN10")}>
                  {copied === "WEEKLYWIN10" ? "Copied ✓" : "WEEKLYWIN10 — copy"}
                </button>
              </div>
            )}

            {/* Gift vault */}
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "0 0 4px" }}>
              Gift vault <span style={{ fontSize: 14, color: T.inkSoft, fontWeight: 400 }}>({unlockedCount} of {REWARDS.length} unlocked)</span>
            </h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: T.inkSoft }}>
              These open at your own pace — they'll wait for you as long as it takes.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
              {REWARDS.map((r) => {
                const open = isUnlocked(r);
                const progress = r.type === "streak" ? Math.min(best, r.need) : r.type === "books" ? Math.min(done.length, r.need) : Math.min(passedQuizzes, r.need);
                return (
                  <div key={r.id} style={{
                    border: `1.5px ${open ? "solid" : "dashed"} ${open ? T.green : T.rule}`,
                    borderRadius: 12, padding: 14, background: open ? "#F2F7F2" : T.paper,
                    opacity: open ? 1 : 0.75,
                  }}>
                    <div style={{ fontSize: 26 }}>{open ? r.emoji : "🔒"}</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, margin: "4px 0 2px" }}>{r.title}</div>
                    <div style={{ fontSize: 14, minHeight: 38 }}>{r.gift}</div>
                    {open ? (
                      r.code ? (
                        <button style={{ ...btn(T.green), marginTop: 8, width: "100%" }} onClick={() => copyCode(r.code)}>
                          {copied === r.code ? "Copied ✓" : `${r.code} — copy`}
                        </button>
                      ) : (
                        <div style={{
                          marginTop: 8, textAlign: "center", border: `2px solid ${T.stamp}`, color: T.stamp,
                          borderRadius: 6, padding: "6px 0", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em",
                          transform: "rotate(-1.5deg)",
                        }}>
                          EARNED {r.emoji}
                        </div>
                      )
                    ) : (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ height: 8, background: "#E4DECB", borderRadius: 99 }}>
                          <div style={{
                            height: 8, width: `${(progress / r.need) * 100}%`, background: T.blue,
                            borderRadius: 99, transition: "width .3s",
                          }} />
                        </div>
                        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                          {progress} / {r.need} {r.type === "streak" ? "days" : r.type === "books" ? "books" : "quizzes"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 16 }}>
              Note: these discount codes are placeholders for now. To make them real, partner with a local
              bookstore, Bookshop.org, or a publisher and swap in codes they issue for your readers.
            </p>
          </div>
        )}
      </main>

      {/* ---------------- FIRST-RUN WELCOME ---------------- */}
      {loaded && !onboarded && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 90, background: T.paper,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 18, overflowY: "auto",
        }}>
          <div style={{ maxWidth: 470, width: "100%", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <Mark size={92} />
            </div>

            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 34, margin: 0 }}>Shelf Life</h1>
            <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 17, color: T.blue, margin: "6px 0 2px" }}>
              Your shelf, not a race.
            </p>
            <p style={{ fontSize: 14.5, color: T.inkSoft, margin: "0 0 20px" }}>
              Five pages today is a win. Who's reading?
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, textAlign: "center" }}>
              {[
                ["myself", "📚", "Myself", "Track my books at my own pace"],
                ["student", "🎒", "I'm a student", "Join my class with a code"],
                ["teacher", "🍎", "I'm a teacher", "Set up my class"],
                ["family", "👨‍👩‍👧", "We're a family", "Read together at home"],
              ].map(([role, emoji, label, desc]) => (
                <button key={role} onClick={() => finishOnboarding(role)} style={{
                  background: T.card, border: `2px solid ${T.rule}`, borderRadius: 14,
                  padding: "18px 14px", cursor: "pointer", fontFamily: "'Atkinson Hyperlegible', sans-serif",
                }}>
                  <div style={{ fontSize: 30 }}>{emoji}</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 17, color: T.ink }}>{label}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 16 }}>
              You can change this anytime — everything's open to everyone.
            </p>
          </div>
        </div>
      )}

      {/* ---------------- HOW TO GET THIS BOOK ---------------- */}
      {getBook && (
        <div style={{ position: "fixed", inset: 0, zIndex: 86, background: "rgba(34,51,77,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
          onClick={() => setGetBook(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: 460, width: "100%", background: T.card, borderRadius: 16,
            border: `2px solid ${T.rule}`, padding: "20px 22px", boxShadow: T.lift3,
            maxHeight: "88vh", overflowY: "auto",
          }}>
            <div style={{ fontSize: 11, letterSpacing: "0.13em", color: T.blue, fontWeight: 700 }}>HOW TO GET THIS BOOK</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 21, margin: "3px 0 2px" }}>{getBook.title}</div>
            {getBook.author && <div style={{ fontSize: 13, color: T.inkSoft }}>{getBook.author}</div>}
            <p style={{ fontSize: 13.5, color: T.inkSoft, margin: "10px 0 14px" }}>
              This one isn't in our free library — it's still under copyright, so we can't include it.
              Here's how readers usually get it, cheapest first.
            </p>

            {[
              ["🏛️", "Borrow it free from your library", "Most libraries lend ebooks and audiobooks instantly with a library card. Search Libby.",
                `https://libbyapp.com/search/query-${encodeURIComponent(getBook.title)}/page-1`, T.green],
              ["🔎", "Find a copy on a nearby shelf", "WorldCat shows which libraries near you have the physical book.",
                `https://search.worldcat.org/search?q=${encodeURIComponent(getBook.title + " " + (getBook.author || ""))}`, T.blue],
              ["📚", "Buy it and support a local bookstore", "Bookshop.org sends its profits to independent bookshops instead of a warehouse.",
                `https://bookshop.org/beta-search?keywords=${encodeURIComponent(getBook.title + " " + (getBook.author || ""))}`, T.stamp],
            ].map(([emoji, title, desc, href, color]) => (
              <a key={title} href={href} target="_blank" rel="noopener noreferrer" style={{
                display: "flex", gap: 11, alignItems: "flex-start", textDecoration: "none",
                border: `1.5px solid ${T.rule}`, borderRadius: 11, padding: "11px 13px", marginBottom: 8,
                background: T.paper, color: T.ink,
              }}>
                <span style={{ fontSize: 21, lineHeight: 1 }}>{emoji}</span>
                <span>
                  <span style={{ display: "block", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 15, color }}>{title}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, marginTop: 1 }}>{desc}</span>
                </span>
              </a>
            ))}

            <div style={{ background: "#F5F8FC", border: `1px solid ${T.rule}`, borderRadius: 10, padding: "10px 13px", fontSize: 13 }}>
              <strong>Or just ask.</strong> Your teacher or school librarian can often put a copy in your hands
              tomorrow — and it costs nothing to ask.
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button style={btn(T.green)} onClick={() => { addBook({ title: getBook.title, author: getBook.author, pages: getBook.pages || 200, status: "want" }); setGetBook(null); }}>
                Add to my want-to-read
              </button>
              <button style={ghostBtn} onClick={() => { setGetBook(null); setTab("read"); }}>Find something free instead</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- DAILY SPOTLIGHT ---------------- */}
      {spotlight && (
        <div style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(34,51,77,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
          onClick={() => setSpotlight(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: 400, width: "100%", background: T.paper, borderRadius: 16,
            border: `2px solid ${T.rule}`, padding: "22px 22px 18px", textAlign: "center",
            boxShadow: "0 18px 50px rgba(34,51,77,0.35)", animation: "rise .3s ease",
          }}>
            {spotlight.kind === "news" && (
              <>
                <div style={{ fontSize: 40 }}>{spotlight.emoji}</div>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.stamp, fontWeight: 700, marginTop: 4 }}>TODAY IN THE READING WORLD</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "4px 0" }}>{(spotlight.title || "").replace(/[*`]/g, "")}</div>
                <div style={{ fontSize: 14, color: T.inkSoft }}>{(spotlight.blurb || "").replace(/[*`]/g, "")}</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
                  <button style={btn()} onClick={() => { setSpotlight(null); setTab("news"); }}>To the Reading Room 📰</button>
                  <button style={ghostBtn} onClick={() => setSpotlight(null)}>Later</button>
                </div>
              </>
            )}
            {spotlight.kind === "stats" && (
              <>
                <div style={{ fontSize: 40 }}>🌟</div>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.blue, fontWeight: 700, marginTop: 4 }}>YOUR READING LIFE SO FAR</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "6px 0" }}>
                  {points} points · {books.filter((b) => b.status === "done").length} books finished · {myWords.length} words collected
                </div>
                <div style={{ fontSize: 14, color: T.inkSoft }}>Every page you turn adds to this. Keep going — slow counts. 🌱</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
                  <button style={btn()} onClick={() => { setSpotlight(null); setTab("rewards"); }}>See my rewards 🎁</button>
                  <button style={ghostBtn} onClick={() => setSpotlight(null)}>Later</button>
                </div>
              </>
            )}
            {spotlight.kind === "welcome" && (
              <>
                <div style={{ fontSize: 40 }}>📚</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "6px 0" }}>Welcome to your shelf</div>
                <div style={{ fontSize: 14, color: T.inkSoft }}>Take the 2-minute personality quiz and we'll find books that feel like they were picked just for you.</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
                  <button style={btn()} onClick={() => { setSpotlight(null); setTab("personality"); }}>Find my reading type ✨</button>
                  <button style={ghostBtn} onClick={() => setSpotlight(null)}>Later</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------------- READER OVERLAY ---------------- */}
      {reader && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 80, background: T.paper,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "10px 14px 8px", borderBottom: `1.5px solid ${T.rule}`, background: T.card,
          }}>
            {/* Row 1: title + Close — Close is ALWAYS visible, even in portrait */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {reader.title}
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft }}>{reader.author}</div>
              </div>
              <button style={{ ...btn(T.stamp), padding: "5px 12px", flexShrink: 0 }} onClick={() => { stopAllSpeech(); stopListening(); const m = bankMinutes(); window.__slReadStart = null; if (m) persist({ readLog: logActivity({ min: m }) }); stopAllSpeech(); setWordCard(null); setPractice(null); setReader(null); }}>Close ✕</button>
            </div>
            {/* Row 2: tools — one swipeable row on phones instead of a tall stack */}
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "nowrap", overflowX: "auto", WebkitOverflowScrolling: "touch", marginTop: 8, paddingBottom: 2 }}>
              <button
                title={premiumVoice
                  ? (voicePref === "male" ? "Narrator: Marco — tap for Ana" : "Narrator: Ana — tap for Marco")
                  : "Voice: tap to change (device / female / male)"}
                style={{ ...ghostBtn, padding: "4px 11px", fontSize: premiumVoice ? 12.5 : 15, whiteSpace: "nowrap", flexShrink: 0 }}
                onClick={() => {
                  stopAllSpeech();
                  if (premiumVoice) {
                    const next = voicePref === "male" ? "female" : "male";
                    persist({ voicePref2: next });
                    flash(next === "male" ? "Narrator: Marco 👨" : "Narrator: Ana 👩");
                  } else {
                    const next = voicePref === "system" ? "female" : voicePref === "female" ? "male" : "system";
                    persist({ voicePref2: next });
                    flash(next === "system" ? "Voice: device default 🔈 (most reliable)" : next === "female" ? "Voice: female 👩" : "Voice: male 👨");
                  }
                }}>
                {premiumVoice
                  ? (voicePref === "male" ? "👨 Marco" : "👩 Ana")
                  : (voicePref === "system" ? "🔈" : voicePref === "female" ? "👩" : "👨")}
              </button>
              <button style={{ ...(readAlong.on ? btn(T.stamp) : btn(T.green)), padding: "4px 11px", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}
                onClick={() => {
                  if (readAlong.on || audioBusy) { stopAllSpeech(); return; }
                  readOnFrom(0);
                }}>
                {audioBusy ? "…" : readAlong.on ? "⏹ Stop" : "🔊 Read to me"}
              </button>
              <button title={tapMode === "define" ? "Tapping a word shows its meaning — tap here to switch" : "Tapping a word reads from there — tap here to switch"}
                style={{ ...(tapMode === "read" ? btn(T.blue) : ghostBtn), padding: "4px 11px", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }}
                onClick={() => { stopReadAlong(); setTapMode(tapMode === "define" ? "read" : "define"); flash(tapMode === "define" ? "Tap any sentence to read from there ▶" : "Tap any word for its meaning 💬"); }}>
                {tapMode === "define" ? "💬 Tap = meaning" : "▶ Tap = read"}
              </button>
              {studioAvailable && <button
                title={premiumVoice ? "Studio voice on — tap for the device voice" : "Studio voice off — tap for the natural narrator"}
                style={{ ...(premiumVoice ? btn(T.gold) : ghostBtn), padding: "4px 10px", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }}
                onClick={() => {
                  stopAllSpeech();
                  const on = !premiumVoice;
                  setPremiumVoice(on);
                  if (on && voicePref === "system") persist({ voicePref2: "female" });
                  flash(on ? "Studio voice ✨ — tap the narrator to switch Ana / Marco" : "Device voice");
                }}>
                {premiumVoice ? "✨ Studio" : "Studio?"}
              </button>}              <button title="Practice reading out loud" style={{ ...ghostBtn, padding: "4px 9px", fontSize: 13, flexShrink: 0 }} onClick={startPractice}>🎙</button>
              <button
                title={readerFace === "hyper" ? "Font: Hyperlegible — tap for Lexend" : readerFace === "lexend" ? "Font: Lexend (wider spacing) — tap for storybook" : "Font: storybook serif — tap for Hyperlegible"}
                style={{ ...ghostBtn, padding: "4px 10px", fontSize: 12.5, fontFamily: readerFace === "lexend" ? "'Lexend', sans-serif" : readerFace === "serif" ? "'Fraunces', serif" : "'Atkinson Hyperlegible', sans-serif", flexShrink: 0 }}
                onClick={() => { const next = readerFace === "hyper" ? "lexend" : readerFace === "lexend" ? "serif" : "hyper"; setReaderFace(next); flash(next === "lexend" ? "Lexend — wider spacing, easier tracking" : next === "serif" ? "Storybook serif" : "Hyperlegible — clearest letter shapes"); }}>
                Aa
              </button>
              <button aria-label="Smaller text" style={{ ...ghostBtn, padding: "4px 9px", flexShrink: 0 }} onClick={() => setReaderFont(Math.max(13, readerFont - 2))}>A−</button>
              <button aria-label="Bigger text" style={{ ...ghostBtn, padding: "4px 9px", flexShrink: 0 }} onClick={() => setReaderFont(Math.min(26, readerFont + 2))}>A+</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px", maxWidth: 640, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
            {reader.loading ? (
              <p style={{ color: T.inkSoft, textAlign: "center", marginTop: 60 }}>Opening your book… 📖</p>
            ) : (
              <div className="sl-page">
                <div style={{ fontSize: 11.5, color: T.inkSoft, textAlign: "center", marginBottom: 14 }}>
                  {tapMode === "define"
                    ? "💡 Tap any word for its meaning · tap a 🔊 to start reading aloud from there — it keeps going, page after page"
                    : "▶ Tap any sentence to start reading aloud from there — it keeps going until you stop it"}
                </div>
                <div style={{
                  fontSize: readerFont,
                  lineHeight: readerFace === "lexend" ? 1.85 : 1.7,
                  letterSpacing: readerFace === "lexend" ? "0.01em" : "normal",
                  fontFamily: readerFace === "lexend" ? "'Lexend', sans-serif"
                    : readerFace === "serif" ? "'Fraunces', Georgia, serif"
                    : "'Atkinson Hyperlegible', sans-serif",
                }}>
                  {(() => {
                    const page = reader.pages[reader.page];
                    const paras = [];
                    let cursor = 0;
                    for (const m of page.split(/(\n\s*\n)/)) {
                      if (/^\n\s*\n$/.test(m)) { cursor += m.length; continue; }
                      if (m.length) paras.push({ start: cursor, end: cursor + m.length });
                      cursor += m.length;
                    }
                    const renderWords = (start, end) => {
                      const segs = page.slice(start, end).split(/(\s+)/);
                      let off = start;
                      return segs.map((seg, i) => {
                        const segStart = off;
                        off += seg.length;
                        if (!/\S/.test(seg)) return seg;
                        const lit = readAlong.on && readAlong.char >= segStart && readAlong.char < segStart + seg.length;
                        return (
                          <span key={i}
                            onClick={() => { if (tapMode === "read") { readFromHere(segStart); } else { saveMark(segStart); lookupWord(seg); } }}
                            style={{ cursor: "pointer", borderRadius: 3, transition: "background .1s",
                              background: lit ? "#FFE9A8"
                                : (reader.mark && reader.mark.page === reader.page && reader.mark.char >= segStart && reader.mark.char < segStart + seg.length ? "#D8E8FA" : "transparent") }}>
                            {seg}
                          </span>
                        );
                      });
                    };
                    return paras.map((para, pi) => (
                      <div key={pi} style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}>
                        <button
                          aria-label="Listen to this paragraph"
                          title={audioBusy ? "Loading the narration…" : "Listen to this paragraph"}
                          onClick={() => readOnFrom(para.start)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: Math.max(12, readerFont - 4), opacity: 0.45,
                            padding: "0 6px 0 0", verticalAlign: "baseline",
                          }}>
                          🔊
                        </button>
                        {renderWords(para.start, para.end)}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>

          {practice && (
            <div style={{ borderTop: `1.5px solid ${T.green}`, background: "#F0F5F0", padding: "12px 16px", maxHeight: "42vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>🎙 Practice reading out loud</strong>
                <button aria-label="Close practice" style={{ background: "none", border: "none", color: T.inkSoft, cursor: "pointer", fontSize: 15 }} onClick={() => { stopListening(); setPractice(null); }}>✕</button>
              </div>
              <p style={{ fontSize: 12, color: T.inkSoft, margin: "4px 0 8px" }}>
                Read this passage out loud at your own pace — the app listens and shows which words it heard. No grades, just practice.
              </p>
              <div style={{ fontSize: 15, lineHeight: 1.7, background: T.card, border: `1px solid ${T.rule}`, borderRadius: 8, padding: "10px 12px" }}>
                {practice.words.map((w, i) => (
                  <span key={i} style={{
                    marginRight: 5, borderRadius: 3, padding: "0 2px",
                    background: practice.matched ? (practice.matched[i] ? "#CDE7D2" : "#F3DBD6") : "transparent",
                  }}>
                    {w}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                {!practice.listening && !practice.done && (
                  <button style={btn(T.green)} onClick={listenPractice}>● Start reading (I'm listening)</button>
                )}
                {practice.listening && (
                  <>
                    <button style={btn(T.stamp)} onClick={stopListening}>⏹ I'm done</button>
                    <span style={{ fontSize: 13, color: T.stamp, fontWeight: 700 }}>Listening… read the passage above</span>
                  </>
                )}
                {practice.done && (
                  <>
                    <div style={{ width: "100%" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: practice.pct >= 70 ? T.green : T.ink }}>
                        {practice.pct >= 70 ? `🎉 ${practice.pct}% — beautiful reading! +5 pts` : `${practice.pct}% heard — +5 pts for practicing. Green = heard, rosy = try those again.`}
                      </span>
                      {practice.wcpm > 0 && (() => {
                        const prev = (fluency || []).filter((f) => f.d !== new Date().toISOString().slice(0, 10));
                        const best = prev.length ? Math.max(...prev.map((f) => f.wcpm)) : 0;
                        return (
                          <div style={{ fontSize: 13, marginTop: 4, color: T.inkSoft }}>
                            Reading pace: <strong style={{ color: T.blue }}>{practice.wcpm} words per minute</strong>
                            {best > 0 && (
                              practice.wcpm > best
                                ? <span style={{ color: T.green, fontWeight: 700 }}> — a new personal best! 🌟</span>
                                : <span> · your best is {best}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <button style={ghostBtn} onClick={listenPractice}>Try again ↻</button>
                  </>
                )}
              </div>
            </div>
          )}

          {wordCard && (
            <div style={{ borderTop: `1.5px solid ${T.blue}`, background: "#F5F8FC", padding: "10px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 17 }}>{wordCard.word}</strong>
                  {wordCard.phonetic && <span style={{ marginLeft: 8, color: T.inkSoft, fontSize: 13 }}>{wordCard.phonetic}</span>}
                  {wordCard.pos && <em style={{ marginLeft: 8, color: T.blue, fontSize: 13 }}>{wordCard.pos}</em>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...ghostBtn, padding: "5px 12px", fontSize: 13 }} disabled={audioBusy} onClick={() => speakWord(wordCard.word)}>
                    {audioBusy ? "🔊 …" : "🔊 Hear it"}
                  </button>
                  <button aria-label="Close" style={{ background: "none", border: "none", color: T.inkSoft, cursor: "pointer", fontSize: 16 }} onClick={() => setWordCard(null)}>✕</button>
                </div>
              </div>
              <div style={{ fontSize: 14, marginTop: 4 }}>
                {wordCard.loading ? "Looking it up…" : wordCard.notFound
                  ? "Couldn't find a definition for that one — but you can still hear it out loud."
                  : <>{wordCard.definition}{wordCard.ai && <span style={{ marginLeft: 6, fontSize: 11, color: T.blue }}>✨</span>}</>}
              </div>
            </div>
          )}

          {!reader.loading && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
              padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", borderTop: `1.5px solid ${T.rule}`, background: T.card,
            }}>
              <button style={{ ...ghostBtn, opacity: reader.page === 0 ? 0.4 : 1 }} disabled={reader.page === 0} onClick={() => turnPage(-1)}>← Back</button>
              <span style={{ fontSize: 12, color: T.inkSoft, textAlign: "center" }}>
                Page {reader.page + 1} of {reader.pages.length} · {Math.round(((reader.page + 1) / reader.pages.length) * 100)}%
                {reader.mark && reader.mark.page !== reader.page && (
                  <button style={{ ...ghostBtn, display: "block", margin: "3px auto 0", padding: "2px 10px", fontSize: 11 }}
                    onClick={() => setReader({ ...reader, page: reader.mark.page })}>
                    ▸ back to my spot (p. {reader.mark.page + 1})
                  </button>
                )}
              </span>
              <button style={{ ...btn(T.green), opacity: reader.page >= reader.pages.length - 1 ? 0.4 : 1 }} disabled={reader.page >= reader.pages.length - 1} onClick={() => turnPage(1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {report && (
        <div style={{ position: "fixed", inset: 0, zIndex: 95, background: T.paper, overflowY: "auto", padding: 20 }}>
          <div className="sl-noprint" style={{ display: "flex", gap: 8, justifyContent: "flex-end", maxWidth: 780, margin: "0 auto 14px" }}>
            <button style={btn()} onClick={() => window.print()}>🖨 Print / Save as PDF</button>
            <button style={ghostBtn} onClick={() => setReport(null)}>Close</button>
          </div>

          <div id="sl-report" style={{
            maxWidth: 780, margin: "0 auto", background: "#FFF", border: `1px solid ${T.rule}`,
            borderRadius: 10, padding: "28px 32px", color: "#22334D", fontFamily: "'Atkinson Hyperlegible', sans-serif",
          }}>
            {report === "class" && teaching && (() => {
              const rows = (roster || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
              const avg = rows.length ? (rows.reduce((a, x) => a + (x.chapter || 0), 0) / rows.length).toFixed(1) : "0";
              const totalQ = rows.reduce((a, x) => a + Object.keys(x.quizzes || {}).length, 0);
              const passQ = rows.reduce((a, x) => a + Object.values(x.quizzes || {}).filter((q) => q.passed).length, 0);
              return (
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26 }}>{teaching.className}</div>
                  <div style={{ fontSize: 13.5, color: "#5A6B85" }}>
                    Reading progress report · {teaching.teacher} · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                  <div style={{ fontSize: 13.5, marginTop: 2 }}>
                    Book: <strong>{teaching.book}</strong>{teaching.bookAuthor ? ` by ${teaching.bookAuthor}` : ""} · {teaching.chapters} chapters
                  </div>

                  <div style={{ display: "flex", gap: 22, flexWrap: "wrap", margin: "16px 0", padding: "12px 0", borderTop: "2px solid #E4DECB", borderBottom: "2px solid #E4DECB" }}>
                    <div><div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 900 }}>{rows.length}</div><div style={{ fontSize: 11.5, color: "#5A6B85" }}>READERS</div></div>
                    <div><div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 900 }}>{avg}</div><div style={{ fontSize: 11.5, color: "#5A6B85" }}>AVG CHAPTER</div></div>
                    <div><div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 900 }}>{passQ}/{totalQ}</div><div style={{ fontSize: 11.5, color: "#5A6B85" }}>QUIZZES PASSED</div></div>
                    <div><div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 900 }}>{rows.reduce((a, x) => a + (x.minWeek || 0), 0)}</div><div style={{ fontSize: 11.5, color: "#5A6B85" }}>MINUTES READ (7 DAYS)</div></div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid #22334D", textAlign: "left" }}>
                        <th style={{ padding: "6px 4px" }}>Reader</th>
                        <th style={{ padding: "6px 4px" }}>Chapter</th>
                        <th style={{ padding: "6px 4px" }}>Quizzes passed</th>
                        <th style={{ padding: "6px 4px" }}>Min / 7 days</th>
                        <th style={{ padding: "6px 4px" }}>Read-aloud pace</th>
                        <th style={{ padding: "6px 4px" }}>Last active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const qs = Object.values(r.quizzes || {});
                        const last = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
                        return (
                          <tr key={r.name} style={{ borderBottom: "1px solid #E4DECB" }}>
                            <td style={{ padding: "6px 4px", fontWeight: 700 }}>{r.name}</td>
                            <td style={{ padding: "6px 4px" }}>{r.chapter || 0} of {teaching.chapters}</td>
                            <td style={{ padding: "6px 4px" }}>{qs.filter((q) => q.passed).length} of {qs.length || 0}</td>
                            <td style={{ padding: "6px 4px" }}>{r.minWeek || 0}</td>
                            <td style={{ padding: "6px 4px" }}>{r.wcpm ? `${r.wcpm} wpm` : "—"}</td>
                            <td style={{ padding: "6px 4px" }}>{last}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 11.5, color: "#5A6B85", marginTop: 18, borderTop: "1px solid #E4DECB", paddingTop: 10 }}>
                    Generated by Shelf Life from what readers actually did in the app — no student filled out a log to produce this.
                    Readers are listed alphabetically and never ranked.
                  </p>
                </div>
              );
            })()}

            {report === "me" && (() => {
              const last30 = readLog.slice(-30);
              const tot = last30.reduce((a, x) => ({ min: a.min + (x.min || 0), ch: a.ch + (x.ch || 0), qz: a.qz + (x.qz || 0) }), { min: 0, ch: 0, qz: 0 });
              return (
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26 }}>My reading log</div>
                  <div style={{ fontSize: 13.5, color: "#5A6B85" }}>
                    {classroom?.name || userName || "Reader"} · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                  <div style={{ display: "flex", gap: 22, flexWrap: "wrap", margin: "16px 0", padding: "12px 0", borderTop: "2px solid #E4DECB", borderBottom: "2px solid #E4DECB" }}>
                    <div><div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 900 }}>{tot.min}</div><div style={{ fontSize: 11.5, color: "#5A6B85" }}>MINUTES</div></div>
                    <div><div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 900 }}>{tot.ch}</div><div style={{ fontSize: 11.5, color: "#5A6B85" }}>CHAPTERS</div></div>
                    <div><div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 900 }}>{tot.qz}</div><div style={{ fontSize: 11.5, color: "#5A6B85" }}>QUIZZES</div></div>
                    <div><div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 900 }}>{books.filter((b) => b.status === "done").length}</div><div style={{ fontSize: 11.5, color: "#5A6B85" }}>BOOKS FINISHED</div></div>
                  </div>
                  {last30.length === 0 ? (
                    <p style={{ fontSize: 13.5 }}>Nothing logged yet — read a few pages in the app and this fills itself in.</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #22334D", textAlign: "left" }}>
                          <th style={{ padding: "6px 4px" }}>Date</th>
                          <th style={{ padding: "6px 4px" }}>Minutes read</th>
                          <th style={{ padding: "6px 4px" }}>Chapters</th>
                          <th style={{ padding: "6px 4px" }}>Quizzes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {last30.slice().reverse().map((x) => (
                          <tr key={x.d} style={{ borderBottom: "1px solid #E4DECB" }}>
                            <td style={{ padding: "6px 4px" }}>{new Date(x.d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</td>
                            <td style={{ padding: "6px 4px" }}>{x.min || 0}</td>
                            <td style={{ padding: "6px 4px" }}>{x.ch || 0}</td>
                            <td style={{ padding: "6px 4px" }}>{x.qz || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p style={{ fontSize: 11.5, color: "#5A6B85", marginTop: 18, borderTop: "1px solid #E4DECB", paddingTop: 10 }}>
                    This log filled itself in from real reading in the Shelf Life app. No signatures required.
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <style>{`
        /* --- Paper fibre. Real manila stock isn't a flat colour. Kept at 3.5%
               so it reads as material, never as noise. --- */
        body::before {
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:0.035;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23f)'/%3E%3C/svg%3E");
        }
        header, nav, main, footer { position:relative; z-index:1; }

        /* --- Spines behave like objects: lift and turn toward you --- */
        .sl-spine { transition: transform .16s cubic-bezier(.2,.8,.2,1), box-shadow .16s ease, filter .16s ease; }
        .sl-spine:hover { transform: translateY(-9px) rotate(0deg) scale(1.03) !important;
          box-shadow: inset 0 2px 0 rgba(255,255,255,0.28), 3px 12px 16px -6px rgba(34,51,77,0.5) !important;
          z-index:2; }
        .sl-spine:active { transform: translateY(-4px) !important; }

        /* --- The FINISHED mark should look pressed into the paper, not printed --- */
        .sl-stamp { transform: rotate(-3.5deg); opacity:0.88;
          text-shadow: 0 0 1px rgba(194,70,50,0.5); letter-spacing:0.14em; }

        /* --- The reader is an open book: shade the gutter and lift the page --- */
        .sl-page { position:relative; }
        .sl-page::before {
          content:""; position:absolute; left:-22px; top:0; bottom:0; width:26px; pointer-events:none;
          background:linear-gradient(90deg, rgba(34,51,77,0.10), rgba(34,51,77,0.02) 60%, transparent);
        }

        /* --- Elevation: cards lift off the paper instead of sitting flat --- */
        .sl-shell { box-shadow: ${T.lift3}; }
        main > div > div[style*="border-radius"], main [style*="borderRadius: 1"] { }

        /* --- Display type: tighter, more confident headings --- */
        h1, h2, h3 { letter-spacing: -0.018em; }
        h1 { line-height: 1.02; }
        h2 { line-height: 1.12; }

        /* --- Body rhythm: measurably easier to read than browser defaults --- */
        body { line-height: 1.55; }

        /* --- Buttons feel like objects you can press --- */
        button { transition: transform .12s ease, box-shadow .12s ease, filter .12s ease; }
        button:hover:not(:disabled) { filter: brightness(1.04); }
        button:active:not(:disabled) { transform: translateY(1px); }

        /* --- Tab bar: the active tab reads as the front card in a catalogue --- */
        .sl-tab { transition: background .15s ease, color .15s ease, transform .15s ease; }
        .sl-tab:hover { transform: translateY(-1px); }

        /* --- Cards gain a quiet lift and respond to the cursor --- */
        .sl-card { box-shadow: ${T.lift1}; transition: box-shadow .18s ease, transform .18s ease; }
        .sl-card:hover { box-shadow: ${T.lift2}; transform: translateY(-2px); }

        /* --- Section headings get a small stamped rule, echoing the card catalogue --- */
        .sl-rule::after { content:""; display:block; width:44px; height:3px;
          background:${T.stamp}; border-radius:99px; margin-top:6px; }

        @media (prefers-reduced-motion: reduce) {
          .sl-card:hover, .sl-tab:hover, button:active { transform:none; }
        }

        @media print {
          body * { visibility: hidden !important; }
          #sl-report, #sl-report * { visibility: visible !important; }
          #sl-report { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; background: #fff !important; }
          .sl-noprint { display: none !important; }
        }
      `}</style>

      <InstallPrompt />

      {/* Confetti */}
      {confetti && (
        <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }}>
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute", top: 0, left: `${(i * 37) % 100}%`,
              width: 8 + (i % 3) * 3, height: 12 + (i % 4) * 3,
              background: SPINES[i % SPINES.length],
              borderRadius: i % 2 ? 99 : 2,
              animation: `confettiFall ${1.6 + (i % 5) * 0.25}s ease-in ${(i % 7) * 0.12}s forwards`,
            }} />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: T.ink, color: "#FFF", padding: "10px 18px", borderRadius: 999,
          fontSize: 14, boxShadow: "0 4px 14px rgba(0,0,0,0.25)", zIndex: 50,
          animation: "rise .25s ease",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{
        fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "0 0 10px",
        borderBottom: `2px solid #C3CFE0`, paddingBottom: 6,
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// Fallback page-count lookup (Google Books, free, no key) for when Open Library has no count
async function lookupPages(title, author) {
  try {
    const q = `intitle:${title}` + (author ? ` inauthor:${author}` : "");
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`);
    const d = await r.json();
    return d.items?.[0]?.volumeInfo?.pageCount || "";
  } catch {
    return "";
  }
}

// Autocomplete title input — suggestions pop up from Open Library as you type.
// Picking one auto-fills title/author/pages; free typing still works.
function BookTitleInput({ value, onChange, onPick, placeholder }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = (value || "").trim();
    if (q.length < 3) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        // Search BOTH catalogs at once and merge — far wider coverage
        const gutenPromise = gutenbergLookup(q); // runs in background, never blocks
        const [ol, gb] = await Promise.allSettled([
          fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15&fields=key,title,author_name,number_of_pages_median,cover_i,first_publish_year`).then((r) => r.json()),
          fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12`).then((r) => r.json()),
        ]);
        const merged = [];
        const seen = new Set();
        const push = (item) => {
          const sig = `${(item.title || "").toLowerCase()}|${(item.author || "").toLowerCase()}`;
          if (item.title && !seen.has(sig)) { seen.add(sig); merged.push(item); }
        };
        if (ol.status === "fulfilled") {
          (ol.value.docs || []).forEach((d) => push({
            key: `ol-${d.key}`,
            title: d.title,
            author: (d.author_name || [])[0] || "",
            pages: d.number_of_pages_median || "",
            year: d.first_publish_year || "",
            cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-S.jpg` : null,
          }));
        }
        if (gb.status === "fulfilled") {
          (gb.value.items || []).forEach((it) => {
            const v = it.volumeInfo || {};
            push({
              key: `gb-${it.id}`,
              title: v.title,
              author: (v.authors || [])[0] || "",
              pages: v.pageCount || "",
              year: (v.publishedDate || "").slice(0, 4),
              cover: v.imageLinks?.smallThumbnail?.replace("http://", "https://") || null,
            });
          });
        }
        setResults(merged.slice(0, 20));
        // Free-library check in the background — never slows the dropdown
        gutenbergLookup(q).then((glist) => {
          if (!glist || !glist.length) return;
          setResults((prev) => prev.map((m) => {
            const g = matchGuten(glist, m.title, m.author);
            return g ? { ...m, gutenId: g.gid } : m;
          }));
        });
        setOpen(true);
        gutenPromise.then((glist) => {
          if (!glist.length) return;
          setResults((prev) => prev.map((m) => {
            const g = matchGuten(glist, m.title, m.author);
            return g ? { ...m, gutenId: g.gid } : m;
          }));
        });
      } catch { /* quiet fail — manual typing still works */ }
      setLoading(false);
    }, 450);
    return () => clearTimeout(t);
  }, [value]);

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px",
    border: `1.5px solid ${T.rule}`, borderRadius: 8, background: T.card,
    color: T.ink, fontSize: 15, fontFamily: "'Atkinson Hyperlegible', sans-serif", outline: "none",
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        style={inputStyle}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        autoComplete="off"
      />
      {loading && (
        <span style={{ position: "absolute", right: 10, top: 12, fontSize: 12, color: T.inkSoft }}>…</span>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40,
          background: T.card, border: `1.5px solid ${T.blue}`, borderRadius: 10,
          maxHeight: 380, overflowY: "auto", boxShadow: "0 8px 24px rgba(34,51,77,0.22)",
        }}>
          {results.map((r) => {
            const author = r.author;
            return (
              <button
                key={r.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick({
                    title: r.title,
                    author,
                    pages: r.pages || "",
                  });
                  setOpen(false);
                }}
                style={{
                  display: "flex", gap: 10, alignItems: "center", width: "100%",
                  textAlign: "left", padding: "8px 10px", border: "none", cursor: "pointer",
                  background: "transparent", borderBottom: `1px solid ${T.rule}`,
                  fontFamily: "'Atkinson Hyperlegible', sans-serif",
                }}
              >
                <CoverThumb src={r.cover || (r.gutenId ? gutenCover(r.gutenId) : null)} title={r.title} w={28} h={40} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: T.ink, lineHeight: 1.2 }}>
                    {r.title}{r.gutenId ? " 📱" : ""}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: T.inkSoft }}>
                    {author}{r.year ? ` · ${r.year}` : ""}{r.pages ? ` · ${r.pages} pages` : ""}{r.gutenId ? " · free digital" : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookRow({ book, children, onRemove, stamp }) {
  return (
    <div style={{
      border: "1px solid #C3CFE0", borderRadius: 10, padding: "12px 14px",
      marginBottom: 10, background: "#F4EEDD", position: "relative",
      borderLeft: `6px solid ${spineColor(book.title)}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18 }}>{book.title}</div>
          {book.author && <div style={{ fontSize: 13, color: "#5A6B85" }}>{book.author}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {stamp && (
            <span style={{
              border: "2px solid #C24632", color: "#C24632", borderRadius: 4,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", padding: "2px 8px",
              transform: "rotate(-3deg)", whiteSpace: "nowrap",
            }}>
              {stamp}
            </span>
          )}
          <button onClick={onRemove} aria-label={`Remove ${book.title}`}
            style={{ background: "none", border: "none", color: "#5A6B85", cursor: "pointer", fontSize: 16, padding: 2 }}>
            ✕
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
