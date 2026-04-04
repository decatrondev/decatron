-- Migration: DecaCoins Economy System — Parte 1 (Base + Compras)
-- Date: 2026-04-04
-- 11 tables for the complete economy system

-- ============================================
-- COIN SETTINGS (config global, 1 fila)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_settings (
    id SERIAL PRIMARY KEY,
    currency_name TEXT NOT NULL DEFAULT 'DecaCoins',
    currency_icon TEXT NOT NULL DEFAULT 'coins',
    max_transfer_per_day INTEGER NOT NULL DEFAULT 5000,
    max_transfers_per_day INTEGER NOT NULL DEFAULT 10,
    min_transfer_amount INTEGER NOT NULL DEFAULT 10,
    min_account_age_to_transfer_days INTEGER NOT NULL DEFAULT 7,
    min_account_age_to_receive_days INTEGER NOT NULL DEFAULT 3,
    max_referrals_per_user INTEGER,
    referral_bonus_referrer INTEGER NOT NULL DEFAULT 50,
    referral_bonus_referred INTEGER NOT NULL DEFAULT 50,
    referral_min_activity_days INTEGER NOT NULL DEFAULT 7,
    first_purchase_bonus_percent INTEGER NOT NULL DEFAULT 50,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO coin_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================
-- USER COINS (balance global por usuario)
-- ============================================
CREATE TABLE IF NOT EXISTS user_coins (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    balance BIGINT NOT NULL DEFAULT 0,
    total_earned BIGINT NOT NULL DEFAULT 0,
    total_spent BIGINT NOT NULL DEFAULT 0,
    total_transferred_in BIGINT NOT NULL DEFAULT 0,
    total_transferred_out BIGINT NOT NULL DEFAULT 0,
    first_purchase_at TIMESTAMP,
    economy_status TEXT NOT NULL DEFAULT 'normal',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_economy_status CHECK (economy_status IN ('normal', 'flagged', 'banned_economy'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_coins_user_id ON user_coins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coins_economy_status ON user_coins(economy_status);

-- ============================================
-- COIN PACKAGES (paquetes de compra)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_packages (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    coins INTEGER NOT NULL,
    bonus_coins INTEGER NOT NULL DEFAULT 0,
    price_usd DECIMAL(10,2) NOT NULL,
    icon TEXT,
    is_offer BOOLEAN NOT NULL DEFAULT FALSE,
    offer_starts_at TIMESTAMP,
    offer_expires_at TIMESTAMP,
    first_purchase_only BOOLEAN NOT NULL DEFAULT FALSE,
    max_per_transaction INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default packages
INSERT INTO coin_packages (name, description, coins, bonus_coins, price_usd, sort_order) VALUES
    ('Starter', '100 coins para empezar', 100, 0, 1.00, 1),
    ('Popular', '500 coins con 25% bonus', 500, 125, 4.00, 2),
    ('Mega', '1200 coins con 50% bonus', 1200, 600, 8.00, 3),
    ('Ultra', '3000 coins con 100% bonus', 3000, 3000, 15.00, 4)
ON CONFLICT DO NOTHING;

-- ============================================
-- COIN PENDING ORDERS (idempotencia PayPal)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_pending_orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    package_id BIGINT NOT NULL REFERENCES coin_packages(id),
    paypal_order_id TEXT,
    discount_code_id BIGINT,
    final_price_usd DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_pending_status CHECK (status IN ('pending', 'completed', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_coin_pending_user ON coin_pending_orders(user_id, status);

-- ============================================
-- COIN PURCHASES (compras completadas)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_purchases (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    package_id BIGINT NOT NULL REFERENCES coin_packages(id),
    coins_received INTEGER NOT NULL,
    amount_paid_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
    paypal_order_id TEXT,
    paypal_status TEXT,
    discount_code_id BIGINT,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    bonus_coins_from_coupon INTEGER NOT NULL DEFAULT 0,
    bonus_coupon_scheduled_at TIMESTAMP,
    bonus_coupon_credited_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_purchases_user ON coin_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_purchases_paypal ON coin_purchases(paypal_order_id);

-- ============================================
-- COIN TRANSACTIONS (log de toda operación)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    balance_after BIGINT NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    description TEXT,
    related_user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transaction_type CHECK (type IN (
        'purchase', 'admin_gift', 'admin_remove',
        'transfer_in', 'transfer_out',
        'marketplace_buy', 'referral_bonus', 'coupon_bonus'
    ))
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_type ON coin_transactions(type);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created ON coin_transactions(created_at);

-- ============================================
-- COIN TRANSFERS (detalle transferencias)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_transfers (
    id BIGSERIAL PRIMARY KEY,
    from_user_id BIGINT NOT NULL REFERENCES users(id),
    to_user_id BIGINT NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_transfers_from ON coin_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transfers_to ON coin_transfers(to_user_id);

-- ============================================
-- COIN DISCOUNT CODES (cupones)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_discount_codes (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    assigned_user_id BIGINT REFERENCES users(id),
    max_uses INTEGER,
    current_uses INTEGER NOT NULL DEFAULT 0,
    max_uses_per_user INTEGER NOT NULL DEFAULT 1,
    min_purchase_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
    applicable_package_id BIGINT REFERENCES coin_packages(id),
    combinable_with_first_purchase BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_discount_type CHECK (discount_type IN ('percentage', 'fixed_amount', 'bonus_coins'))
);

CREATE INDEX IF NOT EXISTS idx_coin_discount_code ON coin_discount_codes(code);

-- ============================================
-- COIN DISCOUNT USES (uso de cupones)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_discount_uses (
    id BIGSERIAL PRIMARY KEY,
    code_id BIGINT NOT NULL REFERENCES coin_discount_codes(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    purchase_id BIGINT REFERENCES coin_purchases(id),
    discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
    used_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_discount_uses_code ON coin_discount_uses(code_id);
CREATE INDEX IF NOT EXISTS idx_coin_discount_uses_user ON coin_discount_uses(user_id);

-- ============================================
-- COIN REFERRALS (sistema de referidos)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_referrals (
    id BIGSERIAL PRIMARY KEY,
    referrer_user_id BIGINT NOT NULL REFERENCES users(id),
    referred_user_id BIGINT NOT NULL REFERENCES users(id),
    referral_code TEXT NOT NULL,
    bonus_given_to_referrer INTEGER NOT NULL DEFAULT 0,
    bonus_given_to_referred INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_referral_status CHECK (status IN ('pending', 'completed', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_coin_referrals_referrer ON coin_referrals(referrer_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_referrals_referred ON coin_referrals(referred_user_id);

-- ============================================
-- COIN FLAGS (anti-abuso)
-- ============================================
CREATE TABLE IF NOT EXISTS coin_flags (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    flag_type TEXT NOT NULL,
    flag_reason TEXT NOT NULL,
    flag_details JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    resolved_by BIGINT REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_flag_type CHECK (flag_type IN (
        'rapid_transfers', 'high_balance_transfer_new_account',
        'coupon_then_transfer', 'multi_account_ip'
    )),
    CONSTRAINT chk_flag_status CHECK (status IN ('pending', 'resolved_ok', 'resolved_banned'))
);

CREATE INDEX IF NOT EXISTS idx_coin_flags_user ON coin_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_flags_status ON coin_flags(status);

-- ============================================
-- Add referral_code to users table
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
