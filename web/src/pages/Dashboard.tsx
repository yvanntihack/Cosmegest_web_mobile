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
