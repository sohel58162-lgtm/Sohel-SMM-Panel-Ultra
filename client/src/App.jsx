import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  ShoppingBag,
  Layers,
  Wallet,
  Headset,
  Users,
  Code2,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  CheckCircle2,
  CircleSlash,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import "./style.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "new-order", label: "New Order", icon: PlusCircle },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "services", label: "Services", icon: Layers },
  { id: "add-funds", label: "Add Funds", icon: Wallet },
  { id: "support", label: "Support", icon: Headset },
  { id: "api", label: "API", icon: Code2 },
  { id: "settings", label: "Settings", icon: Settings },
];

const demoServices = [
  {
    id: 1,
    name: "Social media content audit",
    category: "Consulting",
    description: "Review public-facing content and provide improvement recommendations.",
    unit: "audit",
    price: 299,
    min_quantity: 1,
    max_quantity: 50,
  },
  {
    id: 2,
    name: "Content calendar setup",
    category: "Content Planning",
    description: "A tailored content calendar for a brand or creator.",
    unit: "month",
    price: 499,
    min_quantity: 1,
    max_quantity: 12,
  },
  {
    id: 3,
    name: "Profile optimisation review",
    category: "Consulting",
    description: "Recommendations for profile clarity and conversion.",
    unit: "review",
    price: 199,
    min_quantity: 1,
    max_quantity: 50,
  },
  {
    id: 4,
    name: "Campaign reporting setup",
    category: "Analytics",
    description: "A reporting template for compliant marketing reporting.",
    unit: "setup",
    price: 399,
    min_quantity: 1,
    max_quantity: 20,
  },
];

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

