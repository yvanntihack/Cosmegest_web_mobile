import { Package, ReceiptText, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useDashboardStats } from "../hooks/useDashboard";

const formatCurrency = (amount: number) => `${amount.toFixed(0)} FCFA`;

const periodOptions = [
  { label: "7 jours", value: 7 },
  { label: "30 jours", value: 30 },
  { label: "90 jours", value: 90 },
];

const statusOptions = [
  { label: "Tous statuts", value: "all" },
  { label: "Payees", value: "payee" },
  { label: "Emises", value: "emise" },
  { label: "Brouillons", value: "brouillon" },
];

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);
const getMonthKey = (date: Date) => date.toISOString().slice(0, 7);

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const [periodDays, setPeriodDays] = useState(7);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()));

  const performance = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: periodDays }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (periodDays - 1 - index));
      return {
        key: getDateKey(date),
        label: date.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: periodDays > 7 ? "2-digit" : undefined,
          weekday: periodDays === 7 ? "short" : undefined,
        }),
        total: 0,
        count: 0,
      };
    });

    const byDay = new Map(days.map((day) => [day.key, day]));

    for (const invoice of stats?.sales ?? []) {
      if (statusFilter !== "all" && invoice.status !== statusFilter) continue;

      const invoiceDate = String(invoice.invoice_date ?? invoice.created_at ?? "").slice(0, 10);
      const day = byDay.get(invoiceDate);
      if (!day) continue;

      day.total += Number(invoice.total_amount) || 0;
      day.count += 1;
    }

    const maxTotal = Math.max(...days.map((day) => day.total), 0);
    return { days, maxTotal };
  }, [periodDays, stats?.sales, statusFilter]);

  const monthlyInsights = useMemo(() => {
    const customers = new Map<
      string,
      {
        id: string;
        name: string;
        segment: string;
        amount: number;
        quantity: number;
        invoices: Set<string>;
        products: Map<string, { name: string; quantity: number; amount: number }>;
      }
    >();
    const products = new Map<string, { id: string; reference: string; name: string; quantity: number; amount: number; customers: Set<string> }>();

    for (const line of stats?.purchases ?? []) {
      const invoice = line.invoices;
      const product = line.products;
      const invoiceDate = String(invoice?.invoice_date ?? "").slice(0, 7);

      if (!invoice || !product || invoiceDate !== selectedMonth || invoice.status === "annulee") continue;

      const customerId = invoice.customer_id ?? invoice.customers?.id ?? "unknown";
      const customerName = invoice.customers?.name ?? "Client non renseigne";
      const quantity = Number(line.quantity) || 0;
      const amount = Number(line.total_price) || quantity * (Number(line.unit_price) || 0);

      if (!customers.has(customerId)) {
        customers.set(customerId, {
          id: customerId,
          name: customerName,
          segment: invoice.customers?.segment ?? "particulier",
          amount: 0,
          quantity: 0,
          invoices: new Set<string>(),
          products: new Map<string, { name: string; quantity: number; amount: number }>(),
        });
      }

      const customer = customers.get(customerId)!;
      customer.amount += amount;
      customer.quantity += quantity;
      customer.invoices.add(invoice.id);

      const customerProduct = customer.products.get(product.id) ?? {
        name: product.name,
        quantity: 0,
        amount: 0,
      };
      customerProduct.quantity += quantity;
      customerProduct.amount += amount;
      customer.products.set(product.id, customerProduct);

      const productStats = products.get(product.id) ?? {
        id: product.id,
        reference: product.reference ?? "",
        name: product.name,
        quantity: 0,
        amount: 0,
        customers: new Set<string>(),
      };
      productStats.quantity += quantity;
      productStats.amount += amount;
      productStats.customers.add(customerId);
      products.set(product.id, productStats);
    }

    const topProducts = [...products.values()].sort((a, b) => b.quantity - a.quantity || b.amount - a.amount);
    const topCustomers = [...customers.values()]
      .map((customer) => {
        const favoriteProduct = [...customer.products.values()].sort(
          (a, b) => b.quantity - a.quantity || b.amount - a.amount,
        )[0];
        const suggestedProduct =
          topProducts.find((product) => !customer.products.has(product.id)) ?? topProducts[0];

        return {
          ...customer,
          invoiceCount: customer.invoices.size,
          favoriteProduct,
          suggestedProduct,
        };
      })
      .sort((a, b) => b.amount - a.amount || b.quantity - a.quantity);

    const totalProductQuantity = topProducts.reduce((sum, product) => sum + product.quantity, 0);
    const totalProductRevenue = topProducts.reduce((sum, product) => sum + product.amount, 0);
    const bestProduct = topProducts[0];

    return { bestProduct, topCustomers, topProducts, totalProductQuantity, totalProductRevenue };
  }, [selectedMonth, stats?.purchases]);

  const topClientsAll = useMemo(() => {
    const map = new Map<string, { id: string; name: string; amount: number; count: number }>();
    for (const line of stats?.purchases ?? []) {
      const inv = line.invoices;
      if (!inv) continue;
      const id = inv.customer_id ?? inv.customers?.id ?? "unknown";
      const name = inv.customers?.name ?? "Client non renseigne";
      const amt = Number(line.total_price) || (Number(line.quantity) * (Number(line.unit_price) || 0)) || 0;
      if (!map.has(id)) map.set(id, { id, name, amount: 0, count: 0 });
      const entry = map.get(id)!;
      entry.amount += amt;
      entry.count += 1;
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [stats?.purchases]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Vue d'ensemble</p>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-description">
            Une lecture rapide de l'activite commerciale et des operations a suivre.
          </p>
        </div>
      </div>

      <section className="data-card daily-summary">
        <div className="table-toolbar">
          <div>
            <p className="panel-title">Point du jour</p>
            <p>Récapitulatif des ventes et produits pour la journée</p>
          </div>
        </div>

        <div className="daily-grid">
          <div className="daily-metrics">
            <div className="metric">
              <span className="metric-label">CA aujourd'hui</span>
              <strong className="metric-value">
                {formatCurrency(
                  (stats?.sales ?? [])
                    .filter((s) => String(s.invoice_date ?? s.created_at ?? "").slice(0, 10) === new Date().toISOString().slice(0, 10))
                    .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0),
                )}
              </strong>
            </div>
            <div className="metric">
              <span className="metric-label">Factures</span>
              <strong className="metric-value">
                {(stats?.sales ?? []).filter((s) => String(s.invoice_date ?? s.created_at ?? "").slice(0, 10) === new Date().toISOString().slice(0, 10)).length}
              </strong>
            </div>
            <div className="metric">
              <span className="metric-label">Clients uniques</span>
              <strong className="metric-value">
                {(() => {
                  const set = new Set<string>();
                  for (const p of stats?.purchases ?? []) {
                    const invDate = String(p.invoices?.invoice_date ?? "").slice(0, 10);
                    if (invDate !== new Date().toISOString().slice(0, 10)) continue;
                    const cid = p.invoices?.customers?.id ?? p.invoices?.customer_id ?? "";
                    if (cid) set.add(String(cid));
                  }
                  return set.size;
                })()}
              </strong>
            </div>
            <div className="metric">
              <span className="metric-label">Ticket moyen</span>
              <strong className="metric-value">
                {(() => {
                  const todays = (stats?.sales ?? []).filter((s) => String(s.invoice_date ?? s.created_at ?? "").slice(0, 10) === new Date().toISOString().slice(0, 10));
                  const total = todays.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
                  return todays.length ? formatCurrency(total / todays.length) : formatCurrency(0);
                })()}
              </strong>
            </div>
          </div>

          <div className="daily-products">
            <p className="panel-title">Produits vendus aujourd'hui</p>
            <div className="product-list">
              {(() => {
                const map = new Map<string, { name: string; qty: number; amount: number }>();
                for (const p of stats?.purchases ?? []) {
                  const invDate = String(p.invoices?.invoice_date ?? "").slice(0, 10);
                  if (invDate !== new Date().toISOString().slice(0, 10)) continue;
                  const prod = p.products;
                  if (!prod) continue;
                  const entry = map.get(prod.id) ?? { name: prod.name, qty: 0, amount: 0 };
                  const qty = Number(p.quantity) || 0;
                  const amt = Number(p.total_price) || qty * (Number(p.unit_price) || 0);
                  entry.qty += qty;
                  entry.amount += amt;
                  map.set(prod.id, entry);
                }
                const arr = [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.qty - a.qty || b.amount - a.amount);
                if (!arr.length) return <div className="empty-state">Aucun produit vendu aujourd'hui.</div>;
                return arr.slice(0, 6).map((p) => (
                  <div key={p.id} className="product-item">
                    <div>
                      <strong>{p.name}</strong>
                      <div className="table-subtext">{p.qty} unité(s) — {formatCurrency(p.amount)}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <p className="stat-label">Chiffre d'affaires</p>
            <p className="stat-value">{isLoading ? "--" : formatCurrency(stats?.revenue ?? 0)}</p>
            <p className="stat-note">{stats?.invoices ?? 0} facture(s) enregistree(s)</p>
          </div>
          <div className="stat-icon">
            <ReceiptText size={22} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="stat-label">Ventes aujourd'hui</p>
            <p className="stat-value">
              {isLoading
                ? "--"
                : formatCurrency(
                    (stats?.sales ?? [])
                      .filter((s) => String(s.invoice_date ?? s.created_at ?? "").slice(0, 10) === new Date().toISOString().slice(0, 10))
                      .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0),
                  )}
            </p>
            <p className="stat-note">
              {isLoading
                ? "--"
                : (stats?.sales ?? []).filter((s) => String(s.invoice_date ?? s.created_at ?? "").slice(0, 10) === new Date().toISOString().slice(0, 10)).length +
                  " facture(s)"
              }
            </p>
          </div>
          <div className="stat-icon">
            <ReceiptText size={22} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="stat-label">Produits actifs</p>
            <p className="stat-value">{stats?.products ?? "--"}</p>
            <p className="stat-note">Catalogue disponible</p>
          </div>
          <div className="stat-icon">
            <Package size={22} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="stat-label">Clients</p>
            <p className="stat-value">{stats?.customers ?? "--"}</p>
            <p className="stat-note">Contacts en base</p>
          </div>
          <div className="stat-icon">
            <Users size={22} />
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="data-card best-clients">
          <div className="table-toolbar">
            <div>
              <p className="panel-title">Meilleurs clients</p>
              <p>Top 5 par montant</p>
            </div>
          </div>
          <div className="client-table-wrap">
            {topClientsAll.length === 0 ? (
              <div className="empty-state">Aucun client pour le moment.</div>
            ) : (
              <table className="client-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Factures</th>
                    <th className="col-amount">Montant</th>
                    <th className="col-action" />
                  </tr>
                </thead>
                <tbody>
                  {topClientsAll.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="client-name">{c.name}</div>
                      </td>
                      <td className="col-count">{c.count}</td>
                      <td className="col-amount">{formatCurrency(c.amount)}</td>
                      <td className="col-action">
                        <a className="view-button" href="/customers">Voir</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
        <section className="activity-panel">
          <div className="activity-panel-header">
            <div>
              <p className="panel-title">Performance hebdomadaire</p>
              <p className="panel-copy">
                {performance.days.reduce((sum, day) => sum + day.count, 0)} facture(s),{" "}
                {formatCurrency(performance.days.reduce((sum, day) => sum + day.total, 0))}
              </p>
            </div>
            <div className="dashboard-filters">
              <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}>
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mini-bars">
            {performance.days.map((day) => (
              <div key={day.key} className="mini-bar-item">
                <span className="mini-bar-value">{day.total > 0 ? formatCurrency(day.total) : ""}</span>
                <div
                  className="mini-bar"
                  style={{
                    height: performance.maxTotal > 0 ? `${Math.max((day.total / performance.maxTotal) * 100, 10)}%` : "10%",
                    opacity: day.total > 0 ? 1 : 0.28,
                  }}
                />
                <span className="mini-bar-label">{day.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="data-card insight-section">
        <div className="table-toolbar">
          <div>
            <p className="panel-title">Suivi clients et produits achetes</p>
            <p>{monthlyInsights.topCustomers.length} client(s), {monthlyInsights.topProducts.length} produit(s)</p>
          </div>
          <div className="dashboard-filters">
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              aria-label="Mois du suivi commercial"
            />
          </div>
        </div>

        <div className="insight-grid">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Achats</th>
                  <th>Produit le plus achete</th>
                  <th>A proposer</th>
                </tr>
              </thead>
              <tbody>
                {monthlyInsights.topCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <span className="strong-cell">{customer.name}</span>
                      <span className="table-subtext">{customer.segment}</span>
                    </td>
                    <td>
                      <span className="strong-cell">{formatCurrency(customer.amount)}</span>
                      <span className="table-subtext">{customer.quantity} article(s), {customer.invoiceCount} facture(s)</span>
                    </td>
                    <td>
                      <span className="strong-cell">{customer.favoriteProduct?.name ?? "N/A"}</span>
                      <span className="table-subtext">{customer.favoriteProduct?.quantity ?? 0} unite(s)</span>
                    </td>
                    <td>
                      <span className="badge">{customer.suggestedProduct?.name ?? "A definir"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!monthlyInsights.topCustomers.length && <div className="empty-state">Aucun achat pour ce mois.</div>}
          </div>

          <div className="product-insights">
            <div>
              <p className="panel-title">Produits les plus achetes</p>
              <p className="panel-copy">Classement par quantite vendue sur le mois.</p>
            </div>
            <div className="product-stat-grid">
              <div className="product-stat">
                <span>Top produit</span>
                <strong>{monthlyInsights.bestProduct?.name ?? "--"}</strong>
              </div>
              <div className="product-stat">
                <span>Unites vendues</span>
                <strong>{monthlyInsights.totalProductQuantity}</strong>
              </div>
              <div className="product-stat">
                <span>CA produits</span>
                <strong>{formatCurrency(monthlyInsights.totalProductRevenue)}</strong>
              </div>
            </div>
            <div className="product-rank-list">
              {monthlyInsights.topProducts.slice(0, 6).map((product, index) => (
                <div className="product-rank-item" key={product.id}>
                  <span className="rank-number">{index + 1}</span>
                  <div>
                    <p>{product.name}</p>
                    <span>
                      {product.quantity} unite(s), {product.customers.size} client(s), {formatCurrency(product.amount)}
                    </span>
                  </div>
                </div>
              ))}
              {!monthlyInsights.topProducts.length && <div className="empty-state compact">Aucun produit achete.</div>}
            </div>
          </div>
        </div>

        <div className="table-wrap product-sales-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Reference</th>
                <th>Quantite vendue</th>
                <th>Chiffre d'affaires</th>
                <th>Clients</th>
                <th>Part des ventes</th>
              </tr>
            </thead>
            <tbody>
              {monthlyInsights.topProducts.map((product) => {
                const salesShare =
                  monthlyInsights.totalProductRevenue > 0
                    ? (product.amount / monthlyInsights.totalProductRevenue) * 100
                    : 0;

                return (
                  <tr key={product.id}>
                    <td className="strong-cell">{product.name}</td>
                    <td>{product.reference || "N/A"}</td>
                    <td>{product.quantity}</td>
                    <td className="strong-cell">{formatCurrency(product.amount)}</td>
                    <td>{product.customers.size}</td>
                    <td>
                      <div className="share-meter" aria-label={`${salesShare.toFixed(0)}% des ventes`}>
                        <span style={{ width: `${salesShare}%` }} />
                      </div>
                      <span className="table-subtext">{salesShare.toFixed(0)}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!monthlyInsights.topProducts.length && <div className="empty-state">Aucune vente produit pour ce mois.</div>}
        </div>
      </section>
    </div>
  );
}
