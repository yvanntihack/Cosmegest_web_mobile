import Dexie from "dexie";

export type OfflineOp = {
  id: string;
  type: string;
  payload: any;
  createdAt: number;
  status: "pending" | "syncing" | "synced" | "failed";
  result?: any;
  error?: string;
};

class AppDB extends Dexie {
  queue!: Dexie.Table<OfflineOp, string>;
  map!: Dexie.Table<{ tempId: string; realId: string }, string>;

  constructor() {
    super("cosmegest_db");
    this.version(1).stores({
      queue: "id, type, status, createdAt",
      map: "tempId",
    });
  }
}

export const db = new AppDB();

export async function getAllQueue(): Promise<OfflineOp[]> {
  return db.queue.orderBy("createdAt").toArray();
}

export async function addQueueOp(op: OfflineOp) {
  return db.queue.put(op);
}

export async function updateQueueOp(op: OfflineOp) {
  return db.queue.put(op);
}

export async function clearQueue() {
  return db.queue.clear();
}

export async function getMap(): Promise<Record<string, string>> {
  const rows = await db.map.toArray();
  const out: Record<string, string> = {};
  for (const r of rows) out[r.tempId] = r.realId;
  return out;
}

export async function setMapping(tempId: string, realId: string) {
  return db.map.put({ tempId, realId });
}

// Migrate existing localStorage queue/map into IndexedDB (one-time)
export async function migrateFromLocalStorage(localQueueKey = "offline:queue_v1", localMapKey = "offline:map_v1") {
  try {
    const rawQ = localStorage.getItem(localQueueKey);
    const rawM = localStorage.getItem(localMapKey);
    if (rawQ) {
      const q = JSON.parse(rawQ) as OfflineOp[];
      await db.transaction("rw", db.queue, async () => {
        for (const op of q) await db.queue.put(op);
      });
      localStorage.removeItem(localQueueKey);
    }
    if (rawM) {
      const m = JSON.parse(rawM) as Record<string, string>;
      await db.transaction("rw", db.map, async () => {
        for (const t of Object.keys(m)) await db.map.put({ tempId: t, realId: m[t] });
      });
      localStorage.removeItem(localMapKey);
    }
  } catch (e) {
    console.warn("db:migrate failed", e);
  }
}

export default db;
