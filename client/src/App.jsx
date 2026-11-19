import { LayoutDashboard, PlusCircle, ShoppingBag, Layers, Wallet, Headset, Users, Code2, Settings, LogOut, Menu, X, ArrowUpRight, RefreshCw, ShieldCheck from 'lucide-react';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'sohel_smm_token';

const navItemsAdmin = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'services', label: 'Services', icon: Layers },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'add-funds', label: 'Add Funds', icon: Wallet },
  { id: 'api', label: 'API Integration', icon: Code2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const navItemsUser = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new-order', label: 'New Order', icon: PlusCircle },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'add-funds', label: 'Add Funds', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [balance, setBalance] = useState(0);

  const fetchProtectedData = useCallback(async (currentToken) => {
    if (!currentToken) return;
    try {
      const [servicesRes, ordersRes, walletRes] = await Promise.all([
        fetch(`${API}/api/services`, { headers: { Authorization: `Bearer ${currentToken}` } }),
        fetch(`${API}/api/orders`, { headers: { Authorization: `Bearer ${currentToken}` } }),
        fetch(`${API}/api/wallet`, { headers: { Authorization: `Bearer ${currentToken}` } })
      ]);
      if (servicesRes.ok) setServices(await servicesRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (walletRes.ok) {
        const wData = await walletRes.json();
        setBalance(Number(wData.balance || 0));
      }
    } catch (err) {
      console.error('Failed to fetch protected data:', err);
    }
  }, []);

  const checkSession = useCallback(async (currentToken) => {
    if (!currentToken) {
      setSessionLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        fetchProtectedData(currentToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setSessionLoading(false);
    }
  }, [fetchProtectedData]);

  useEffect(() => {
    if (token) {
      checkSession(token);
    } else {
      setSessionLoading(false);
    }
  }, [token, checkSession]);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const getUserLabel = (u) => u?.displayName || u?.email || 'User';

  const normalizeRole = (role) => String(role || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user';

  if (sessionLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLoginSuccess={(t, u) => { setToken(t); setUser(u); fetchProtectedData(t); }} api={API} tokenKey={TOKEN_KEY} />;
  }

  const isAdmin = normalizeRole(user?.role) === 'admin';
  const navItems = isAdmin ? navItemsAdmin : navItemsUser;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span>{isAdmin ? 'ADMIN PANEL' : 'SOHEL SMM PANEL'}</span>
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => { setActiveTab(item.id); setMenuOpen(false); }}
              >
                <IconComponent size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{getUserLabel(user)}</strong>
            <span>Balance: ₹{balance.toFixed(2)}</span>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>
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
          <div className="breadcrumb">
            <h1 className="user-heading">{activeTab.replace('-', ' ').toUpperCase()}</h1>
          </div>
          <div className="balance-pill">
            <span>Balance: ₹{balance.toFixed(2)}</span>
          </div>
        </header>

        <section className="content-pad">
          {isAdmin ? (
            <AdminDashboard
              user={user}
              services={services}
              orders={orders}
              balance={balance}
              api={API}
              token={token}
              onRefresh={() => fetchProtectedData(token)}
            />
          ) : (
            <UserDashboard
              user={user}
              services={services}
              orders={orders}
              balance={balance}
              api={API}
              token={token}
              onOrderPlaced={() => fetchProtectedData(token)}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function AuthScreen({ onLoginSuccess, api }) {
  const [mode, setMode] = useState('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = mode === 'login'
      ? { email: email.trim(), password }
      : { displayName: displayName.trim(), email: email.trim(), password };

    try {
      const res = await fetch(`${api}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed');
      localStorage.setItem(TOKEN_KEY, data.token);
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>SOHEL SMM PANEL</h1>
        <p>{mode === 'login' ? 'Sign in to your account' : 'Create a new account'}</p>
        {errorMsg && <div className="alert error">{errorMsg}</div>}
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              <span>Display Name</span>
              <input type="text" placeholder="Your Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </label>
          )}
          <label>
            <span>Email</span>
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" disabled={loading} className="btn btn-primary primary-bg">
            {loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Register')}
          </button>
        </form>
        <button type="button" className="btn btn-ghost" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrorMsg(''); }}>
          {mode === 'login' ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}

function AdminDashboard({ user, services, orders, api, token }) {
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('10');
  const [actionLoading, setActionLoading] = useState(false);

  const handleAddService = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`${api}/api/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newServiceName,
          category: newServiceCategory,
          price: Number(newServicePrice),
          unit: '1,000',
          min_quantity: 100,
          max_quantity: 100000
        })
      });
      if (!res.ok) throw new Error('Failed to add service');
      setNewServiceName('');
      setNewServiceCategory('');
      alert('Service added!');
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="dashboard-grid">
      <div className="stat-card accent-border">
        <h2>System Overview</h2>
        <p>Welcome back, Admin {user?.displayName}. You have full control over the platform.</p>
        <div className="stats-row">
          <div><strong>{services.length}</strong><span>Services</span></div>
          <div><strong>{orders.length}</strong><span>Total Orders</span></div>
        </div>
      </div>

      <div className="admin-console">
        <h3>Admin Management Tools</h3>
        <form onSubmit={handleAddService} className="admin-form">
          <h4>Add New Service</h4>
          <label><span>Service Name</span><input type="text" placeholder="e.g. Instagram Followers" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} required /></label>
          <label><span>Category</span><input type="text" placeholder="e.g. Social Media Marketing" value={newServiceCategory} onChange={(e) => setNewServiceCategory(e.target.value)} required /></label>
          <label><span>Price per 1,000</span><input type="number" step="0.01" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} required /></label>
          <button type="submit" disabled={actionLoading} className="btn primary-bg">
            {actionLoading ? 'Adding...' : 'Add Service'}
          </button>
        </form>
      </div>
    </div>
  );
}

function UserDashboard({ user, services, orders, balance, api, token, onOrderPlaced }) {
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [submitting, setSubmitting] = useState(false);

  const selectedService = services.find(s => String(s.id) === String(selectedServiceId));
  const calculatedTotal = selectedService ? (Number(selectedService.unit_price || selectedService.price || 0) * Number(quantity)) / 1000 : 0;

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!selectedServiceId || !targetUrl.trim()) return alert('Please fill all fields');
    setSubmitting(true);
    try {
      const res = await fetch(`${api}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ serviceId: selectedServiceId, targetUrl: targetUrl.trim(), quantity: Number(quantity) })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to place order');
      }
      alert('Order placed successfully!');
      setTargetUrl('');
      onOrderPlaced();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-grid">
      <div className="stat-card user-bg">
        <h2>Customer Overview</h2>
        <p>Welcome back, {user?.displayName}. Place orders and track your progress below.</p>
        <div className="stats-row">
          <div><strong>₹{balance.toFixed(2)}</strong><span>Available Balance</span></div>
          <div><strong>{orders.length}</strong><span>Your Orders</span></div>
        </div>
      </div>

      <div className="order-form-container">
        <h3>Place an Order</h3>
        <form onSubmit={handleSubmitOrder}>
          <label>
            <span>Choose Service</span>
            <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} required>
              <option value="">Select a service...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name} - ₹{s.unit_price || s.price} per 1,000</option>
              ))}
            </select>
          </label>
          <label>
            <span>Post / Profile URL</span>
            <input type="url" placeholder="https://example.com/link" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} required />
          </label>
          <label>
            <span>Quantity</span>
            <input type="number" min="10" placeholder="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </label>
          <div className="price-preview">
            <span>Estimated Total:</span>
            <strong>₹{calculatedTotal.toFixed(2)}</strong>
          </div>
          <button type="submit" disabled={submitting} className="btn primary-bg">
            {submitting ? 'Submitting...' : 'Submit Order'}
          </button>
        </form>
      </div>
    </div>
  );
}
