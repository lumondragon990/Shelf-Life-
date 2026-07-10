// storage.js — drop-in replacement for the Claude artifact's window.storage API.
//
// Personal data  -> localStorage (works instantly, offline, no account needed)
// Shared data    -> Supabase, IF configured via env vars; otherwise falls back
//                   to localStorage so the app still runs (shared features just
//                   won't sync between devices until Supabase is connected).
//
// To turn on real shared features (book club wall, meetups, classrooms):
//   1. Create a free project at supabase.com
//   2. Run this SQL in the Supabase SQL editor:
//
//        create table kv (
//          key text primary key,
//          value text not null,
//          updated_at timestamptz default now()
//        );
//        alter table kv enable row level security;
//        create policy "public read"  on kv for select using (true);
//        create policy "public write" on kv for insert with check (true);
//        create policy "public update" on kv for update using (true);
//
//      (Fine for a pilot. Before real scale, tighten policies + add auth.)
//   3. In Vercel -> Project -> Settings -> Environment Variables, add:
//        VITE_SUPABASE_URL      = https://xxxx.supabase.co
//        VITE_SUPABASE_ANON_KEY = eyJ...
//   4. Redeploy. Shared features now sync across every device.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && anon ? createClient(url, anon) : null;
export const sharedIsLive = !!supabase;

const LOCAL_PREFIX = "shelflife:";

const local = {
  async get(key) {
    const v = localStorage.getItem(LOCAL_PREFIX + key);
    if (v === null) throw new Error("Key not found");
    return { key, value: v };
  },
  async set(key, value) {
    localStorage.setItem(LOCAL_PREFIX + key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem(LOCAL_PREFIX + key);
    return { key, deleted: true };
  },
  async list(prefix = "") {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LOCAL_PREFIX + prefix)) keys.push(k.slice(LOCAL_PREFIX.length));
    }
    return { keys, prefix };
  },
};

const remote = {
  async get(key) {
    const { data, error } = await supabase.from("kv").select("value").eq("key", key).single();
    if (error || !data) throw new Error("Key not found");
    return { key, value: data.value, shared: true };
  },
  async set(key, value) {
    const { error } = await supabase.from("kv").upsert({ key, value });
    if (error) throw error;
    return { key, value, shared: true };
  },
  async delete(key) {
    await supabase.from("kv").delete().eq("key", key);
    return { key, deleted: true, shared: true };
  },
  async list(prefix = "") {
    const { data, error } = await supabase
      .from("kv")
      .select("key")
      .like("key", `${prefix}%`)
      .order("key", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { keys: (data || []).map((r) => r.key), prefix, shared: true };
  },
};

// Same call signatures as the artifact API: (key, value?, shared?)
export const storage = {
  get: (key, shared = false) => (shared && supabase ? remote.get(key) : local.get(key)),
  set: (key, value, shared = false) => (shared && supabase ? remote.set(key, value) : local.set(key, value)),
  delete: (key, shared = false) => (shared && supabase ? remote.delete(key) : local.delete(key)),
  list: (prefix = "", shared = false) => (shared && supabase ? remote.list(prefix) : local.list(prefix)),
};
