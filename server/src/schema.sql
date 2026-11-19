CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(15, 2) DEFAULT 0.00 CHECK (balance >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('add', 'deduct')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    unit VARCHAR(50) DEFAULT '1,000',
    min_quantity INTEGER NOT NULL DEFAULT 100,
    max_quantity INTEGER NOT NULL DEFAULT 100000,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    target_url TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'in_progress', 'refunded', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
