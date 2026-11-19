import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";
import { signToken, requireAuth, requireAdmin } from "./auth.js";


const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",").map((value) => value.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  }
}));
app.use(express.json({ limit: "200kb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const validEmail = (email) =>
  typeof email === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Server health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "sohel-smm-api" });
});

// Customer registration
app.post("/api/auth/register", authLimiter, asyncHandler(async (req, res) => {
  const { email, password, displayName } = req.body || {};

  if (
    !validEmail(email) ||
    typeof password !== "string" ||
    password.length < 8 ||
    typeof displayName !== "string" ||
    displayName.trim().length < 2
  ) {
    return res.status(400).json({
      error: "Valid email, name and password of at least 8 characters are required."
    });
  }

  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO users(email, display_name, password_hash, role)
       VALUES($1, $2, $3, 'customer')
       RETURNING id, email, display_name, role`,
      [email.trim().toLowerCase(), displayName.trim(), hash]
    );

    const user = result.rows[0];

    await client.query(
      "INSERT INTO wallets(user_id) VALUES($1)",
      [user.id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      user,
      token: signToken(user)
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({ error: "Email already registered." });
    }

    throw error;
  } finally {
    client.release();
  }
}));

// Customer and admin login
app.post("/api/auth/login", authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!validEmail(email) || typeof password !== "string") {
    return res.status(400).json({
      error: "Email and password are required."
    });
  }

  const result = await pool.query(
    `SELECT id, email, display_name, role, password_hash
     FROM users WHERE email=$1`,
    [email.trim().toLowerCase()]
  );

  const user = result.rows[0];

  if (
    !user ||
    !user.password_hash ||
    !(await bcrypt.compare(password, user.password_hash))
  ) {
    return res.status(401).json({
      error: "Invalid email or password."
    });
  }

  delete user.password_hash;

  res.json({
    user,
    token: signToken(user)
  });
}));

// Current logged-in user
app.get("/api/auth/me", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, email, display_name, role, created_at
     FROM users WHERE id=$1`,
    [req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json(result.rows[0]);
}));

// Change password
app.post("/api/auth/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    newPassword.length < 8
  ) {
    return res.status(400).json({
      error: "Enter current password and a new password of at least 8 characters."
    });
  }

  const result = await pool.query(
    "SELECT password_hash FROM users WHERE id=$1",
    [req.user.id]
  );

  if (
    !result.rows[0] ||
    !(await bcrypt.compare(currentPassword, result.rows[0].password_hash))
  ) {
    return res.status(401).json({
      error: "Current password is incorrect."
    });
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await pool.query(
    "UPDATE users SET password_hash=$1 WHERE id=$2",
    [hash, req.user.id]
  );

  res.json({ message: "Password changed successfully." });
}));

// Public active services
app.get("/api/services", asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, category, description, unit_price,
            min_quantity, max_quantity
     FROM services
     WHERE active=true
     ORDER BY category, name`
  );

  res.json(result.rows);
}));

// Customer wallet
app.get("/api/wallet", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT balance, updated_at FROM wallets WHERE user_id=$1",
    [req.user.id]
  );

  res.json({
    balance: result.rows[0]?.balance ?? "0.00",
    currency: "INR"
  });
}));

// Wallet transaction history
app.get("/api/wallet/transactions", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, amount, direction, description, created_at
     FROM wallet_transactions
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.user.id]
  );

  res.json(result.rows);
}));

// Customer orders
app.get("/api/orders", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT o.id, o.target_url, o.quantity, o.amount,
            o.status, o.created_at, s.name AS service_name
     FROM orders o
     JOIN services s ON s.id=o.service_id
     WHERE o.user_id=$1
     ORDER BY o.created_at DESC
     LIMIT 100`,
    [req.user.id]
  );

  res.json(result.rows);
}));

