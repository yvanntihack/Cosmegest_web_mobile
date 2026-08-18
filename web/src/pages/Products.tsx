import { useState } from "react";
import type { FormEvent } from "react";
import { useCategories } from "../hooks/useCategories";
import { useProducts, useCreateProduct, useDeleteProduct, useUpdateProduct } from "../hooks/useProducts";
import type { Product } from "../hooks/useProducts";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setName("");
    setReference("");
    setCategoryId("");
    setPrice("");
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

  const startEdit = (product: Product) => {
    setName(product.name);
    setReference(product.reference);
    setCategoryId(product.category_id ?? "");
    setPrice(String(product.selling_price));
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts?.map((product) => (
                <tr key={product.id}>
                  <td>{product.reference}</td>
                  <td className="strong-cell">{product.name}</td>
                  <td>{product.categories?.name || "N/A"}</td>
                  <td className="strong-cell">{product.selling_price} FCFA</td>
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
              ))}
            </tbody>
          </table>
        </div>
        {!products?.length && <div className="empty-state">Aucun produit pour le moment.</div>}
      </div>
    </div>
  );
}
