import { useEffect, useState } from "react";
import { getQueue, processQueueOnce, clearQueue } from "../lib/offline";

function fmtDate(ts: number) {
  try {
    return new Date(ts).toLocaleString("fr-FR");
  } catch {
    return String(ts);
  }
}

export default function OfflineQueuePanel() {
  const [queue, setQueue] = useState(() => getQueue());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onOnline = () => setQueue(getQueue());
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const refresh = () => setQueue(getQueue());

  const handleResync = async () => {
    setSyncing(true);
    try {
      await processQueueOnce();
      refresh();
    } catch (e) {
      console.error("offline: resync error", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleClear = () => {
    if (!confirm("Purger la file offline ?")) return;
    clearQueue();
    refresh();
  };

  return (
    <section className="data-card">
      <div className="table-toolbar">
        <div>
          <p className="panel-title">File offline</p>
          <p className="panel-copy">Opérations en attente de synchronisation</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary-button" onClick={refresh} disabled={syncing}>
            Rafraîchir
          </button>
          <button className="primary-button" onClick={handleResync} disabled={syncing || !navigator.onLine}>
            {syncing ? "Synchronisation..." : "Resync"}
          </button>
          <button className="ghost-button" onClick={handleClear}>
            Purger
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {queue.length === 0 ? (
          <div className="empty-state">Aucune opération en attente.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {queue.map((op) => (
              <div key={op.id} style={{ padding: 10, borderRadius: 8, background: "#fff", border: "1px solid #eef2f7" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <strong>{op.type}</strong>
                    <div className="table-subtext">{fmtDate(op.createdAt)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>{op.status}</div>
                    {op.error && <div className="table-subtext" style={{ color: "#c2410c" }}>{op.error}</div>}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(op.payload)}</pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