async function apiFetch(path, { token, options = {} } = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function normalizeRole(role) {
  return String(role || "user").toLowerCase() === "admin" ? "admin" : "user";
}

function AdminDashboard({
  user,
  token,
  orders,
  services,
  balance,
  onRefresh,
  onLogout,
  menuOpen,
  setMenuOpen,
}) {
  const [adminTab, setAdminTab] = useState("overview");
  const [usersList, setUsersList] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAdminUsers() {
      if (!token) return;
      setLoadingAdmin(true);
      try {
        const res = await apiFetch("/api/admin/users", { token });
        if (active && Array.isArray(res.users)) {
          setUsersList(res.users);
        }
      } catch {
        // अगर backend route मौजूद नहीं है तो empty/fallback list रहने दें
      } finally {
        if (active) setLoadingAdmin(false);
      }
    }
    loadAdminUsers();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleOrderStatusChange(orderId, status) {
    setAdminMessage("");
    try {
      await apiFetch(`/api/admin/orders/${orderId}/status`, {
        token,
        options: {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      });
      setAdminMessage(`Order #${orderId} status updated to ${status}.`);
      await onRefresh();
    } catch (err) {
      setAdminMessage(err.message);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand">
            <ShieldCheck size={20} />
            <span>SOHEL ADMIN PANEL</span>
          </div>
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list">
          <button
            className={`nav-item ${adminTab === "overview" ? "active" : ""}`}
            onClick={() => {
              setAdminTab("overview");
              setMenuOpen(false);
            }}
          >
            <LayoutDashboard size={18} />
            <span>Admin Overview</span>
          </button>
          <button
            className={`nav-item ${adminTab === "orders" ? "active" : ""}`}
            onClick={() => {
              setAdminTab("orders");
              setMenuOpen(false);
            }}
          >
            <ShoppingBag size={18} />
            <span>All Orders ({orders.length})</span>
          </button>
          <button
            className={`nav-item ${adminTab === "users" ? "active" : ""}`}
            onClick={() => {
              setAdminTab("users");
              setMenuOpen(false);
            }}
          >
            <Users size={18} />
            <span>Users</span>
          </button>
          <button
            className={`nav-item ${adminTab === "services" ? "active" : ""}`}
            onClick={() => {
              setAdminTab("services");
              setMenuOpen(false);
            }}
          >
            <Layers size={18} />
            <span>Services ({services.length})</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{user?.displayName || user?.email}</strong>
            <span>Role: ADMIN</span>
          </div>
          <button className="btn btn-ghost" onClick={onLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(true)}>
            <Menu size={20} />
          </button>
          <div>
            <h1>Admin Dashboard</h1>
            <p>Welcome back, {user?.displayName || "Admin"} (Admin Controls)</p>
          </div>
          <button className="btn btn-secondary" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </header>

        {adminMessage && <div className="alert">{adminMessage}</div>}

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Orders</span>
            <strong>{orders.length}</strong>
          </div>
          <div className="stat-card">
            <span>Active Services</span>
            <strong>{services.length}</strong>
          </div>
          <div className="stat-card">
            <span>Admin Wallet</span>
            <strong>{money(balance)}</strong>
          </div>
          <div className="stat-card">
            <span>Role</span>
            <strong>ADMIN</strong>
          </div>
        </section>

        {adminTab === "overview" && (
          <section className="card">
            <h2>Recent Orders Management</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Service</th>
                    <th>Quantity</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="6">No orders found.</td>
                    </tr>
                  ) : (
                    orders.map((ord) => (
                      <tr key={ord.id}>
                        <td>#{ord.id}</td>
                        <td>{ord.service_name || `Service #${ord.service_id}`}</td>
                        <td>{ord.quantity}</td>
                        <td>{money(ord.amount)}</td>
                        <td>{ord.status}</td>
                        <td>
                          <select
                            value={ord.status || "pending"}
                            onChange={(e) => handleOrderStatusChange(ord.id, e.target.value)}
                          >
                            <option value="pending">pending</option>
                            <option value="processing">processing</option>
                            <option value="completed">completed</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {adminTab === "orders" && (
          <section className="card">
            <h2>All Platform Orders</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Target</th>
                    <th>Quantity</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="6">No orders yet.</td>
                    </tr>
                  ) : (
                    orders.map((ord) => (
                      <tr key={ord.id}>
                        <td>#{ord.id}</td>
                        <td>{ord.user_email || ord.user_id || "-"}</td>
                        <td>{ord.target || "-"}</td>
                        <td>{ord.quantity}</td>
                        <td>{money(ord.amount)}</td>
                        <td>{ord.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {adminTab === "users" && (
          <section className="card">
            <h2>Registered Users</h2>
            {loadingAdmin ? (
              <p>Loading users...</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan="4">
                          {user?.email} ({user?.role || "admin"})
                        </td>
                      </tr>
                    ) : (
                      usersList.map((u) => (
                        <tr key={u.id || u.email}>
                          <td>{u.id || "-"}</td>
                          <td>{u.displayName || u.display_name || "-"}</td>
                          <td>{u.email}</td>
                          <td>{normalizeRole(u.role)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {adminTab === "services" && (
          <section className="card">
            <h2>Available Services</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((srv) => (
                    <tr key={srv.id}>
                      <td>#{srv.id}</td>
                      <td>{srv.name}</td>
                      <td>{srv.category}</td>
                      <td>{money(srv.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function UserDashboard({
  user,
  token,
  activeTab,
  setActiveTab,
  menuOpen,
  setMenuOpen,
  services,
  orders,
  balance,
  onRefresh,
  onLogout,
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id || 1);
  const [target, setTarget] = useState("");
  const [quantity, setQuantity] = useState(services[0]?.min_quantity || 1);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (services.length > 0 && !services.some((s) => Number(s.id) === Number(serviceId))) {
      setServiceId(services[0].id);
      setQuantity(services[0].min_quantity || 1);
    }
  }, [services, serviceId]);

  const selectedService = useMemo(
    () => services.find((s) => Number(s.id) === Number(serviceId)) || services[0],
    [services, serviceId]
  );

  const estimatedPrice = useMemo(() => {
    const unitPrice = Number(selectedService?.price || 0);
    const qty = Number(quantity || 0);
    return unitPrice * qty;
  }, [selectedService, quantity]);

  async function placeOrder(e) {
    e.preventDefault();
    setFeedback("");
    setErrorMsg("");

    const minQty = Number(selectedService?.min_quantity || 1);
    const maxQty = Number(selectedService?.max_quantity || 100000);
    const qty = Number(quantity);

    if (!target.trim()) {
      setErrorMsg("Please enter a valid target link or handle.");
      return;
    }
    if (Number.isNaN(qty) || qty < minQty || qty > maxQty) {
      setErrorMsg(`Quantity must be between ${minQty} and ${maxQty}.`);
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/orders", {
        token,
        options: {
          method: "POST",
          body: JSON.stringify({
            serviceId: Number(selectedService.id),
            target: target.trim(),
            quantity: qty,
          }),
        },
      });
      setTarget("");
      setFeedback("Order placed successfully!");
      await onRefresh();
      setActiveTab("orders");
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand">
            <ArrowUpRight size={20} />
            <span>SOHEL MEDIA PANEL</span>
          </div>
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMenuOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{user?.displayName || user?.email}</strong>
            <span>Balance: {money(balance)}</span>
          </div>
          <button className="btn btn-ghost" onClick={onLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(true)}>
            <Menu size={20} />
          </button>
          <div>
            <h1>User Dashboard</h1>
            <p>Welcome, {user?.displayName || user?.email}</p>
          </div>
          <div className="balance-pill">Balance: {money(balance)}</div>
        </header>

        {feedback && <div className="alert success">{feedback}</div>}
        {errorMsg && <div className="alert error">{errorMsg}</div>}

        {activeTab === "dashboard" && (
          <>
            <section className="stats-grid">
              <div className="stat-card">
                <span>Wallet Balance</span>
                <strong>{money(balance)}</strong>
              </div>
              <div className="stat-card">
                <span>Total Orders</span>
                <strong>{orders.length}</strong>
              </div>
              <div className="stat-card">
                <span>Services Available</span>
                <strong>{services.length}</strong>
              </div>
              <div className="stat-card">
                <span>Account Type</span>
                <strong>USER</strong>
              </div>
            </section>

            <section className="card">
              <h2>Recent Orders</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Service</th>
                      <th>Quantity</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan="5">No orders placed yet.</td>
                      </tr>
                    ) : (
                      orders.slice(0, 5).map((ord) => (
                        <tr key={ord.id}>
                          <td>#{ord.id}</td>
                          <td>{ord.service_name || `Service #${ord.service_id}`}</td>
                          <td>{ord.quantity}</td>
                          <td>{money(ord.amount)}</td>
                          <td>{ord.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeTab === "new-order" && (
          <section className="card">
            <h2>Place New Order</h2>
            <form onSubmit={placeOrder} className="form-grid">
              <label>
                <span>Service</span>
                <select
                  value={serviceId}
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    setServiceId(nextId);
                    const found = services.find((s) => Number(s.id) === nextId);
                    if (found) setQuantity(found.min_quantity || 1);
                  }}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {money(s.price)} / {s.unit || "unit"}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Target Link / Username</span>
                <input
                  type="text"
                  placeholder="https://instagram.com/yourhandle"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                />
 
