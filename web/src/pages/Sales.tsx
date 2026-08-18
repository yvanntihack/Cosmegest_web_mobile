import { FileText, Pencil, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { enqueueOperation } from "../lib/offline";
import FilterBar from "../components/FilterBar";
import type { FormEvent } from "react";
import { useCustomers } from "../hooks/useCustomers";
import { useCreateInvoice, useInvoices, useUpdateInvoice } from "../hooks/useInvoices";
import { useProducts } from "../hooks/useProducts";

interface DraftLine {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

const emptyLine = (): DraftLine => ({
  id: crypto.randomUUID(),
  productId: "",
  quantity: 1,
  unitPrice: 0,
});

const today = () => new Date().toISOString().slice(0, 10);

const formatCurrency = (amount: number) => `${amount.toFixed(0)} FCFA`;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export default function Sales() {
  const { data: invoices, isLoading } = useInvoices();
  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [status, setStatus] = useState("emise");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [formError, setFormError] = useState("");
  const [showOnlyToday, setShowOnlyToday] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const totalAmount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines],
  );

  const resetForm = () => {
    setEditingInvoiceId(null);
    setCurrentInvoiceNumber("");
    setCustomerId("");
    setInvoiceDate(today());
    setStatus("emise");
    setLines([emptyLine()]);
    setFormError("");
  };

  type InvoiceLine = {
    product_id?: string;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    total_price?: number | string | null;
    products?: { name?: string } | null;
  };

  type Invoice = {
    id: string;
    invoice_number?: string;
    customer_id?: string | null;
    customers?: { name?: string } | null;
    invoice_date?: string | null;
    created_at?: string | null;
    status?: string | null;
    total_amount?: number | string | null;
    invoice_lines?: InvoiceLine[];
  };

  const startEdit = (invoice: Invoice) => {
    setEditingInvoiceId(invoice.id);
    setCurrentInvoiceNumber(invoice.invoice_number ?? "");
    setCustomerId(invoice.customer_id ?? "");
    setInvoiceDate(invoice.invoice_date ?? today());
    setStatus(invoice.status ?? "emise");
    setFormError("");
    setLines(
      invoice.invoice_lines?.length
        ? invoice.invoice_lines!.map((line: InvoiceLine) => ({
            id: crypto.randomUUID(),
            productId: line.product_id ?? "",
            quantity: Number(line.quantity) || 1,
            unitPrice: Number(line.unit_price) || 0,
          }))
        : [emptyLine()],
    );
    setShowForm(true);
  };

  const updateLine = (id: string, updates: Partial<DraftLine>) => {
    setLines((currentLines) =>
      currentLines.map((line) => (line.id === id ? { ...line, ...updates } : line)),
    );
  };

  const handleProductChange = (lineId: string, productId: string) => {
    const product = products?.find((item) => item.id === productId);
    updateLine(lineId, {
      productId,
      unitPrice: product?.selling_price ?? 0,
    });
  };

  const removeLine = (id: string) => {
    setLines((currentLines) =>
      currentLines.length === 1 ? currentLines : currentLines.filter((line) => line.id !== id),
    );
  };

  const exportInvoicePdf = (invoice: Invoice) => {
    const printableWindow = window.open("", "_blank", "width=900,height=700");
    if (!printableWindow) return;

    const invoiceLines = (invoice.invoice_lines ?? []) as InvoiceLine[];
    const rows = invoiceLines
      .map((line: InvoiceLine) => {
        const quantity = Number(line.quantity) || 0;
        const unitPrice = Number(line.unit_price) || 0;
        const totalPrice = Number(line.total_price) || quantity * unitPrice;

        return `
          <tr>
            <td>${escapeHtml(line.products?.name || "Produit")}</td>
            <td class="numeric">${quantity}</td>
            <td class="numeric">${formatCurrency(unitPrice)}</td>
            <td class="numeric strong">${formatCurrency(totalPrice)}</td>
          </tr>
        `;
      })
      .join("");

    printableWindow.document.write(`
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Facture ${escapeHtml(invoice.invoice_number)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              color: #172033;
              font-family: Arial, sans-serif;
              background: #f8fafc;
            }
            .invoice-sheet {
              max-width: 820px;
              margin: 0 auto;
              padding: 36px;
              background: #ffffff;
              border: 1px solid #e2e8f0;
            }
            .header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              padding-bottom: 24px;
              border-bottom: 3px solid #0e7490;
            }
            .brand h1 {
              margin: 0;
              color: #0f172a;
              font-size: 28px;
            }
            .brand p,
            .meta p,
            .customer p {
              margin: 4px 0;
              color: #64748b;
              font-size: 13px;
            }
            .meta h2 {
              margin: 0 0 10px;
              color: #0e7490;
              font-size: 22px;
              letter-spacing: 0.04em;
              text-transform: uppercase;
            }
            .section {
              margin-top: 26px;
            }
            .section-title {
              margin: 0 0 10px;
              color: #0f172a;
              font-size: 14px;
              letter-spacing: 0.06em;
              text-transform: uppercase;
            }
            .customer {
              width: 52%;
              padding: 16px;
              border-radius: 8px;
              background: #f8fafc;
            }
            .customer strong {
              display: block;
              color: #0f172a;
              font-size: 18px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 18px;
            }
            .info-table th {
              width: 42%;
              color: #334155;
              background: #f8fafc;
              text-align: left;
              text-transform: none;
            }
            .info-table td {
              color: #0f172a;
              font-weight: 700;
            }
            th {
              padding: 12px;
              color: #475569;
              background: #f1f5f9;
              border-bottom: 1px solid #cbd5e1;
              font-size: 12px;
              text-align: left;
              text-transform: uppercase;
            }
            td {
              padding: 14px 12px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 14px;
            }
            .numeric {
              text-align: right;
            }
            .strong {
              color: #0f172a;
              font-weight: 700;
            }
            .total {
              display: flex;
              justify-content: flex-end;
              margin-top: 22px;
            }
            .total-box {
              min-width: 280px;
              padding: 18px;
              color: #ffffff;
              background: #0e7490;
              border-radius: 8px;
            }
            .total-box span {
              display: block;
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              opacity: 0.85;
            }
            .total-box strong {
              display: block;
              margin-top: 6px;
              font-size: 28px;
            }
            .footer {
              margin-top: 34px;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
              color: #64748b;
              font-size: 12px;
              text-align: center;
            }
            @media print {
              body { padding: 0; background: #ffffff; }
              .invoice-sheet { border: 0; max-width: none; }
              @page { margin: 14mm; }
            }
          </style>
        </head>
        <body>
          <main class="invoice-sheet">
            <header class="header">
              <div class="brand">
                <h1>CosmeGest</h1>
                <p>Gestion cosmetique</p>
                <p>Facture de vente</p>
              </div>
              <div>
                <h2>Facture</h2>
                <p><strong>${escapeHtml(invoice.invoice_number)}</strong></p>
              </div>
            </header>

            <section class="section info-grid">
              <div>
                <p class="section-title">Informations facture</p>
                <table class="info-table">
                  <tbody>
                    <tr>
                          <th>Numero</th>
                          <td>${escapeHtml(invoice.invoice_number)}</td>
                        </tr>
                        <tr>
                          <th>Date</th>
                          <td>${invoice.invoice_date ? new Date(String(invoice.invoice_date)).toLocaleDateString("fr-FR") : ""}</td>
                        </tr>
                    <tr>
                      <th>Statut</th>
                      <td>${escapeHtml(invoice.status)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <p class="section-title">Informations client</p>
                <table class="info-table">
                  <tbody>
                    <tr>
                      <th>Client</th>
                      <td>${escapeHtml(invoice.customers?.name || "Client non renseigne")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="section">
              <p class="section-title">Details</p>
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th class="numeric">Quantite</th>
                    <th class="numeric">Prix unitaire</th>
                    <th class="numeric">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="4">Aucune ligne de facture.</td></tr>'}
                </tbody>
              </table>
            </section>

            <section class="total">
              <div class="total-box">
                <span>Total facture</span>
                <strong>${formatCurrency(Number(invoice.total_amount) || 0)}</strong>
              </div>
            </section>

            <footer class="footer">
              Merci pour votre confiance.
            </footer>
          </main>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printableWindow.document.close();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError("");

    const validLines = lines.filter((line) => line.productId && line.quantity > 0);
    if (!customerId) {
      setFormError("Selectionnez un client avant d'enregistrer la facture.");
      return;
    }

    if (validLines.length === 0) {
      setFormError("Ajoutez au moins un produit a la facture.");
      return;
    }

    const invoiceTotal = validLines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0,
    );

    const payload = {
      header: {
        invoice_number: currentInvoiceNumber || undefined,
        customer_id: customerId,
        invoice_date: invoiceDate,
        status,
        // keep backward-compatible single string and provide array
        payment_method: paymentMethods.length ? paymentMethods.join(",") : undefined,
        payment_methods: paymentMethods.length ? paymentMethods : undefined,
        total_amount: invoiceTotal,
      },
      lines: validLines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        total_price: line.quantity * line.unitPrice,
      })),
    };

    const options = {
      onSuccess: () => {
        resetForm();
        setShowForm(false);
      },
      onError: (error: Error) => {
        setFormError(error.message || "Impossible d'enregistrer la facture.");
      },
    };

    if (!navigator.onLine) {
      if (editingInvoiceId) {
        setFormError("Modification hors-ligne non supportee. Connectez-vous puis reessayez.");
        return;
      }
      // Enqueue create invoice operation for later sync
      enqueueOperation("create_invoice", payload);
      options.onSuccess();
      return;
    }

    if (editingInvoiceId) {
      updateInvoice.mutate({ id: editingInvoiceId, ...payload }, options);
    } else {
      createInvoice.mutate(payload, options);
    }
  };

  // Render loading UI inside main JSX to avoid conditional hook calls

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysInvoices = (invoices ?? []).filter((inv: Invoice) => String(inv.invoice_date ?? inv.created_at ?? "").slice(0, 10) === todayKey);

  const filteredBaseInvoices = useMemo(() => {
    const base = showOnlyToday ? todaysInvoices : invoices ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((inv: Invoice) => {
      const hay = [inv.invoice_number, inv.customers?.name, String(inv.total_amount), inv.status].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [invoices, todaysInvoices, showOnlyToday, search]);

  // Determine product type (Grossiste / Détaillant) by grouping similar names
  const productTypes = useMemo(() => {
    const list = products ?? [];
    const groups: Record<string, typeof list> = {};
    list.forEach((p) => {
      const base = String(p.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, "")
        .replace(/\s+\d+$/, "")
        .trim();
      const key = base || p.name;
      groups[key] = groups[key] || [];
      groups[key].push(p);
    });
    const map: Record<string, string> = {};
    Object.values(groups).forEach((items) => {
      const prices = items.map((it) => Number(it.selling_price || 0));
      const min = Math.min(...prices);
      items.forEach((it) => {
        map[it.id] = Number(it.selling_price || 0) === min ? "Grossiste" : "Détaillant";
      });
    });
    return map;
  }, [products]);

  const productsForSelect = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products ?? [];
    return (products ?? []).filter((p) => {
      return [p.name, p.reference].join(" ").toLowerCase().includes(q);
    });
  }, [products, productSearch]);

  useEffect(() => {
    try {
      console.debug('Sales: productSearch=', productSearch, 'productsForSelect=', productsForSelect?.length ?? 0);
    } catch (e) {
      // ignore
    }
  }, [productSearch, productsForSelect]);

  try {
  return (
    <div className="page">
      {isLoading && <div className="loading-state">Chargement...</div>}
      <div className="page-header">
        <div>
          <p className="eyebrow">Commercial</p>
          <h1 className="page-title">Ventes</h1>
          <p className="page-description">
            Creez des factures, ajoutez les produits vendus et suivez les montants emis.
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="primary-button">
          <Plus size={18} /> Nouvelle facture
        </button>
      </div>

      {showForm && (
        <section className="invoice-builder">
          <form onSubmit={handleSubmit}>
            <div className="invoice-builder-header">
              <div>
                <p className="eyebrow">{editingInvoiceId ? "Modifier facture" : "Nouvelle facture"}</p>
                <h2>{currentInvoiceNumber || "Details de la vente"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {formError && <p className="form-error">{formError}</p>}

            <div className="invoice-form-grid">
              <div className="field">
                <label>Client</label>
                <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
                  <option value="">Selectionner un client</option>
                  {customers?.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Statut</label>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="brouillon">Brouillon</option>
                  <option value="emise">Emise</option>
                  <option value="payee">Payee</option>
                </select>
              </div>
              <div className="field">
                <label>Mode de paiement</label>
                <div className="payment-options">
                  <label className={`chip ${paymentMethods.includes('wave_mr') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      name="payment"
                      value="wave_mr"
                      checked={paymentMethods.includes('wave_mr')}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPaymentMethods((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
                      }}
                    />
                    Wave Mr
                  </label>

                  <label className={`chip ${paymentMethods.includes('wave_mme') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      name="payment"
                      value="wave_mme"
                      checked={paymentMethods.includes('wave_mme')}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPaymentMethods((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
                      }}
                    />
                    Wave Mme
                  </label>

                  <label className={`chip ${paymentMethods.includes('om_mme') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      name="payment"
                      value="om_mme"
                      checked={paymentMethods.includes('om_mme')}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPaymentMethods((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
                      }}
                    />
                    OM Mme
                  </label>

                  <label className={`chip ${paymentMethods.includes('om_mr') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      name="payment"
                      value="om_mr"
                      checked={paymentMethods.includes('om_mr')}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPaymentMethods((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
                      }}
                    />
                    OM Mr
                  </label>

                  <label className={`chip ${paymentMethods.includes('momo') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      name="payment"
                      value="momo"
                      checked={paymentMethods.includes('momo')}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPaymentMethods((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
                      }}
                    />
                    MoMo
                  </label>

                  <label className={`chip ${paymentMethods.includes('cash') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      name="payment"
                      value="cash"
                      checked={paymentMethods.includes('cash')}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPaymentMethods((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
                      }}
                    />
                    Cash
                  </label>
                </div>
              </div>
            </div>

            <div className="invoice-lines">
              <div className="invoice-lines-header">
                <p className="panel-title">Produits factures</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <FilterBar value={productSearch} onChange={setProductSearch} placeholder="Rechercher produit par nom ou réf" />
                  <button type="button" className="secondary-button" onClick={() => setLines([...lines, emptyLine()])}>
                    <Plus size={16} /> Ligne
                  </button>
                </div>
              </div>

              {lines.map((line) => (
                <div className="invoice-line" key={line.id}>
                  <div className="field invoice-product-field">
                    <label>Produit</label>
                    <select
                      value={line.productId}
                      onChange={(event) => handleProductChange(line.id, event.target.value)}
                      required
                    >
                      <option value="">Selectionner</option>
                      {productsForSelect?.map((product) => {
                        const type = productTypes[product.id];
                        return (
                          <option key={product.id} value={product.id}>
                            {product.reference} - {product.name} {type ? `(${type})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="field">
                    <label>Quantite</label>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Prix</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) })}
                      required
                    />
                  </div>
                  <div className="invoice-line-total">
                    <span>Total ligne</span>
                    <strong>{formatCurrency(line.quantity * line.unitPrice)}</strong>
                  </div>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => removeLine(line.id)}
                    aria-label="Supprimer la ligne"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="invoice-summary">
              <div>
                <span>Total facture</span>
                <strong>{formatCurrency(totalAmount)}</strong>
              </div>
              <button
                type="submit"
                className="success-button"
                disabled={(createInvoice.isPending || updateInvoice.isPending) || !customerId || totalAmount <= 0}
              >
                <ReceiptText size={18} />{" "}
                {createInvoice.isPending || updateInvoice.isPending
                  ? "Enregistrement..."
                  : editingInvoiceId
                    ? "Modifier la facture"
                    : "Enregistrer la facture"}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="data-card">
          <div className="table-toolbar">
          <div>
            <p className="panel-title">Factures recentes</p>
            <p>{invoices?.length ?? 0} facture(s) enregistree(s)</p>
          </div>
          <div className="dashboard-filters">
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <FilterBar value={search} onChange={setSearch} placeholder="Rechercher factures, client ou status" />
            </div>
            <label style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <input type="checkbox" checked={showOnlyToday} onChange={(e) => setShowOnlyToday(e.target.checked)} />
              Aujourd'hui
            </label>
            <span className="badge">Ventes</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>N Facture</th>
                <th>Client</th>
                <th>Date</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(filteredBaseInvoices as Invoice[]).map((invoice) => (
                <tr key={invoice.id}>
                  <td className="strong-cell">{invoice.invoice_number}</td>
                  <td>{invoice.customers?.name || "N/A"}</td>
                  <td>
                    {(() => {
                      const dt = invoice.invoice_date ?? invoice.created_at;
                      return dt ? new Date(String(dt)).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
                    })()}
                  </td>
                  <td className="strong-cell">{formatCurrency(Number(invoice.total_amount))}</td>
                  <td>
                    <span className={`status-pill status-${invoice.status}`}>{invoice.status}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => startEdit(invoice)}
                        className="secondary-icon-button"
                        aria-label="Modifier la facture"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => exportInvoicePdf(invoice)}
                        className="secondary-icon-button"
                        aria-label="Exporter la facture en PDF"
                        title="Exporter PDF"
                      >
                        <FileText size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!invoices?.length && <div className="empty-state">Aucune facture pour le moment.</div>}
      </div>
    </div>
    );
  } catch (err) {
    console.error("Sales render error:", err);
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <p className="eyebrow">Commercial</p>
            <h1 className="page-title">Ventes</h1>
            <p className="page-description">Une erreur est survenue lors du rendu de la page. Ouvrez la console du navigateur pour plus d'informations.</p>
          </div>
        </div>
        <div className="data-card">
          <div className="empty-state">Erreur de rendu — consultez la console.</div>
        </div>
      </div>
    );
  }
}
