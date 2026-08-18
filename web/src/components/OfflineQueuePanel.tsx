import { useEffect, useState } from "react";
import { getQueue, processQueueOnce, clearQueue, retryOperation, getMap, migrateLocalToDB } from "../lib/offline";

function fmtDate(ts: number) {
  try {
    return new Date(ts).toLocaleString("fr-FR");
  } catch {
    return String(ts);
  }
}

export default function OfflineQueuePanel() {
  const [queue, setQueue] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onOnline = async () => {
      const q = await getQueue();
      setQueue(q);
    };
    window.addEventListener("online", onOnline);
    // initial load
    (async () => setQueue(await getQueue()))();
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const refresh = async () => setQueue(await getQueue());

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

  const handleMigrate = async () => {
    setSyncing(true);
    try {
      await migrateLocalToDB();
      await refresh();
      alert("Migration depuis localStorage effectuee.");
    } catch (e) {
      console.error("offline: migrate error", e);
      alert("Migration a echoue. Voir la console.");
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
                    <div style={{ marginTop: 8 }}>
                      <button className="secondary-button" onClick={async () => { try { await retryOperation(op.id); await refresh(); } catch (e) { alert('Retry failed'); } }} disabled={syncing || !navigator.onLine}>Retry</button>
                    </div>
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
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="panel-title">Mappings tempId → realId</p>
            <p className="panel-copy">Mappings automatiques crees lors de la synchronisation.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="secondary-button" onClick={handleMigrate} disabled={syncing}>Migrer localStorage</button>
          </div>
        </div>
        <MappingList />
      </div>
    </section>
  );
}

function MappingList() {
  const [map, setMap] = useState<Record<string,string>>({});
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const m = await getMap();
        if (mounted) setMap(m);
      } catch (e) {
        if (mounted) setMap({});
      }
    })();
    return () => { mounted = false; };
  }, []);

  const entries = Object.entries(map);
  if (!entries.length) return <div className="empty-state">Aucun mapping present.</div>;
  return (
    <div style={{ marginTop: 8 }}>
      <table className="data-table">
        <thead>
          <tr><th>TempId</th><th>RealId</th></tr>
        </thead>
        <tbody>
          {entries.map(([t, r]) => (
            <tr key={t}><td style={{fontFamily: 'monospace'}}>{t}</td><td style={{fontFamily: 'monospace'}}>{r}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