// Create order and deduct wallet balance
app.post("/api/orders", requireAuth, asyncHandler(async (req, res) => {
  const { serviceId, targetUrl, quantity } = req.body || {};
  const serviceNumber = Number(serviceId);
  const qty = Number(quantity);

  if (
    !Number.isSafeInteger(serviceNumber) ||
    !Number.isSafeInteger(qty) ||
    qty <= 0 ||
    typeof targetUrl !== "string" ||
    !/^https:\/\/\S+$/i.test(targetUrl)
  ) {
    return res.status(400).json({
      error: "Enter a valid service, HTTPS URL and quantity."
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const serviceResult = await client.query(
      "SELECT * FROM services WHERE id=$1 AND active=true FOR SHARE",
      [serviceNumber]
    );

    if (!serviceResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Service not found." });
    }

    const service = serviceResult.rows[0];

    if (qty < service.min_quantity || qty > service.max_quantity) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Quantity must be between ${service.min_quantity} and ${service.max_quantity}.`
      });
    }

    const amount = (Number(service.unit_price) * qty).toFixed(2);

    const wallet = await client.query(
      "SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE",
      [req.user.id]
    );

    if (
      !wallet.rows.length ||
      Number(wallet.rows[0].balance) < Number(amount)
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Insufficient wallet balance."
      });
    }

    await client.query(
      `UPDATE wallets
       SET balance=balance-$1, updated_at=NOW()
       WHERE user_id=$2`,
      [amount, req.user.id]
    );

    const order = await client.query(
      `INSERT INTO orders(
        user_id, service_id, target_url, quantity, amount
       )
       VALUES($1, $2, $3, $4, $5)
       RETURNING id, status, amount, created_at`,
      [req.user.id, serviceNumber, targetUrl, qty, amount]
    );

    await client.query(
      `INSERT INTO wallet_transactions(
        user_id, amount, direction, description, reference
       )
       VALUES($1, $2, 'debit', $3, $4)`,
      [
        req.user.id,
        amount,
        `Order #${order.rows[0].id}`,
        `order-${order.rows[0].id}`
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      ...order.rows[0],
      note: "Order saved. Provider API is not connected yet."
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

// Admin dashboard summary
app.get("/api/admin/summary", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const [users, orders, services] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM users"),
    pool.query("SELECT COUNT(*)::int AS count FROM orders"),
    pool.query("SELECT COUNT(*)::int AS count FROM services WHERE active=true")
  ]);

  res.json({
    users: users.rows[0].count,
    orders: orders.rows[0].count,
    activeServices: services.rows[0].count
  });
}));

// Admin: list users
app.get("/api/admin/users", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT id, email, display_name, role, created_at
     FROM users ORDER BY created_at DESC LIMIT 200`
  );

  res.json(result.rows);
}));

// Admin: change user role
app.patch("/api/admin/users/:id/role", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body || {};

  if (
    !Number.isSafeInteger(id) ||
    !["customer", "staff", "admin"].includes(role)
  ) {
    return res.status(400).json({ error: "Invalid user ID or role." });
  }

  if (id === req.user.id) {
    return res.status(400).json({
      error: "You cannot change your own role."
    });
  }

  const result = await pool.query(
    `UPDATE users SET role=$1
     WHERE id=$2
     RETURNING id, email, display_name, role`,
    [role, id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json(result.rows[0]);
}));

// Admin: list all orders
app.get("/api/admin/orders", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT o.*, u.email, s.name AS service_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN services s ON s.id = o.service_id
     ORDER BY o.created_at DESC
     LIMIT 200`
  );
  res.json(result.rows);
}));

// Admin: update order status
app.patch("/api/admin/orders/:id/status", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  const allowed = [
    "pending", "processing", "completed",
    "partial", "cancelled", "failed"
  ];

  if (!Number.isSafeInteger(id) || !allowed.includes(status)) {
    return res.status(400).json({
      error: "Invalid order ID or status."
    });
  }

  const result = await pool.query(
    "UPDATE orders SET status=$1 WHERE id=$2 RETURNING *",
    [status, id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Order not found." });
  }

  res.json(result.rows[0]);
}));

// Admin: add service
app.post("/api/admin/services", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const {
    name,
    category,
    description = "",
    unitPrice,
    minQuantity = 1,
    maxQuantity = 10000
  } = req.body || {};

  if (
    typeof name !== "string" || !name.trim() ||
    typeof category !== "string" || !category.trim() ||
    !Number.isFinite(Number(unitPrice)) ||
    Number(unitPrice) < 0 ||
    !Number.isSafeInteger(Number(minQuantity)) ||
    !Number.isSafeInteger(Number(maxQuantity)) ||
    Number(minQuantity) < 1 ||
    Number(maxQuantity) < Number(minQuantity)
  ) {
    return res.status(400).json({ error: "Invalid service details." });
  }

  const result = await pool.query(
    `INSERT INTO services(
      name, category, description, unit_price,
      min_quantity, max_quantity
     )
     VALUES($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      name.trim(),
      category.trim(),
      String(description),
      Number(unitPrice),
      Number(minQuantity),
      Number(maxQuantity)
    ]
  );

  res.status(201).json(result.rows[0]);
}));

// Admin: activate or deactivate service
app.patch("/api/admin/services/:id/active", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};

  if (!Number.isSafeInteger(id) || typeof active !== "boolean") {
    return res.status(400).json({
      error: "Invalid service ID or active value."
    });
  }

  const result = await pool.query(
    "UPDATE services SET active=$1 WHERE id=$2 RETURNING *",
    [active, id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Service not found." });
  }

  res.json(result.rows[0]);
}));

// Create first admin from environment variables
async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Administrator";

  if (!email || !password) {
    console.log("Admin setup skipped: admin environment values are missing.");
    return;
  }

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const existing = await pool.query(
    "SELECT id FROM users WHERE email=$1",
    [email]
  );

  if (existing.rows.length) {
    console.log("Admin account already exists.");
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO users(email, display_name, password_hash, role)
       VALUES($1, $2, $3, 'admin')
       RETURNING id`,
      [email, name, hash]
    );

    await client.query(
      "INSERT INTO wallets(user_id) VALUES($1)",
      [result.rows[0].id]
    );

    await client.query("COMMIT");
    console.log("First admin account created.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Error handler
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Server error. Please try again." });
});

async function initializeDatabase() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schema = fs.readFileSync(path.join(here, "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("Database schema is ready.");
}

async function start() {
  try {
    await initializeDatabase();
    await bootstrapAdmin();
    app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

start();
