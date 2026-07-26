// storage.js — personal data stays on the device; shared data goes through the
// server gateway at /api/kv.
//
// SECURITY NOTE: the browser no longer holds any database credentials. Every
// shared read/write is validated server-side (see api/kv.js), so a stranger
// can't enumerate classes, read student progress, or overwrite records.

export const sharedIsLive = true; // the gateway is always present in production

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

async function gateway(op, payload) {
  const r = await fetch("/api/kv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...payload }),
  });
  if (!r.ok) throw new Error(`kv ${op} failed (${r.status})`);
  return r.json();
}

const remote = {
  get: (key) => gateway("get", { key }),
  set: (key, value) => gateway("set", { key, value }),
  delete: (key) => gateway("delete", { key }),
  list: (prefix = "") => gateway("list", { prefix }),
};

export const storage = {
  get: (key, shared = false) => (shared ? remote.get(key) : local.get(key)),
  set: (key, value, shared = false) => (shared ? remote.set(key, value) : local.set(key, value)),
  delete: (key, shared = false) => (shared ? remote.delete(key) : local.delete(key)),
  list: (prefix = "", shared = false) => (shared ? remote.list(prefix) : local.list(prefix)),
};
