import { Eye, FileText, Plus, Printer, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FormEvent } from "react";
import { useCustomers } from "../hooks/useCustomers";
import { useCreateQuote, useDeleteQuote, useQuotes } from "../hooks/useQuotes";
import type { QuoteData, QuoteLine } from "../hooks/useQuotes";

const today = () => new Date().toISOString().slice(0, 10);

const emptyLine = (): QuoteLine => ({
  id: crypto.randomUUID(),
  label: "",
  quantity: 1,
  unitPrice: 0,
});

const formatCurrency = (amount: number) => `${amount.toFixed(0)} FCFA`;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const lineTotal = (line: QuoteLine) => line.quantity * line.unitPrice;
const blockTotal = (lines: QuoteLine[]) => lines.reduce((sum, line) => sum + lineTotal(line), 0);

export default function Quotes() {
  const { data: customers } = useCustomers();
  const { data: savedQuotes = [], isLoading: quotesLoading } = useQuotes();
  const createQuote = useCreateQuote();
  const deleteQuote = useDeleteQuote();

  const [quoteCreated, setQuoteCreated] = useState(false);
  const [quoteNo, setQuoteNo] = useState("Automatique");
  const [customerId, setCustomerId] = useState("");
  const [quoteDate, setQuoteDate] = useState(today());
  const [buyer, setBuyer] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [structureName, setStructureName] = useState("");
  const [rangeName, setRangeName] = useState("");
  const [productName, setProductName] = useState("");
  const [dominantColors, setDominantColors] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [articles, setArticles] = useState<QuoteLine[]>([emptyLine()]);
  const [containers, setContainers] = useState<QuoteLine[]>([emptyLine()]);
  const [packagingPrints, setPackagingPrints] = useState<QuoteLine[]>([emptyLine()]);
  const [labels, setLabels] = useState<QuoteLine[]>([emptyLine()]);
  const [mockups, setMockups] = useState<QuoteLine[]>([emptyLine()]);
  const [logoPrice, setLogoPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteCustomerFilter, setQuoteCustomerFilter] = useState("");
  const [quoteDateFrom, setQuoteDateFrom] = useState("");
  const [quoteDateTo, setQuoteDateTo] = useState("");
  const [archiveMessage, setArchiveMessage] = useState("");
  const previewRef = useRef<HTMLElement | null>(null);

  const selectedCustomer = customers?.find((customer) => customer.id === customerId);

  const subtotal = useMemo(
    () =>
      blockTotal(articles) +
      blockTotal(containers) +
      blockTotal(packagingPrints) +
      blockTotal(labels) +
      blockTotal(mockups) +
      logoPrice,
    [articles, containers, packagingPrints, labels, mockups, logoPrice],
  );

  const total = Math.max(subtotal - discount, 0);

  const quoteCustomerOptions = useMemo(
    () =>
      Array.from(new Set(savedQuotes.map((quote) => quote.clientName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [savedQuotes],
  );

  const filteredQuotes = useMemo(() => {
    const normalizedSearch = quoteSearch.trim().toLowerCase();

    return savedQuotes.filter((quote) => {
      const quoteDateValue = quote.quoteDate || "";
      const searchableText = [
        quote.number,
        quote.clientName,
        quote.buyer,
        quote.structureName,
        quote.rangeName,
        quote.productName,
        quote.dominantColors,
      ]
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !searchableText.includes(normalizedSearch)) return false;
      if (quoteCustomerFilter && quote.clientName !== quoteCustomerFilter) return false;
      if (quoteDateFrom && quoteDateValue < quoteDateFrom) return false;
      if (quoteDateTo && quoteDateValue > quoteDateTo) return false;

      return true;
    });
  }, [quoteCustomerFilter, quoteDateFrom, quoteDateTo, quoteSearch, savedQuotes]);

  const hasQuoteFilters = Boolean(quoteSearch || quoteCustomerFilter || quoteDateFrom || quoteDateTo);

  const resetQuoteFilters = () => {
    setQuoteSearch("");
    setQuoteCustomerFilter("");
    setQuoteDateFrom("");
    setQuoteDateTo("");
  };

  const handleDeleteQuote = (quote: QuoteData) => {
    if (!quote.id) {
      setArchiveMessage("Impossible de supprimer ce devis: identifiant introuvable.");
      return;
    }

    const confirmed = window.confirm(`Supprimer le devis ${quote.number} ?`);
    if (!confirmed) return;

    deleteQuote.mutate(quote.id, {
      onSuccess: () => {
        setArchiveMessage(`Devis ${quote.number} supprime avec succes.`);
      },
      onError: (error) => {
        setArchiveMessage(error instanceof Error ? error.message : "Impossible de supprimer le devis.");
      },
    });
  };

  const updateLine = (
    setter: Dispatch<SetStateAction<QuoteLine[]>>,
    id: string,
    updates: Partial<QuoteLine>,
  ) => {
    setter((currentLines) =>
      currentLines.map((line) => (line.id === id ? { ...line, ...updates } : line)),
    );
  };

  const removeLine = (setter: Dispatch<SetStateAction<QuoteLine[]>>, id: string) => {
    setter((currentLines) =>
      currentLines.length === 1 ? currentLines : currentLines.filter((line) => line.id !== id),
    );
  };

  const currentQuote: QuoteData = {
    number: quoteNo,
    clientName: selectedCustomer?.name || "",
    quoteDate,
    buyer,
    dueDate,
    structureName,
    rangeName,
    productName,
    dominantColors,
    additionalInfo,
    articles,
    containers,
    packagingPrints,
    labels,
    mockups,
    logoPrice,
    discount,
    subtotal,
    total,
  };

  const handleCreateQuote = (event: FormEvent) => {
    event.preventDefault();
    setQuoteCreated(false);

    if (!customerId) {
      setFormMessage("Selectionnez un client avant de creer le devis.");
      return;
    }

    if (total <= 0) {
      setFormMessage("Ajoutez au moins un prix pour obtenir un total superieur a 0.");
      return;
    }

    createQuote.mutate(
      { ...currentQuote, number: undefined, customerId },
      {
        onSuccess: (createdQuote: any) => {
          const createdNumber = createdQuote.quote_number ?? quoteNo;

          setQuoteNo(createdNumber);
          setQuoteCreated(true);
          setShowPreview(true);
          setFormMessage(`Devis ${createdNumber} cree avec succes dans la base de donnees.`);

          window.setTimeout(() => {
            previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 50);
        },
        onError: (error) => {
          setFormMessage(error instanceof Error ? error.message : "Impossible de creer le devis.");
          setQuoteCreated(false);
        },
      },
    );
  };

  const startNewQuote = () => {
    setQuoteNo("Automatique");
    setCustomerId("");
    setQuoteDate(today());
    setBuyer("");
    setDueDate("");
    setStructureName("");
    setRangeName("");
    setProductName("");
    setDominantColors("");
    setAdditionalInfo("");
    setArticles([emptyLine()]);
    setContainers([emptyLine()]);
    setPackagingPrints([emptyLine()]);
    setLabels([emptyLine()]);
    setMockups([emptyLine()]);
    setLogoPrice(0);
    setDiscount(0);
    setQuoteCreated(false);
    setShowPreview(false);
    setFormMessage("");
  };

  const printQuote = (quote: QuoteData) => {
    const printableWindow = window.open("", "_blank", "width=900,height=720");
    if (!printableWindow) return;

    const renderRows = (title: string, lines: QuoteLine[]) => {
      const rows = lines
        .filter((line) => line.label || line.quantity || line.unitPrice)
        .map(
          (line) => `
            <tr>
              <td>${escapeHtml(title)}</td>
              <td>${escapeHtml(line.label || "-")}</td>
              <td class="numeric">${line.quantity}</td>
              <td class="numeric">${formatCurrency(line.unitPrice)}</td>
              <td class="numeric strong">${formatCurrency(lineTotal(line))}</td>
            </tr>
          `,
        )
        .join("");

      return rows;
    };

    const lineRows = [
      renderRows("Articles", quote.articles),
      renderRows("Contenants", quote.containers),
      renderRows("Impressions etui", quote.packagingPrints),
      renderRows("Etiquettes", quote.labels),
      renderRows("Maquettes", quote.mockups),
      quote.logoPrice
        ? `<tr><td>Logo</td><td>Creation logo</td><td class="numeric">1</td><td class="numeric">${formatCurrency(quote.logoPrice)}</td><td class="numeric strong">${formatCurrency(quote.logoPrice)}</td></tr>`
        : "",
    ].join("");

    printableWindow.document.write(`
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Devis ${escapeHtml(quote.number)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 32px; color: #172033; font-family: Arial, sans-serif; background: #f8fafc; }
            .sheet { max-width: 860px; margin: 0 auto; padding: 36px; background: #fff; border: 1px solid #e2e8f0; }
            .header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 22px; border-bottom: 3px solid #0e7490; }
            h1, h2, p { margin-top: 0; }
            h1 { color: #0f172a; font-size: 30px; }
            h2 { color: #0e7490; font-size: 22px; text-transform: uppercase; }
            .muted { color: #64748b; font-size: 13px; }
            .section { margin-top: 24px; }
            .section-title { margin: 0 0 10px; color: #0f172a; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
            table { width: 100%; border-collapse: collapse; }
            th { padding: 11px; color: #475569; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 12px; text-align: left; text-transform: uppercase; }
            td { padding: 12px 11px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; }
            .info-table th { width: 42%; color: #334155; background: #f8fafc; text-transform: none; }
            .info-table td { color: #0f172a; font-weight: 700; }
            .numeric { text-align: right; }
            .strong { color: #0f172a; font-weight: 700; }
            .summary { display: flex; justify-content: flex-end; margin-top: 22px; }
            .summary table { width: 330px; }
            .summary .total-row th, .summary .total-row td { color: #fff; background: #0e7490; font-size: 18px; }
            .notes { padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; white-space: pre-wrap; }
            .footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center; }
            @media print {
              body { padding: 0; background: #fff; }
              .sheet { max-width: none; border: 0; }
              @page { margin: 14mm; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">
            <header class="header">
              <div>
                <h1>CosmeGest</h1>
                <p class="muted">Devis professionnel cosmetique</p>
              </div>
              <div>
                <h2>Devis</h2>
                <p class="muted"><strong>${escapeHtml(quote.number)}</strong></p>
              </div>
            </header>

            <section class="section info-grid">
              <div>
                <p class="section-title">Informations devis</p>
                <table class="info-table">
                  <tbody>
                    <tr><th>Date</th><td>${new Date(quote.quoteDate).toLocaleDateString("fr-FR")}</td></tr>
                    <tr><th>Echeance prevue</th><td>${quote.dueDate ? new Date(quote.dueDate).toLocaleDateString("fr-FR") : "-"}</td></tr>
                    <tr><th>Acquereur</th><td>${escapeHtml(quote.buyer || "-")}</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <p class="section-title">Client et projet</p>
                <table class="info-table">
                  <tbody>
                    <tr><th>Client</th><td>${escapeHtml(quote.clientName || "-")}</td></tr>
                    <tr><th>Structure</th><td>${escapeHtml(quote.structureName || "-")}</td></tr>
                    <tr><th>Gamme</th><td>${escapeHtml(quote.rangeName || "-")}</td></tr>
                    <tr><th>Produit</th><td>${escapeHtml(quote.productName || "-")}</td></tr>
                    <tr><th>Couleurs</th><td>${escapeHtml(quote.dominantColors || "-")}</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="section">
              <p class="section-title">Details des prestations</p>
              <table>
                <thead>
                  <tr>
                    <th>Bloc</th>
                    <th>Libelle</th>
                    <th class="numeric">Quantite</th>
                    <th class="numeric">Prix unitaire</th>
                    <th class="numeric">Total</th>
                  </tr>
                </thead>
                <tbody>${lineRows || '<tr><td colspan="5">Aucun article.</td></tr>'}</tbody>
              </table>
            </section>

            <section class="summary">
              <table>
                <tbody>
                  <tr><th>Sous-total</th><td class="numeric">${formatCurrency(quote.subtotal)}</td></tr>
                  <tr><th>Remise</th><td class="numeric">${formatCurrency(quote.discount)}</td></tr>
                  <tr class="total-row"><th>Total</th><td class="numeric strong">${formatCurrency(quote.total)}</td></tr>
                </tbody>
              </table>
            </section>

            <section class="section">
              <p class="section-title">Informations supplementaires</p>
              <div class="notes">${escapeHtml(quote.additionalInfo || "-")}</div>
            </section>

            <footer class="footer">Ce devis est valable jusqu'a la date d'echeance indiquee.</footer>
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

  const renderLineBlock = (
    title: string,
    lines: QuoteLine[],
    setter: Dispatch<SetStateAction<QuoteLine[]>>,
    labelText = "Nom",
  ) => (
    <section className="quote-block">
      <div className="quote-block-header">
        <div>
          <p className="panel-title">{title}</p>
          <p>{formatCurrency(blockTotal(lines))}</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setter([...lines, emptyLine()])}>
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {lines.map((line) => (
        <div className="quote-line" key={line.id}>
          <div className="field">
            <label>{labelText}</label>
            <input
              type="text"
              value={line.label}
              onChange={(event) => updateLine(setter, line.id, { label: event.target.value })}
            />
          </div>
          <div className="field">
            <label>Quantite</label>
            <input
              type="number"
              min="0"
              value={line.quantity}
              onChange={(event) => updateLine(setter, line.id, { quantity: Number(event.target.value) })}
            />
          </div>
          <div className="field">
            <label>Prix unitaire</label>
            <input
              type="number"
              min="0"
              value={line.unitPrice}
              onChange={(event) => updateLine(setter, line.id, { unitPrice: Number(event.target.value) })}
            />
          </div>
          <div className="quote-line-total">
            <span>Total</span>
            <strong>{formatCurrency(lineTotal(line))}</strong>
          </div>
          <button
            type="button"
            className="danger-button"
            onClick={() => removeLine(setter, line.id)}
            aria-label="Supprimer la ligne"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </section>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Commercial</p>
          <h1 className="page-title">Devis</h1>
          <p className="page-description">
            Preparez un devis professionnel avec les articles, contenants, impressions et prestations de marque.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={startNewQuote}>
          Nouveau devis
        </button>
      </div>

      <form onSubmit={handleCreateQuote} className="quote-builder" noValidate>
        <section className="quote-section">
          <div className="quote-section-header">
            <div>
              <p className="eyebrow">Informations</p>
              <h2>Base du devis</h2>
            </div>
            <span className="badge">{quoteNo}</span>
          </div>

          <div className="quote-form-grid">
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
              <input type="date" value={quoteDate} onChange={(event) => setQuoteDate(event.target.value)} required />
            </div>
            <div className="field">
              <label>Acquereur</label>
              <input type="text" value={buyer} onChange={(event) => setBuyer(event.target.value)} />
            </div>
            <div className="field">
              <label>Date d'echeance prevue</label>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="field">
              <label>Nom de la structure</label>
              <input type="text" value={structureName} onChange={(event) => setStructureName(event.target.value)} />
            </div>
            <div className="field">
              <label>Nom de la gamme</label>
              <input type="text" value={rangeName} onChange={(event) => setRangeName(event.target.value)} />
            </div>
            <div className="field">
              <label>Nom de produits</label>
              <input type="text" value={productName} onChange={(event) => setProductName(event.target.value)} />
            </div>
            <div className="field">
              <label>Couleurs dominantes</label>
              <input
                type="text"
                value={dominantColors}
                onChange={(event) => setDominantColors(event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Informations supplementaires</label>
            <textarea value={additionalInfo} onChange={(event) => setAdditionalInfo(event.target.value)} rows={4} />
          </div>
        </section>

        <div className="quote-block-grid">
          {renderLineBlock("Articles", articles, setArticles)}
          {renderLineBlock("Contenants", containers, setContainers)}
          {renderLineBlock("Impressions etui", packagingPrints, setPackagingPrints)}
          {renderLineBlock("Etiquettes", labels, setLabels, "Libelle")}
          {renderLineBlock("Maquette", mockups, setMockups, "Libelle")}
        </div>

        <section className="quote-section">
          <div className="quote-form-grid compact">
            <div className="field">
              <label>Logo - prix</label>
              <input
                type="number"
                min="0"
                value={logoPrice}
                onChange={(event) => setLogoPrice(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label>Remise</label>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(event) => setDiscount(Number(event.target.value))}
              />
            </div>
          </div>
        </section>

        <section className="quote-summary">
          <div>
            <span>Sous-total</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <div>
            <span>Remise</span>
            <strong>{formatCurrency(discount)}</strong>
          </div>
          <div className="quote-total">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </section>

        <div className="quote-actions">
          <button type="button" className="secondary-button" onClick={() => setShowPreview(true)}>
            <Eye size={18} /> Apercu devis
          </button>
          <button type="submit" className="success-button" disabled={createQuote.isPending}>
            <FileText size={18} /> {createQuote.isPending ? "Creation..." : "Creer devis"}
          </button>
          <button type="button" className="primary-button" onClick={() => printQuote(currentQuote)} disabled={total <= 0}>
            <Printer size={18} /> Imprimer
          </button>
        </div>

        {formMessage && (
          <div className={`quote-message${quoteCreated ? " success" : ""}`}>
            {formMessage}
          </div>
        )}
      </form>

      {showPreview && (
        <section className="quote-preview data-card" ref={previewRef}>
          <div className="table-toolbar">
            <div>
              <p className="panel-title">Apercu devis {quoteNo}</p>
            <p>{quoteCreated ? "Devis cree et enregistre dans la base" : "Apercu avant creation"}</p>
            </div>
            <span className="badge">{formatCurrency(total)}</span>
          </div>
          <div className="quote-preview-body">
            <div className="quote-preview-info">
              <div>
                <p className="stat-label">Client</p>
                <p className="strong-cell">{selectedCustomer?.name || "Non renseigne"}</p>
              </div>
              <div>
                <p className="stat-label">Structure</p>
                <p className="strong-cell">{structureName || "-"}</p>
              </div>
              <div>
                <p className="stat-label">Gamme</p>
                <p className="strong-cell">{rangeName || "-"}</p>
              </div>
              <div>
                <p className="stat-label">Produit</p>
                <p className="strong-cell">{productName || "-"}</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bloc</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Articles</td><td className="strong-cell">{formatCurrency(blockTotal(articles))}</td></tr>
                  <tr><td>Contenants</td><td className="strong-cell">{formatCurrency(blockTotal(containers))}</td></tr>
                  <tr><td>Impressions etui</td><td className="strong-cell">{formatCurrency(blockTotal(packagingPrints))}</td></tr>
                  <tr><td>Etiquettes</td><td className="strong-cell">{formatCurrency(blockTotal(labels))}</td></tr>
                  <tr><td>Maquette</td><td className="strong-cell">{formatCurrency(blockTotal(mockups))}</td></tr>
                  <tr><td>Logo</td><td className="strong-cell">{formatCurrency(logoPrice)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="quote-preview data-card">
        <div className="table-toolbar">
          <div>
            <p className="panel-title">Archives devis</p>
            <p>
              {quotesLoading
                ? "Chargement..."
                : `${filteredQuotes.length} devis affiche(s) sur ${savedQuotes.length} enregistre(s)`}
            </p>
          </div>
          <span className="badge">Archives</span>
        </div>
        <div className="quote-filters">
          <div className="field quote-search-field">
            <label>Recherche</label>
            <div className="quote-search-input">
              <Search size={16} />
              <input
                type="search"
                value={quoteSearch}
                onChange={(event) => setQuoteSearch(event.target.value)}
                placeholder="Numero, client, produit..."
              />
            </div>
          </div>
          <div className="field">
            <label>Client</label>
            <select value={quoteCustomerFilter} onChange={(event) => setQuoteCustomerFilter(event.target.value)}>
              <option value="">Tous les clients</option>
              {quoteCustomerOptions.map((clientName) => (
                <option key={clientName} value={clientName}>
                  {clientName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date debut</label>
            <input type="date" value={quoteDateFrom} onChange={(event) => setQuoteDateFrom(event.target.value)} />
          </div>
          <div className="field">
            <label>Date fin</label>
            <input type="date" value={quoteDateTo} onChange={(event) => setQuoteDateTo(event.target.value)} />
          </div>
          <button type="button" className="secondary-button" onClick={resetQuoteFilters} disabled={!hasQuoteFilters}>
            <RotateCcw size={16} /> Reinitialiser
          </button>
        </div>
        {archiveMessage && <div className="quote-archive-message">{archiveMessage}</div>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>N Devis</th>
                <th>Client</th>
                <th>Date</th>
                <th>Echeance</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => (
                <tr key={quote.number}>
                  <td className="strong-cell">{quote.number}</td>
                  <td>{quote.clientName || "N/A"}</td>
                  <td>{new Date(quote.quoteDate).toLocaleDateString("fr-FR")}</td>
                  <td>{quote.dueDate ? new Date(quote.dueDate).toLocaleDateString("fr-FR") : "N/A"}</td>
                  <td className="strong-cell">{formatCurrency(quote.total)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="secondary-icon-button"
                        onClick={() => printQuote(quote)}
                        aria-label="Imprimer le devis"
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleDeleteQuote(quote)}
                        aria-label="Supprimer le devis"
                        disabled={deleteQuote.isPending}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!quotesLoading && !savedQuotes.length && <div className="empty-state">Aucun devis cree pour le moment.</div>}
        {!quotesLoading && Boolean(savedQuotes.length) && !filteredQuotes.length && (
          <div className="empty-state">Aucun devis ne correspond aux filtres.</div>
        )}
      </section>
    </div>
  );
}
