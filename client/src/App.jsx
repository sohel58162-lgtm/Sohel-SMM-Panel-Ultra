import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, PlusCircle, ShoppingBag, Layers, Wallet, Headset,
  Users, Code2, Settings, LogOut, Menu, X, ArrowUpRight,
  Clock3, CheckCircle2, ShieldCheck, RefreshCw
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
const nav = [
  ["Dashboard", LayoutDashboard], ["New Order", PlusCircle],
  ["Orders", ShoppingBag], ["Services", Layers], ["Add Funds", Wallet],
  ["Support", Headset], ["Affiliate", Users], ["API", Code2], ["Settings", Settings]
];
const demoServices = [
  { id: 1, name: "Social media content audit", category: "Consulting", description: "Review public-facing content and provide improvement recommendations.", unit_price: "199.00", min_quantity: 1, max_quantity: 10 },
  { id: 2, name: "Content calendar setup", category: "Content Planning", description: "A tailored content calendar for a brand or creator.", unit_price: "499.00", min_quantity: 1, max_quantity: 5 },
  { id: 3, name: "Profile optimisation review", category: "Consulting", description: "Recommendations for profile clarity and discoverability.", unit_price: "149.00", min_quantity: 1, max_quantity: 20 },
  { id: 4, name: "Campaign reporting setup", category: "Analytics", description: "A reporting template for compliant marketing campaigns.", unit_price: "299.00", min_quantity: 1, max_quantity: 10 }
];
function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}
async function api(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("sohel_token") || "");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sohel_user") || "null"); } catch { return null; }
  });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ displayName: "", email: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [page, setPage] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [services, setServices] = useState(demoServices);
  const [orders, setOrders] = useState([]);
  const [balance, setBalance] = useState(0);
  const [serviceId, setServiceId] = useState("1");
  const [targetUrl, setTargetUrl] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const selected = services.find((service) => Number(service.id) === Number(serviceId));
  const estimate = useMemo(() => selected ? Number(selected.unit_price) * Number(quantity || 0) : 0, [selected, quantity]);

  async function loadDashboard(currentToken = token) {
    const [serviceData, orderData, walletData] = await Promise.all([
      api("/api/services", currentToken),
      api("/api/orders", currentToken),
      api("/api/wallet", currentToken)
    ]);
    setServices(Array.isArray(serviceData) && serviceData.length ? serviceData : demoServices);
    setOrders(Array.isArray(orderData) ? orderData : []);
    setBalance(Number(walletData.balance || 0));
  }
  useEffect(() => {
    if (!token) return;
    loadDashboard().catch((error) => {
      setNotice(error.message);
      if (/log in|session expired/i.test(error.message)) logout();
    });
  }, [token]);

  function logout() {
    localStorage.removeItem("sohel_token");
    localStorage.removeItem("sohel_user");
    setToken("");
    setUser(null);
    setOrders([]);
    setBalance(0);
    setNotice("");
  }
  async function submitAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    setNotice("");
    try {
      const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const result = await api(path, "", { method: "POST", body: JSON.stringify(authForm) });
      localStorage.setItem("sohel_token", result.token);
      localStorage.setItem("sohel_user", JSON.stringify(result.user));
      setUser(result.user);
      setToken(result.token);
    } catch (error) { setNotice(error.message); }
    finally { setAuthBusy(false); }
  }
  async function placeOrder(event) {
    event.preventDefault();
    setNotice("");
    if (!selected || !/^https:\/\/\S+$/i.test(targetUrl)) {
      setNotice("कृपया सेवा चुनें और HTTPS लिंक डालें।");
      return;
    }
    if (Number(quantity) < Number(selected.min_quantity) || Number(quantity) > Number(selected.max_quantity)) {
      setNotice(`Quantity ${selected.min_quantity} से ${selected.max_quantity} के बीच रखें।`);
      return;
    }
    setLoading(true);
    try {
      await api("/api/orders", token, {
        method: "POST",
        body: JSON.stringify({ serviceId: Number(serviceId), targetUrl, quantity: Number(quantity) })
      });
      setNotice("आपका ऑर्डर सेव हो गया। Provider API अभी configure नहीं है, इसलिए ऑर्डर अपने-आप fulfil नहीं होगा।");
      setTargetUrl("");
      await loadDashboard();
    } catch (error) { setNotice(error.message); }
    finally { setLoading(false); }
  }

  if (!token || !user) {
    return <div className="authscreen">
      <form className="authcard" onSubmit={submitAuth}>
        <div className="brand authbrand"><span className="brandmark">✦</span><div><b>SOHEL SMM</b><small>MANAGEMENT PANEL</small></div></div>
        <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
        <h1>{authMode === "login" ? "Sign in" : "Create account"}</h1>
        <p className="muted">{authMode === "login" ? "अपने अकाउंट में लॉग इन करें।" : "नया ग्राहक अकाउंट बनाएँ।"}</p>
        {authMode === "register" && <label>पूरा नाम<input required minLength="2" value={authForm.displayName} onChange={e => setAuthForm({ ...authForm, displayName: e.target.value })} placeholder="Your name" /></label>}
        <label>Email<input required type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label>
        <label>Password<input required type="password" minLength={8} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters" /></label>
        <button className="primary authsubmit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Login" : "Register"} <ArrowUpRight size={16}/></button>
        {notice && <p className="feedback">{notice}</p>}
        <p className="authswitch">{authMode === "login" ? "नया अकाउंट चाहिए?" : "पहले से अकाउंट है?"} <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setNotice(""); }}>{authMode === "login" ? "Register" : "Login"}</button></p>
      </form>
    </div>;
  }

  const Sidebar = () => <aside className="sidebar">
    <div className="brand"><span className="brandmark">✦</span><div><b>SOHEL SMM</b><small>MANAGEMENT PANEL</small></div></div>
    <div className="navlabel">WORKSPACE</div>
    {nav.map(([name, Icon]) => <button key={name} onClick={() => { setPage(name); setMobileOpen(false); }} className={`navitem ${page === name ? "active" : ""}`}><Icon size={18}/><span>{name}</span>{name === "Orders" && orders.length > 0 && <em>{orders.length}</em>}</button>)}
    <div className="sidebottom"><ShieldCheck size={17}/><span>Secure workspace</span></div>
  </aside>;

  return <div className="app"><Sidebar/>
    {mobileOpen && <div className="mobileShade" onClick={() => setMobileOpen(false)}><div onClick={e => e.stopPropagation()}><button className="close" onClick={() => setMobileOpen(false)}><X/></button><Sidebar/></div></div>}
    <main className="main">
      <header className="topbar"><button className="mobileMenu" onClick={() => setMobileOpen(true)}><Menu/></button><div><div className="crumb">Workspace / <b>{page}</b></div><h1>{page}</h1></div><div className="topactions"><span className="muted">{user.display_name || user.email}</span><button className="iconbtn" aria-label="Logout" onClick={logout}><LogOut/></button><div className="avatar">{(user.display_name || user.email || "S").charAt(0).toUpperCase()}</div></div></header>
      {page === "Dashboard" && <>
        <section className="welcome"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Welcome back 👋</h2><p>Manage your services, orders and customer activity in one place.</p></div><button className="primary" onClick={() => setPage("New Order")}><PlusCircle size={17}/> Create order</button></section>
        <section className="stats"><Stat icon={Wallet} label="Wallet balance" value={money(balance)} tone="purple"/><Stat icon={ShoppingBag} label="Total orders" value={orders.length} tone="blue"/><Stat icon={Clock3} label="Pending orders" value={orders.filter(o => o.status === "pending" || o.status === "processing").length} tone="amber"/><Stat icon={CheckCircle2} label="Active services" value={services.length} tone="green"/></section>
        <section className="panel"><div className="panelhead"><div><h3>Recent orders</h3><p>Your latest order activity</p></div><button className="textbtn" onClick={() => setPage("Orders")}>View all <ArrowUpRight size={15}/></button></div><OrderTable orders={orders.slice(0, 5)}/></section>
        <section className="notice"><ShieldCheck size={19}/><div><b>Project status</b><p>Login, registration and account-based orders are connected. Payment gateway and approved provider dispatch still need configuration.</p></div></section>
      </>}
      {page === "New Order" && <section className="panel formpanel"><div className="panelhead"><div><h3>Create a new order</h3><p>Choose an approved service and provide its destination link.</p></div></div><form onSubmit={placeOrder} className="orderform">
        <label>Service<select value={serviceId} onChange={e => setServiceId(e.target.value)}>{services.map(s => <option key={s.id} value={s.id}>{s.category} — {s.name}</option>)}</select></label>
        <div className="serviceinfo">{selected?.description || "Select a service to view details."}</div>
        <label>Target URL<input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://example.com/your-page" required/></label>
        <div className="two"><label>Quantity<input type="number" min={selected?.min_quantity || 1} max={selected?.max_quantity || 10000} value={quantity} onChange={e => setQuantity(e.target.value)}/></label><div className="estimate"><small>Estimated total</small><b>{money(estimate)}</b></div></div>
        <button className="primary" disabled={loading}>{loading ? "Submitting…" : "Submit order"} <ArrowUpRight size={16}/></button>{notice && <p className="feedback">{notice}</p>}
      </form></section>}
      {page === "Orders" && <section className="panel"><div className="panelhead"><div><h3>Order history</h3><p>Orders saved in your account</p></div><button className="textbtn" onClick={() => loadDashboard().catch(e => setNotice(e.message))}><RefreshCw size={15}/> Refresh</button></div><OrderTable orders={orders}/>{notice && <p className="feedback">{notice}</p>}</section>}
      {page === "Services" && <section className="panel"><div className="panelhead"><div><h3>Service catalogue</h3><p>Available services</p></div></div><div className="servicegrid">{services.map(s => <article className="servicecard" key={s.id}><span className="tag">{s.category}</span><h3>{s.name}</h3><p>{s.description}</p><b>{money(s.unit_price)} <small>/ unit</small></b><small>Min {s.min_quantity} · Max {s.max_quantity}</small></article>)}</div></section>}
      {page === "Add Funds" && <section className="panel"><h3>Wallet & payments</h3><p className="muted">Current balance: <b>{money(balance)}</b></p><div className="notice"><Wallet/><div><b>Payment gateway not connected</b><p>Connect a payment provider and verify signed server-side webhooks before enabling wallet top-ups.</p></div></div></section>}
      {page === "Support" && <Placeholder icon={Headset} title="Support centre" desc="Ticket creation and replies are planned for a future phase."/>}
      {page === "Affiliate" && <Placeholder icon={Users} title="Affiliate programme" desc="Referral links, commission rules and payouts are not enabled yet."/>}
      {page === "API" && <Placeholder icon={Code2} title="Provider API integration" desc="Provider credentials belong on the server only. The provider adapter is not configured yet."/>}
      {page === "Settings" && <Placeholder icon={Settings} title="Settings" desc="Profile and security preferences are planned for a future phase."/>}
      <footer>© {new Date().getFullYear()} Sohel SMM · Starter build</footer>
    </main>
  </div>;
}
function Stat({ icon: Icon, label, value, tone }) { return <div className="stat"><span className={`staticon ${tone}`}><Icon size={19}/></span><div><small>{label}</small><b>{value}</b></div></div>; }
function OrderTable({ orders }) { return <div className="tablewrap"><table><thead><tr><th>ORDER</th><th>SERVICE</th><th>QUANTITY</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{orders.length ? orders.map((o, i) => <tr key={o.id || i}><td>#{o.id}</td><td>{o.service_name || "—"}</td><td>{o.quantity}</td><td>{money(o.amount)}</td><td><span className={`status ${o.status}`}>{o.status}</span></td></tr>) : <tr><td colSpan="5" className="empty">No orders yet. Create your first order.</td></tr>}</tbody></table></div>; }
function Placeholder({ icon: Icon, title, desc }) { return <section className="panel placeholder"><span className="staticon purple"><Icon size={24}/></span><h3>{title}</h3><p>{desc}</p></section>; }
