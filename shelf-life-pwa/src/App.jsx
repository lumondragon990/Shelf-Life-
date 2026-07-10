import { useState, useEffect, useMemo } from "react";
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
};
const SPINES = ["#2B5EA7", "#C24632", "#3E7C59", "#D9A03F", "#7C5CB0", "#B85C8A", "#4A8C9E"];

const spineColor = (title) => {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return SPINES[h % SPINES.length];
};

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
  { title: "The Alchemist", author: "Paulo Coelho", pages: 197, tags: ["Short reads", "Classics"], blurb: "Simple sentences, big journey. A favorite first 'grown-up' book." },
];
const ALL_TAGS = ["All", "Short reads", "Funny", "Adventure", "Heartwarming", "Fantasy", "Classics", "Pictures inside"];

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
};

function scoreQuiz(answers) {
  const tagScores = {};
  let maxPages = Infinity;
  answers.forEach((ai, qi) => {
    const opt = QUIZ[qi]?.options[ai];
    if (!opt) return;
    Object.entries(opt.tags).forEach(([t, v]) => { tagScores[t] = (tagScores[t] || 0) + v; });
    if (opt.maxPages) maxPages = Math.min(maxPages, opt.maxPages);
  });
  return { tagScores, maxPages };
}

function matchBooks(answers) {
  const { tagScores, maxPages } = scoreQuiz(answers);
  return PICKS.map((p) => {
    let score = p.tags.reduce((s, t) => s + (tagScores[t] || 0), 0);
    score += p.pages <= maxPages ? 1 : -2;
    return { ...p, score, reasons: p.tags.filter((t) => tagScores[t]) };
  }).sort((a, b) => b.score - a.score);
}

