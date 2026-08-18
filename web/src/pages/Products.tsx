import { useState } from "react";
import type { FormEvent } from "react";
import { useCategories } from "../hooks/useCategories";
import { useProducts, useCreateProduct, useDeleteProduct, useUpdateProduct } from "../hooks/useProducts";
import type { Product } from "../hooks/useProducts";
import { Pencil, Plus, Trash2, HelpCircle } from "lucide-react";
import { useMemo } from "react";
import FilterBar from "../components/FilterBar";

export default function Products() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();

  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState<string>("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setName("");
    setReference("");
    setCategoryId("");
    setPrice("");
    setWholesalePrice("");
    setEditingProductId(null);
    setFormError("");
  };

  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products ?? [];
    return (products ?? []).filter((p) => {
      const hay = [p.name, p.reference, p.categories?.name].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [products, search]);

  const grouped = useMemo(() => {
    const list = filteredProducts ?? [];
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
    return Object.keys(groups).map((k) => ({ base: k, items: groups[k] }));
  }, [filteredProducts]);

  const startEdit = (product: Product) => {
    setName(product.name);
    setReference(product.reference);
    setCategoryId(product.category_id ?? "");
    setPrice(String(product.selling_price));
    setWholesalePrice(product.wholesale_price != null ? String(product.wholesale_price) : "");
    setEditingProductId(product.id);
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const parsedPrice = Number(price);

    if (!trimmedName || !Number.isFinite(parsedPrice)) return;

    const payload = {
      name: trimmedName,
      reference,
      selling_price: parsedPrice,
      wholesale_price: wholesalePrice ? Number(wholesalePrice) : null,
      category_id: categoryId || null,
    };

    const options = {
      onSuccess: () => {
        resetForm();
        setShowForm(false);
      },
      onError: (error: Error) => {
        setFormError(error.message || "Impossible d'enregistrer le produit.");
      },
    };

    if (editingProductId) {
      updateProduct.mutate({ id: editingProductId, updates: payload }, options);
    } else {
      createProduct.mutate(payload, options);
    }
  };

  if (isLoading) return <div className="loading-state">Chargement...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="page-title">Gestion des produits</h1>
          <p className="page-description">
            Organisez les references, les prix et les categories de vos articles.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="primary-button"
        >
          <Plus size={18} /> Ajouter
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-panel">
          {formError && <p className="form-error">{formError}</p>}
          <div className="field">
            <label>Reference</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={editingProductId ? "" : "Auto: PRD-000001"}
              readOnly={!editingProductId}
            />
          </div>
          <div className="field">
            <label>Nom</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Categorie</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sans categorie</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Prix de vente FCFA</label>
            <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Prix grossiste (optionnel)
              <span title="Laisser vide si vous n'utilisez pas de prix grossiste. Le type de prix est géré automatiquement.">
                <HelpCircle size={14} />
              </span>
            </label>
            <input type="number" min="0" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} />
            <p className="field-note" style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>
              Laisser vide si vous n'utilisez pas de prix grossiste.
            </p>
          </div>
          <button type="submit" className="success-button" disabled={createProduct.isPending || updateProduct.isPending}>
            {createProduct.isPending || updateProduct.isPending ? "Enregistrement..." : editingProductId ? "Modifier" : "Valider"}
          </button>
        </form>
      )}

      <div className="data-card">
        <div className="table-toolbar">
          <div>
            <p className="panel-title">Liste des produits</p>
            <p>{products?.length ?? 0} reference(s) enregistree(s)</p>
          </div>
          <span className="badge">Stock</span>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
          <FilterBar value={search} onChange={setSearch} placeholder="Rechercher produits, reference ou categorie" />
          <div style={{width: 12}} />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Nom</th>
                <th>Categorie</th>
                <th>Prix</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => {
                if (g.items.length === 1) {
                  const product = g.items[0];
                  return (
                    <tr key={product.id}>
                      <td>{product.reference}</td>
                      <td className="strong-cell">{product.name}</td>
                      <td>{product.categories?.name || "N/A"}</td>
                      <td className="strong-cell">{product.selling_price} FCFA</td>
                      <td><span className="badge badge-muted">{product.price_type ?? 'Standard'}</span></td>
                      <td>
                        <div className="row-actions">
                          <button
                            onClick={() => startEdit(product)}
                            className="secondary-icon-button"
                            aria-label="Modifier le produit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => deleteProduct.mutate(product.id)}
                            className="danger-button"
                            aria-label="Supprimer le produit"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // multiple variants with same base name -> show group header then variants
                const prices = g.items.map((it) => Number(it.selling_price || 0));
                const min = Math.min(...prices);

                return (
                  <>
                    <tr key={g.base} className="group-header">
                      <td colSpan={6} style={{ fontWeight: 700 }}>{g.base.toUpperCase()}</td>
                    </tr>
                    {g.items.map((product) => {
                      const type = Number(product.selling_price || 0) === min ? "Grossiste" : "Détaillant";
                      return (
                        <tr key={product.id}>
                          <td>{product.reference}</td>
                          <td className="strong-cell">{product.name}</td>
                          <td>{product.categories?.name || "N/A"}</td>
                          <td className="strong-cell">{product.selling_price} FCFA</td>
                          <td><span className={`badge ${type === "Grossiste" ? "badge-accent" : "badge-muted"}`}>{type}</span></td>
                          <td>
                            <div className="row-actions">
                              <button
                                onClick={() => startEdit(product)}
                                className="secondary-icon-button"
                                aria-label="Modifier le produit"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => deleteProduct.mutate(product.id)}
                                className="danger-button"
                                aria-label="Supprimer le produit"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {!products?.length && <div className="empty-state">Aucun produit pour le moment.</div>}
      </div>
    </div>
  );
}
