import { useMemo, useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import type { NavLinkRenderProps } from "react-router-dom";
import {
  Bell,
  Box,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Tags,
  Users,
} from "lucide-react";
import { useCategories } from "../hooks/useCategories";
import { useCustomers } from "../hooks/useCustomers";
import { useInvoices } from "../hooks/useInvoices";
import { useProducts } from "../hooks/useProducts";
import { useQuotes } from "../hooks/useQuotes";
import { useAuth } from "../contexts/useAuth";
import { getQueue } from "../lib/offline";

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: customers } = useCustomers();
  const { data: invoices } = useInvoices();
  const { data: products } = useProducts();
  const { data: quotes } = useQuotes();
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const update = async () => {
      setIsOnline(navigator.onLine);
      try {
        const q = await getQueue();
        setPendingCount(q.length);
      } catch (e) {
        setPendingCount(0);
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const iid = setInterval(update, 3000);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      clearInterval(iid);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: NavLinkRenderProps) =>
    `nav-link${isActive ? " active" : ""}`;

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "C";
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];

    const entries = [
      ...(customers ?? []).map((customer) => ({
        title: customer.name,
        subtitle: `${customer.code} - ${customer.phone || "Sans telephone"}`,
        type: "Client",
        path: "/customers",
      })),
      ...(products ?? []).map((product) => ({
        title: product.name,
        subtitle: `${product.reference} - ${product.selling_price} FCFA`,
        type: "Produit",
        path: "/products",
      })),
      ...(categories ?? []).map((category) => ({
        title: category.name,
        subtitle: "Categorie produit",
        type: "Categorie",
        path: "/categories",
      })),
      ...((invoices ?? []) as Array<Record<string, unknown>>).map((invoice) => ({
        title: String(invoice["invoice_number"] ?? ""),
        subtitle: `${String(((invoice["customers"] as Record<string, unknown>) || {})["name"] ?? "Client non renseigne")} - ${String(invoice["total_amount"] ?? 0)} FCFA`,
        type: "Facture",
        path: "/ventes",
      })),
      ...(quotes ?? []).map((quote) => ({
        title: quote.number,
        subtitle: `${quote.clientName || "Client non renseigne"} - ${quote.total || 0} FCFA`,
        type: "Devis",
        path: "/devis",
      })),
    ];

    return entries
      .filter((entry) =>
        `${entry.title} ${entry.subtitle} ${entry.type}`.toLowerCase().includes(normalizedSearch),
      )
      .slice(0, 8);
  }, [categories, customers, invoices, normalizedSearch, products, quotes]);

  const notifications = useMemo(() => {
    const draftInvoices = ((invoices ?? []) as Array<Record<string, unknown>>).filter(
      (invoice) => String(invoice["status"]) === "brouillon",
    );
    const unpaidInvoices = ((invoices ?? []) as Array<Record<string, unknown>>).filter(
      (invoice) => String(invoice["status"]) === "emise",
    );
    const emptyProducts = (products ?? []).filter((product) => Number(product.selling_price) <= 0);

    return [
      ...draftInvoices.slice(0, 3).map((invoice) => {
        const inv = invoice as Record<string, unknown>;
        const invNum = String(inv["invoice_number"] ?? "");
        const custName = String(((inv["customers"] as Record<string, unknown>) || {})["name"] ?? "Client non renseigne");
        return {
          title: `Facture brouillon ${invNum}`,
          description: custName,
          path: "/ventes",
        };
      }),
      ...unpaidInvoices.slice(0, 3).map((invoice) => {
        const inv = invoice as Record<string, unknown>;
        const invNum = String(inv["invoice_number"] ?? "");
        const total = String(inv["total_amount"] ?? 0);
        return {
          title: `Facture emise ${invNum}`,
          description: `${total} FCFA a suivre`,
          path: "/ventes",
        };
      }),
      ...emptyProducts.slice(0, 3).map((product) => ({
        title: `Prix a verifier: ${product.name}`,
        description: product.reference,
        path: "/products",
      })),
    ].slice(0, 6);
  }, [invoices, products]);

  const openResult = (path: string) => {
    navigate(path);
    setSearchTerm("");
    setShowSearchResults(false);
  };

  const openNotification = (path: string) => {
    navigate(path);
    setShowNotifications(false);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Box size={24} />
          </div>
          <div>
            <h1 className="brand-title">CosmeGest</h1>
            <p className="brand-subtitle">Gestion cosmetique</p>
          </div>
        </div>

        <p className="sidebar-section-title">Navigation</p>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={navLinkClass}>
            <LayoutDashboard size={18} /> Tableau
          </NavLink>
          <NavLink to="/products" className={navLinkClass}>
            <Package size={18} /> Produits
          </NavLink>
          <NavLink to="/categories" className={navLinkClass}>
            <Tags size={18} /> Categories
          </NavLink>
          <NavLink to="/customers" className={navLinkClass}>
            <Users size={18} /> Clients
          </NavLink>
          <NavLink to="/devis" className={navLinkClass}>
            <FileText size={18} /> Devis
          </NavLink>
          <NavLink to="/ventes" className={navLinkClass}>
            <ShoppingCart size={18} /> Ventes
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{userInitial}</div>
            <div>
              <p className="user-label">Compte connecte</p>
              <p className="user-email">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="ghost-button">
            <LogOut size={18} /> Deconnexion
          </button>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div>
            <h2 className="topbar-title">Espace de gestion</h2>
            <p className="topbar-subtitle">Suivi des ventes, produits et clients en un seul endroit.</p>
          </div>
          <div className="topbar-actions">
            <div className="search-area">
              <label className="search-box">
                <Search size={18} />
                <input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setShowSearchResults(true);
                    setShowNotifications(false);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && searchResults[0]) {
                      openResult(searchResults[0].path);
                    }
                    if (event.key === "Escape") {
                      setShowSearchResults(false);
                    }
                  }}
                />
              </label>
              {showSearchResults && normalizedSearch && (
                <div className="topbar-popover search-results">
                  {searchResults.length ? (
                    searchResults.map((result) => (
                      <button key={`${result.type}-${result.title}-${result.subtitle}`} onClick={() => openResult(result.path)}>
                        <span className="result-type">{result.type}</span>
                        <strong>{result.title}</strong>
                        <small>{result.subtitle}</small>
                      </button>
                    ))
                  ) : (
                    <div className="popover-empty">Aucun resultat.</div>
                  )}
                </div>
              )}
            </div>
            <div className="notification-area">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 10, background: isOnline ? "#10b981" : "#ef4444" }} />
                  <div style={{ color: "#64748b", fontSize: 13 }}>{isOnline ? "En ligne" : "Hors-ligne"}</div>
                </div>
                {pendingCount > 0 && <div className="badge">{pendingCount}</div>}
              </div>
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={() => {
                  setShowNotifications((current) => !current);
                  setShowSearchResults(false);
                }}
              >
              <Bell size={18} />
                {notifications.length > 0 && <span className="notification-dot">{notifications.length}</span>}
              </button>
              {showNotifications && (
                <div className="topbar-popover notification-popover">
                  <div className="popover-title">Notifications</div>
                  {notifications.length ? (
                    notifications.map((notification) => (
                      <button key={`${notification.title}-${notification.description}`} onClick={() => openNotification(notification.path)}>
                        <strong>{notification.title}</strong>
                        <small>{notification.description}</small>
                      </button>
                    ))
                  ) : (
                    <div className="popover-empty">Rien a signaler.</div>
                  )}
                </div>
              )}
            </div>
            <button className="icon-button" aria-label="Parametres">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