const topTag = (tagScores) => Object.entries(tagScores).sort((a, b) => b[1] - a[1])[0]?.[0] || "Heartwarming";

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
    return { books: d.books || [], readDays: d.readDays || [], goalDays: d.goalDays || 4, quiz: d.quiz || null, points: d.points || 0, quizResults: d.quizResults || {}, classroom: d.classroom || null, teaching: d.teaching || null };
  } catch {
    return { books: [], readDays: [], goalDays: 4, quiz: null, points: 0, quizResults: {}, classroom: null, teaching: null };
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
  const [tab, setTab] = useState("shelf");
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
  const [classroom, setClassroom] = useState(null); // student: {code, name, className, teacher, book, chapters, chapter}
  const [teaching, setTeaching] = useState(null); // teacher: {code, className, teacher, book, chapters}
  const [classMode, setClassMode] = useState(null); // null | "teacher-setup" | "student-join"
  const [classForm, setClassForm] = useState({ teacher: "", className: "", book: "", chapters: "" });
  const [joinForm, setJoinForm] = useState({ code: "", name: "" });
  const [roster, setRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [classBusy, setClassBusy] = useState(false);

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
      book: classForm.book.trim().slice(0, 80),
      chapters: Math.max(1, Math.min(99, parseInt(classForm.chapters) || 10)),
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
      const me = { name, chapter: 0, updatedAt: Date.now() };
      await publishClassProgress(code, me);
      persist({ classroom: { ...cls, code, name, chapter: 0 } });
      setClassMode(null);
      flash(`Welcome to ${cls.className}! 📚`);
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
    persist({ classroom: next, readDays: delta > 0 ? withToday(readDays) : readDays });
    try {
      await publishClassProgress(classroom.code, { name: classroom.name, chapter, updatedAt: Date.now() });
    } catch { /* will sync next update */ }
    if (chapter === classroom.chapters) {
      celebrate();
      flash("You finished the class book! 🎉");
    }
  };

  const loadRoster = async (code) => {
    setRosterLoading(true);
    setRoster(await fetchRoster(code));
    setRosterLoading(false);
  };

  const persist = (patch) => {
    const next = { books, readDays, goalDays, quiz, points, quizResults, classroom, teaching, ...patch };
    setBooks(next.books);
    setReadDays(next.readDays);
    setGoalDays(next.goalDays);
    setQuiz(next.quiz);
    setPoints(next.points);
    setQuizResults(next.quizResults);
    setClassroom(next.classroom);
    setTeaching(next.teaching);
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
    persist({ books: nextBooks, readDays: nextDays });
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
    flash(unlocked ? "Finished! +25 pts & gift unlocked 🎁" : "Finished! +25 pts — take the book quiz for up to 50 more 🧠");
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

  // ----- Open Library book search (~40 million books, free, no key) -----
  const searchBooks = async () => {
    const q = bookQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=key,title,author_name,number_of_pages_median,cover_i,first_publish_year`
      );
      const d = await r.json();
      setSearchResults(d.docs || []);
    } catch {
      flash("Search hiccup — check your connection and try again");
    }
    setSearching(false);
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
    const { tagScores, maxPages } = scoreQuiz(quiz);
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
            content: `Recommend exactly 3 real, well-known books for a beginner reader building a reading habit. Their taste: ${likes}. ${maxPages !== Infinity ? `Prefer books under ${maxPages} pages.` : ""} Do NOT recommend any of these (already known to them): ${avoid}. Respond with ONLY a JSON array, no markdown fences, no other text: [{"title": "...", "author": "...", "pages": 123, "why": "one friendly sentence on why it fits them"}]`,
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
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "clamp(30px, 6vw, 44px)", margin: 0, letterSpacing: "-0.02em" }}>
            Shelf Life
          </h1>
          <div style={{
            border: `2px solid ${T.stamp}`, color: T.stamp, borderRadius: 6, padding: "3px 10px",
            fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", transform: "rotate(-2deg)",
          }}>
            NEW READERS WELCOME
          </div>
        </div>
        <p style={{ margin: "6px 0 0", color: T.inkSoft, fontSize: 15 }}>
          Track your books, find your next one, and talk about them with other readers. Go at your own pace — this is your shelf, not a race.
        </p>
      </header>

      {/* Tabs */}
      <nav style={{ maxWidth: 880, margin: "18px auto 0", padding: "0 18px", display: "flex", gap: 8, overflowX: "auto" }}>
        {[
          ["shelf", "My shelf"],
          ["discover", "Find a book"],
          ["personality", "Personality"],
          ["club", "Book club"],
          ["classroom", "Classroom"],
          ["rewards", "Rewards"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: "0 0 auto", padding: "10px 18px", borderRadius: "10px 10px 0 0",
              border: `1.5px solid ${T.rule}`, borderBottom: "none", cursor: "pointer",
              background: tab === id ? T.card : "rgba(255,255,255,0.35)",
              color: tab === id ? T.ink : T.inkSoft,
              fontWeight: tab === id ? 700 : 400, fontSize: 15,
              fontFamily: "'Atkinson Hyperlegible', sans-serif",
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main style={{
        maxWidth: 880, margin: "0 auto 60px", padding: "22px 18px 30px",
        background: T.card, border: `1.5px solid ${T.rule}`, borderRadius: "0 12px 12px 12px",
        minHeight: 420,
      }}>
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

            {/* Bookshelf visualization */}
            {books.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, padding: "0 8px", minHeight: 84, flexWrap: "wrap" }}>
                  {books.slice(0, 24).map((b, i) => {
                    const h = 56 + ((b.title.length * 7 + i * 13) % 28);
                    const w = 16 + ((b.title.length * 3) % 12);
                    return (
                      <div
                        key={b.id}
                        title={`${b.title}${b.author ? " — " + b.author : ""}`}
                        style={{
                          width: w, height: h, background: spineColor(b.title),
                          borderRadius: "3px 3px 0 0", position: "relative",
                          opacity: b.status === "want" ? 0.45 : 1,
                          boxShadow: "inset -3px 0 rgba(0,0,0,0.18)",
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{ height: 10, background: "#8A6B45", borderRadius: 3, boxShadow: "0 3px 0 #6E5334" }} />
                <p style={{ fontSize: 12, color: T.inkSoft, margin: "6px 4px 0" }}>
                  Your shelf so far — faded spines are books you want to read. Hover a spine to see its title.
                </p>
              </div>
            )}

            {/* Add book */}
            {!showAdd ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={btn(T.green)} onClick={() => setShowAdd(true)}>+ Add a book</button>
                <button style={readToday ? ghostBtn : btn(T.stamp)} onClick={markToday}>
                  {readToday ? "Read today ✓" : "I read today — any amount counts 🌱"}
                </button>
              </div>
            ) : (
              <Ruled style={{ marginBottom: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                  <input style={input} placeholder="Book title *" value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <input style={input} placeholder="Author" value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })} />
                  <input style={input} placeholder="Pages (guess is fine)" inputMode="numeric" value={form.pages}
                    onChange={(e) => setForm({ ...form, pages: e.target.value.replace(/\D/g, "") })} />
                  <select style={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="reading">Reading it now</option>
                    <option value="want">Want to read</option>
                    <option value="done">Already finished</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    style={{ ...btn(T.green), opacity: form.title.trim() ? 1 : 0.5 }}
                    disabled={!form.title.trim()}
                    onClick={() => {
                      addBook({ ...form, status: form.status });
                      setForm({ title: "", author: "", pages: "", status: "reading" });
                      setShowAdd(false);
                    }}
                  >
                    Add to shelf
                  </button>
                  <button style={ghostBtn} onClick={() => setShowAdd(false)}>Cancel</button>
                </div>
              </Ruled>
            )}

            {!loaded && <p style={{ color: T.inkSoft }}>Opening your shelf…</p>}
            {loaded && books.length === 0 && (
              <Ruled style={{ marginTop: 16 }}>
                <p style={{ margin: 0, lineHeight: "28px" }}>
                  <strong>Your shelf is empty — that's the fun part.</strong> Add a book you're reading,
                  or head to <em>Find a book</em> for beginner-friendly picks. Even 5 pages a day counts.
                </p>
              </Ruled>
            )}

            {/* Reading now */}
            {reading.length > 0 && (
              <Section title="Reading now">
                {reading.map((b) => (
                  <BookRow key={b.id} book={b} onRemove={() => removeBook(b.id)}>
                    <div style={{ marginTop: 8 }}>
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
                      </div>
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
            </Ruled>

            {searchResults && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, margin: "0 0 10px" }}>
                    {searchResults.length ? `Results for “${bookQuery}”` : `Nothing found for “${bookQuery}” — try fewer words?`}
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
                        {r.cover_i ? (
                          <img
                            src={`https://covers.openlibrary.org/b/id/${r.cover_i}-M.jpg`}
                            alt=""
                            style={{ width: 52, height: 76, objectFit: "cover", borderRadius: 4, flexShrink: 0, boxShadow: "1px 2px 5px rgba(34,51,77,0.25)" }}
                          />
                        ) : (
                          <div style={{ width: 52, height: 76, borderRadius: 4, flexShrink: 0, background: spineColor(r.title), boxShadow: "inset -4px 0 rgba(0,0,0,0.18)" }} />
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{r.title}</div>
                          <div style={{ fontSize: 12, color: T.inkSoft }}>
                            {author}{r.first_publish_year ? ` · ${r.first_publish_year}` : ""}{pages ? ` · ${pages} pages` : ""}
                          </div>
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
                const { tagScores } = scoreQuiz(quiz);
                const arch = ARCHETYPES[topTag(tagScores)];
                const matches = matchBooks(quiz).filter((m) => !onShelfTitles.has(m.title.toLowerCase())).slice(0, 5);
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
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ---------------- CLASSROOM ---------------- */}
        {tab === "classroom" && (
          <div style={{ animation: "rise .3s ease" }}>
            {/* Entry choice */}
            {!teaching && !classroom && !classMode && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26 }}>Classroom</div>
                  <p style={{ color: T.inkSoft, margin: "6px auto 0", fontSize: 14, maxWidth: 480 }}>
                    Read a book together, chapter by chapter. Teachers see where each reader is —
                    to help, never to rank.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button onClick={() => setClassMode("teacher-setup")} style={{
                    flex: "1 1 240px", background: T.card, border: `2px solid ${T.blue}`, borderRadius: 12,
                    padding: "22px 18px", cursor: "pointer", textAlign: "center", fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    <div style={{ fontSize: 34 }}>🍎</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: T.ink }}>I'm a teacher</div>
                    <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>Set up a class book and get a join code for your students</div>
                  </button>
                  <button onClick={() => setClassMode("student-join")} style={{
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
            {classMode === "teacher-setup" && !teaching && (
              <Ruled>
                <div style={{ fontWeight: 700, marginBottom: 8, lineHeight: "28px" }}>Set up your class</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
                  <input style={input} placeholder="Your name * (e.g. Ms. Rivera)" maxLength={40} value={classForm.teacher}
                    onChange={(e) => setClassForm({ ...classForm, teacher: e.target.value })} />
                  <input style={input} placeholder="Class name * (e.g. Period 3 ELA)" maxLength={50} value={classForm.className}
                    onChange={(e) => setClassForm({ ...classForm, className: e.target.value })} />
                  <input style={input} placeholder="Book you're reading *" maxLength={80} value={classForm.book}
                    onChange={(e) => setClassForm({ ...classForm, book: e.target.value })} />
                  <input style={input} placeholder="Number of chapters" inputMode="numeric" value={classForm.chapters}
                    onChange={(e) => setClassForm({ ...classForm, chapters: e.target.value.replace(/\D/g, "") })} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...btn(), opacity: classForm.teacher.trim() && classForm.className.trim() && classForm.book.trim() && !classBusy ? 1 : 0.5 }}
                    disabled={!classForm.teacher.trim() || !classForm.className.trim() || !classForm.book.trim() || classBusy}
                    onClick={createClass}>
                    {classBusy ? "Creating…" : "Create class & get code"}
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

            {/* Teacher dashboard */}
            {teaching && (
              <div>
                <div style={{
                  border: `2px solid ${T.blue}`, borderRadius: 14, padding: "16px 18px",
                  background: "#F5F8FC", marginBottom: 16, display: "flex", justifyContent: "space-between",
                  alignItems: "center", flexWrap: "wrap", gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.blue, fontWeight: 700 }}>YOUR CLASS</div>
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
                    </div>
                  );
                })}

                <button style={{ ...ghostBtn, marginTop: 12, borderColor: T.stamp, color: T.stamp }}
                  onClick={() => { persist({ teaching: null }); setRoster(null); }}>
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
                  <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.green, fontWeight: 700 }}>YOUR CLASS</div>
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
                    Your teacher can see your chapter — that's how they know when to help, not to rank you.
                  </div>
                </Ruled>

                <button style={{ ...ghostBtn, marginTop: 12, borderColor: T.stamp, color: T.stamp }}
                  onClick={() => persist({ classroom: null })}>
                  Leave this class
                </button>
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
