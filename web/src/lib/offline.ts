import { supabase } from "./supabase";

type OfflineOp = {
  id: string;
  type: string;
  payload: any;
  createdAt: number;
  status: "pending" | "syncing" | "synced" | "failed";
  result?: any;
  error?: string;
};

const KEY = "offline:queue_v1";
const MAP_KEY = "offline:map_v1";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadQueue(): OfflineOp[] {
  try {
    const raw = localStorage.getItem(KEY) || "[]";
    return JSON.parse(raw) as OfflineOp[];
  } catch (e) {
    console.warn("offline: failed to load queue", e);
    return [];
  }
}

function saveQueue(q: OfflineOp[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch (e) {
    console.warn("offline: failed to save queue", e);
  }
}

export function getQueue() {
  return loadQueue();
}

export function getMap() {
  return loadMap();
}

export function clearQueue() {
  saveQueue([]);
}

export function enqueueOperation(type: string, payload: any) {
  const q = loadQueue();
  const op: OfflineOp = {
    id: makeId(),
    type,
    payload,
    createdAt: Date.now(),
    status: "pending",
  };
  q.push(op);
  saveQueue(q);
  console.debug("offline: enqueued", op);
  return op.id;
}

function loadMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MAP_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function saveMap(m: Record<string, string>) {
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify(m));
  } catch (e) {
    console.warn("offline: failed to save map", e);
  }
}

function setMapping(tempId: string, realId: string) {
  const m = loadMap();
  m[tempId] = realId;
  saveMap(m);
}

function resolveTempIdsInObject(obj: any, map: Record<string, string>): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => (typeof v === "string" ? map[v] ?? v : resolveTempIdsInObject(v, map)));
  const res: any = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string") {
      res[k] = map[v] ?? v;
    } else if (typeof v === "object" && v !== null) {
      res[k] = resolveTempIdsInObject(v, map);
    } else {
      res[k] = v;
    }
  }
  return res;
}

async function processOp(op: OfflineOp) {
  try {
    if (op.type === "create_customer") {
      const { data, error } = await supabase.from("customers").insert(op.payload).select();
      if (error) throw error;
      op.result = data?.[0] ?? null;
      op.status = "synced";
      return op;
    }

    if (op.type === "create_invoice") {
      const { data, error } = await supabase.from("invoices").insert(op.payload).select();
      if (error) throw error;
      op.result = data?.[0] ?? null;
      op.status = "synced";
      return op;
    }

    // fallback: mark as failed for unknown types
    op.status = "failed";
    op.error = `unknown operation type ${op.type}`;
    return op;
  } catch (err: any) {
    op.status = "failed";
    op.error = String(err?.message ?? err);
    return op;
  }
}

export async function processQueueOnce() {
  const q = loadQueue();
  if (!q.length) return;
  console.debug("offline: processing queue", q.length);
  for (const item of q) {
    if (item.status === "synced") continue;
    // Resolve any temp ids in payload using map
    const map = loadMap();
    if (Object.keys(map).length) {
      try {
        item.payload = resolveTempIdsInObject(item.payload, map);
      } catch (e) {
        console.warn("offline: failed to resolve temp ids", e);
      }
    }

    item.status = "syncing";
    saveQueue(q);
    const res = await processOp(item);
    // if we created a customer and have a real id, add mapping from op.id -> real id
    try {
      if (item.type === "create_customer" && res.result && res.result.id) {
        setMapping(item.id, String(res.result.id));
        // after mapping, try to replace other queued payloads
        const updatedMap = loadMap();
        for (const other of q) {
          if (other.id === item.id) continue;
          other.payload = resolveTempIdsInObject(other.payload, updatedMap);
        }
      }
    } catch (e) {
      console.warn("offline: set mapping failed", e);
    }

    // update queue entry
    const idx = q.findIndex((x) => x.id === res.id);
    if (idx >= 0) q[idx] = res;
    saveQueue(q);
  }
}

export function initOfflineSync() {
  if (typeof window === "undefined") return;
  const trySync = () => {
    if (!navigator.onLine) return;
    processQueueOnce().catch((e) => console.error("offline: sync error", e));
  };
  // try immediately
  setTimeout(trySync, 200);
  window.addEventListener("online", trySync);
  console.debug("offline: initOfflineSync registered");
}

export default {
  enqueueOperation,
  processQueueOnce,
  initOfflineSync,
  getQueue,
  clearQueue,
};
