
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer','staff','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- पुराने database में भी password_hash जोड़ें
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
  min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity > 0),
  max_quantity INTEGER NOT NULL DEFAULT 10000
    CHECK (max_quantity >= min_quantity),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  balance NUMERIC(14,2) NOT NULL DEFAULT 0
    CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL,
  direction TEXT NOT NULL
    CHECK (direction IN ('credit','debit')),
  description TEXT NOT NULL,
  reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  service_id BIGINT NOT NULL REFERENCES services(id),
  target_url TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending','processing','completed',
      'partial','cancelled','failed'
    )),
  provider_order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_created
ON orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
ON wallet_transactions(user_id, created_at DESC);

INSERT INTO services
(name, category, description, unit_price, min_quantity, max_quantity)
SELECT *
FROM (VALUES
  ('Social media content audit','Consulting',
   'Review of public-facing content and improvement recommendations.',
   199.00,1,10),
  ('Content calendar setup','Content Planning',
   'A tailored content calendar for a brand or creator.',
   499.00,1,5),
  ('Profile optimisation review','Consulting',
   'Recommendations for profile clarity and discoverability.',
   149.00,1,20),
  ('Campaign reporting setup','Analytics',
   'Set up a reporting template for compliant marketing campaigns.',
   299.00,1,10)
) AS v(name,category,description,unit_price,min_quantity,max_quantity)
WHERE NOT EXISTS (SELECT 1 FROM services);
