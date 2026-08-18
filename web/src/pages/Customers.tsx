import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useCustomers, useCreateCustomer, useDeleteCustomer, useUpdateCustomer } from "../hooks/useCustomers";
import type { Customer } from "../hooks/useCustomers";
import { Pencil, Plus, Trash2 } from "lucide-react";
import FilterBar from "../components/FilterBar";
import { enqueueOperation } from "../lib/offline";

export default function Customers() {
  const { data: customers, isLoading } = useCustomers();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [segment, setSegment] = useState("detaillant");
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setName("");
    setCode("");
    setPhone("");
    setSegment("detaillant");
    setEditingCustomerId(null);
    setFormError("");
  };

  const startEdit = (customer: Customer) => {
    setName(customer.name);
    setCode(customer.code);
    setPhone(customer.phone ?? "");
    setSegment(customer.segment ?? "detaillant");
    setEditingCustomerId(customer.id);
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const options = {
      onSuccess: () => {
        resetForm();
        setShowForm(false);
      },
      onError: (error: Error) => {
        setFormError(error.message || "Impossible d'enregistrer le client.");
      },
    };

    const payload = { name: trimmedName, code, phone, segment };
    if (!navigator.onLine) {
      // Offline: enqueue the create operation and optimistically update UI
      enqueueOperation("create_customer", payload);
      options.onSuccess();
      return;
    }

    if (editingCustomerId) {
      updateCustomer.mutate({ id: editingCustomerId, updates: payload }, options);
    } else {
      createCustomer.mutate(payload, options);
    }
  };

  const handleDelete = (customer: Customer) => {
    const confirmed = window.confirm(`Supprimer le client ${customer.name} ?`);
    if (!confirmed) return;

    deleteCustomer.mutate(customer.id);
  };

  const [search, setSearch] = useState("");

  if (isLoading) return <div className="loading-state">Chargement...</div>;

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers ?? [];
    return (customers ?? []).filter((c) => {
      const hay = [c.name, c.code, c.phone].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [customers, search]);

  const todayKey = new Date().toISOString().slice(0, 10);
  type CustomerWithMeta = Customer & { created_at?: string | null };
  const todaysClients = filteredCustomers.filter((c: CustomerWithMeta) => String(c.created_at ?? "").slice(0, 10) === todayKey);
  const otherClients = filteredCustomers.filter((c: CustomerWithMeta) => String(c.created_at ?? "").slice(0, 10) !== todayKey);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Relation client</p>
          <h1 className="page-title">Gestion des clients</h1>
          <p className="page-description">
            Gardez les coordonnees clients accessibles pour accelerer les ventes et le suivi.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="primary-button"
        >
          <Plus size={18} /> Nouveau client
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-panel">
          {formError && <p className="form-error">{formError}</p>}
          <div className="field">
            <label>Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={editingCustomerId ? "" : "Auto: CLI-000001"}
              readOnly={!editingCustomerId}
            />
          </div>
          <div className="field">
            <label>Nom</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Telephone</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>Segment</label>
            <select value={segment} onChange={(e) => setSegment(e.target.value)}>
              <option value="detaillant">Détaillant</option>
              <option value="grossiste">Grossiste</option>
            </select>
          </div>
          <button type="submit" className="success-button" disabled={createCustomer.isPending || updateCustomer.isPending}>
            {createCustomer.isPending || updateCustomer.isPending ? "Enregistrement..." : editingCustomerId ? "Modifier" : "Valider"}
          </button>
        </form>
      )}

      <div className="data-card">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
          <FilterBar value={search} onChange={setSearch} placeholder="Rechercher clients, code ou telephone" />
          <div style={{width: 12}} />
        </div>
        <div className="table-toolbar">
          <div>
            <p className="panel-title">Clients du jour</p>
            <p>{todaysClients.length} client(s) aujourd'hui</p>
          </div>
          <span className="badge">Nouveaux</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Telephone</th>
                <th>Segment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {todaysClients.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.code}</td>
                  <td className="strong-cell">{customer.name}</td>
                  <td>{customer.phone || "N/A"}</td>
                  <td><span className="badge badge-muted">{customer.segment || "Standard"}</span></td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => startEdit(customer)}
                        className="secondary-icon-button"
                        aria-label="Modifier le client"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer)}
                        className="danger-button"
                        aria-label="Supprimer le client"
                        disabled={deleteCustomer.isPending}
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
        {!todaysClients.length && <div className="empty-state">Aucun nouveau client aujourd'hui.</div>}
      </div>

      <div className="data-card">
        <div className="table-toolbar">
          <div>
            <p className="panel-title">Autres clients</p>
            <p>{otherClients.length} client(s) enregistre(s)</p>
          </div>
          <span className="badge">CRM</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Telephone</th>
                <th>Segment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {otherClients.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.code}</td>
                  <td className="strong-cell">{customer.name}</td>
                  <td>{customer.phone || "N/A"}</td>
                  <td><span className="badge badge-muted">{customer.segment || "Standard"}</span></td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => startEdit(customer)}
                        className="secondary-icon-button"
                        aria-label="Modifier le client"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer)}
                        className="danger-button"
                        aria-label="Supprimer le client"
                        disabled={deleteCustomer.isPending}
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
        {!otherClients.length && <div className="empty-state">Aucun client pour le moment.</div>}
      </div>
    </div>
  );
}
