import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';
import { signToken, requireAuth, requireAdmin } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Origin is not allowed by CORS."));
  }
}));
app.use(express.json({ limit: "200kb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const validEmail = (email) => typeof email === 'string' && /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: "sohel-smm-api" });
});

app.post('/api/auth/register', authLimiter, asyncHandler(async (req, res) => {
  const { email, password, displayName } = req.body || {};
  if (!validEmail(email) || typeof password !== 'string' || password.length < 8 || typeof displayName !== 'string' || displayName.trim().length < 2) {
    return res.status(400).json({ error: "Valid email, name and password of at least 8 characters are required." });
  }
  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roleCheck = await client.query("SELECT COUNT(*) FROM users");
    const isFirstUser = Number(roleCheck.rows[0].count) === 0;
    const assignedRole = isFirstUser ? 'admin' : 'customer';
    const userResult = await client.query(
      "INSERT INTO users(email, display_name, password_hash, role) VALUES($1, $2, $3, $4) RETURNING id, email, display_name, role",
      [email.trim().toLowerCase(), displayName.trim(), hash, assignedRole]
    );
    const user = userResult.rows[0];
    await client.query("INSERT INTO wallets(user_id) VALUES($1)", [user.id]);
    await client.query("COMMIT");
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === '23505') return res.status(409).json({ error: "Email already registered." });
    throw err;
  } finally {
    client.release();
  }
}));

app.post('/api/auth/login', authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!validEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: "Invalid email or password." });
  }
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const token = signToken({ id: user.id, email: user.email, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role } });
}));

app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT id, email, display_name, role FROM users WHERE id = $1", [req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "User not found." });
  res.json(result.rows[0]);
}));

app.get('/api/services', asyncHandler(async (_req, res) => {
  const result = await pool.query("SELECT id, name, category, price AS unit_price, min_quantity, max_quantity FROM services ORDER BY category ASC, id ASC");
  res.json(result.rows[0] ? result.rows : []);
}));

app.get('/api/wallet', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT balance, updated_at FROM wallets WHERE user_id=$1", [req.user.id]);
  res.json(result.rows[0] || { balance: "0.00" });
}));

app.get('/api/wallet/transactions', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, amount, direction, description, created_at FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
    [req.user.id]
  );
  res.json(result.rows);
}));

app.get('/api/orders', requireAuth, asyncHandler(async (req, res) => {
  const isAdmin = String(req.user.role).trim().toLowerCase() === 'admin';
  let query = `
    SELECT o.id, o.target_url, o.quantity, o.amount, o.status, o.created_at, s.name AS service_name, u.email AS user_email
    FROM orders o
    JOIN services s ON s.id = o.service_id
    JOIN users u ON u.id = o.user_id
  `;
  const params = [];
  if (!isAdmin) {
    query += " WHERE o.user_id = $1";
    params.push(req.user.id);
  }
  query += " ORDER BY o.created_at DESC LIMIT 100";
  const result = await pool.query(query, params);
  res.json(result.rows);
}));

app.post('/api/orders', requireAuth, asyncHandler(async (req, res) => {
  const { serviceId, targetUrl, quantity } = req.body || {};
  const sId = Number(serviceId);
  const qty = Number(quantity);
  if (!Number.isSafeInteger(sId) || typeof targetUrl !== 'string' || !targetUrl.trim() || !Number.isSafeInteger(qty) || qty < 1) {
    return res.status(400).json({ error: "Invalid order parameters." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sRes = await client.query("SELECT price, min_quantity, max_quantity FROM services WHERE id = $1 FOR UPDATE", [sId]);
    const service = sRes.rows[0];
    if (!service) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Service not found." });
    }
    if (qty < service.min_quantity || qty > service.max_quantity) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Quantity must be between ${service.min_quantity} and ${service.max_quantity}.` });
    }

    const unitPrice = Number(service.price);
    const totalAmount = (unitPrice * qty) / 1000;

    const wRes = await client.query("SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE", [req.user.id]);
    const wallet = wRes.rows[0];
    if (!wallet || Number(wallet.balance) < totalAmount) {
      await client.query("ROLLBACK");
      return res.status(402).json({ error: "Insufficient balance." });
    }

    await client.query("UPDATE wallets SET balance = balance - $1 WHERE user_id = $2", [totalAmount, req.user.id]);
    const oInsert = await client.query(
      "INSERT INTO orders(user_id, service_id, target_url, quantity, amount, status) VALUES($1, $2, $3, $4, $5, 'processing') RETURNING id",
      [req.user.id, sId, targetUrl.trim(), qty, totalAmount]
    );

    await client.query("COMMIT");
    res.status(201).json({ orderId: oInsert.rows[0].id, deducted: totalAmount });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

app.get('/api/admin/users', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const result = await pool.query("SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at DESC");
  res.json(result.rows);
}));

app.post('/api/admin/services', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, category, price, unit, min_quantity, max_quantity } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || typeof category !== 'string' || !category.trim() || typeof price !== 'number' || isNaN(price) || price < 0) {
    return res.status(400).json({ error: "Invalid service details." });
  }
  const result = await pool.query(
    "INSERT INTO services(name, category, price, unit, min_quantity, max_quantity) VALUES($1, $2, $3, $4, $5, $6) RETURNING id",
    [name.trim(), category.trim(), price, unit || '1,000', min_quantity || 100, max_quantity || 100000]
  );
  res.status(201).json({ id: result.rows[0].id });
}));

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Server is live on port ${PORT}`);
});
