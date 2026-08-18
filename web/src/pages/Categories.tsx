import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import FilterBar from "../components/FilterBar";
import type { FormEvent } from "react";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../hooks/useCategories";
import type { Category } from "../hooks/useCategories";

export default function Categories() {
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory();
  const [name, setName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setName("");
    setEditingCategoryId(null);
  };

  const startEdit = (category: Category) => {
    setName(category.name);
    setEditingCategoryId(category.id);
    setShowForm(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) return;

    const options = {
      onSuccess: () => {
        resetForm();
        setShowForm(false);
      },
    };

    if (editingCategoryId) {
      updateCategory.mutate({ id: editingCategoryId, name: trimmedName }, options);
    } else {
      createCategory.mutate(trimmedName, options);
    }
  };

  const [search, setSearch] = useState("");

  if (isLoading) return <div className="loading-state">Chargement...</div>;

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories ?? [];
    return (categories ?? []).filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [categories, search]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="page-title">Categories</h1>
          <p className="page-description">
            Classez vos produits par famille pour garder un catalogue facile a parcourir.
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
          <div className="field">
            <label>Nom</label>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <button type="submit" className="success-button" disabled={createCategory.isPending || updateCategory.isPending}>
            {editingCategoryId ? "Modifier" : "Valider"}
          </button>
        </form>
      )}

      <div className="data-card">
        <div className="table-toolbar">
          <div>
            <p className="panel-title">Liste des categories</p>
            <p>{categories?.length ?? 0} categorie(s) enregistree(s)</p>
          </div>
          <span className="badge">Catalogue</span>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
          <FilterBar value={search} onChange={setSearch} placeholder="Rechercher categories" />
          <div style={{width: 12}} />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Date creation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories?.map((category) => (
                <tr key={category.id}>
                  <td className="strong-cell">{category.name}</td>
                  <td>{new Date(category.created_at).toLocaleDateString("fr-FR")}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => startEdit(category)}
                        className="secondary-icon-button"
                        aria-label="Modifier la categorie"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => deleteCategory.mutate(category.id)}
                        className="danger-button"
                        aria-label="Supprimer la categorie"
                        disabled={deleteCategory.isPending}
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
        {!categories?.length && <div className="empty-state">Aucune categorie pour le moment.</div>}
      </div>
    </div>
  );
}
