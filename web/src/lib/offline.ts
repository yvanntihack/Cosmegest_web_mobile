import { supabase } from "./supabase";
import db, { type OfflineOp, getAllQueue, addQueueOp, updateQueueOp, getMap as dbGetMap, setMapping as dbSetMapping, migrateFromLocalStorage } from "./db";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getQueue() {
  return await getAllQueue();
}

export async function clearQueue() {
  return await db.queue.clear();
}

export async function enqueueOperation(type: string, payload: any) {
  const op: OfflineOp = {
    id: makeId(),
    type,
    payload,
    createdAt: Date.now(),
    status: "pending",
  };
  await addQueueOp(op);
  console.debug("offline: enqueued", op);
  return op.id;
}

async function loadMap(): Promise<Record<string, string>> {
  return await dbGetMap();
}

async function setMapping(tempId: string, realId: string) {
  return await dbSetMapping(tempId, realId);
}

export async function getMap() {
  return await loadMap();
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
  const q = await getAllQueue();
  if (!q.length) return;
  console.debug("offline: processing queue", q.length);
  for (const item of q) {
    if (item.status === "synced") continue;
    // Resolve any temp ids in payload using map
    const map = await loadMap();
    if (Object.keys(map).length) {
      try {
        item.payload = resolveTempIdsInObject(item.payload, map);
      } catch (e) {
        console.warn("offline: failed to resolve temp ids", e);
      }
    }

    item.status = "syncing";
    await updateQueueOp(item);
    const res = await processOp(item);
    // if we created a customer and have a real id, add mapping from op.id -> real id
    try {
      if (item.type === "create_customer" && res.result && res.result.id) {
        await setMapping(item.id, String(res.result.id));
        // after mapping, try to replace other queued payloads
        const updatedMap = await loadMap();
        for (const other of q) {
          if (other.id === item.id) continue;
          other.payload = resolveTempIdsInObject(other.payload, updatedMap);
          await updateQueueOp(other);
        }
      }
    } catch (e) {
      console.warn("offline: set mapping failed", e);
    }

    // update queue entry
    await updateQueueOp(res);
  }
}

export function initOfflineSync() {
  if (typeof window === "undefined") return;
  // migrate any legacy localStorage queue into IndexedDB
  migrateFromLocalStorage().catch((e) => console.debug("offline: migrate skipped/fail", e));
  const trySync = () => {
    if (!navigator.onLine) return;
    processQueueOnce().catch((e) => console.error("offline: sync error", e));
  };
  // try immediately
  setTimeout(trySync, 200);
  window.addEventListener("online", trySync);
  console.debug("offline: initOfflineSync registered");
}

export async function retryOperation(opId: string) {
  try {
    const op = await db.queue.get(opId);
    if (!op) throw new Error("Op not found");
    // resolve map
    const map = await loadMap();
    op.payload = resolveTempIdsInObject(op.payload, map);
    op.status = "syncing";
    await updateQueueOp(op);
    const res = await processOp(op);
    if (op.type === "create_customer" && res.result && res.result.id) {
      await setMapping(op.id, String(res.result.id));
    }
    await updateQueueOp(res);
    return res;
  } catch (e) {
    console.error("offline: retry failed", e);
    throw e;
  }
}

export async function migrateLocalToDB() {
  return migrateFromLocalStorage();
}

export default {
  enqueueOperation,
  processQueueOnce,
  initOfflineSync,
  getQueue,
  clearQueue,
};
