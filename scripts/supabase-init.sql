-- ============================================================
-- Youmi Box Blind Box - Supabase Database Initialization
-- ============================================================
-- Execute this ENTIRE script in Supabase SQL Editor (Dashboard → SQL Editor)
-- This will create all tables, RLS policies, and seed data.
-- ============================================================

-- 1. admin_settings (global configuration)
CREATE TABLE IF NOT EXISTS admin_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  price_usdt numeric(18,8) NOT NULL DEFAULT 3,
  prob_fanpin numeric(5,2) NOT NULL DEFAULT 71,
  prob_lingpin numeric(5,2) NOT NULL DEFAULT 22,
  prob_xuanpin numeric(5,2) NOT NULL DEFAULT 5.5,
  prob_xianpin numeric(5,2) NOT NULL DEFAULT 1.2,
  prob_shenpin numeric(5,2) NOT NULL DEFAULT 0.3,
  recycle_fanpin numeric(18,8) NOT NULL DEFAULT 2.7,
  recycle_lingpin numeric(18,8) NOT NULL DEFAULT 2.9,
  recycle_xuanpin numeric(18,8) NOT NULL DEFAULT 3.3,
  recycle_xianpin numeric(18,8) NOT NULL DEFAULT 4.6,
  recycle_shenpin numeric(18,8) NOT NULL DEFAULT 12,
  trade_fee_rate numeric(5,2) NOT NULL DEFAULT 5,
  recycle_fee_rate numeric(5,2) NOT NULL DEFAULT 5,
  withdraw_fee_rate numeric(5,2) NOT NULL DEFAULT 5,
  commission_l1 numeric(5,2) NOT NULL DEFAULT 4,
  commission_l2 numeric(5,2) NOT NULL DEFAULT 1,
  referral_enabled boolean NOT NULL DEFAULT true,
  min_withdraw numeric(18,8) NOT NULL DEFAULT 5,
  collection_wallet varchar(66) DEFAULT '',
  payout_wallet varchar(66) DEFAULT '',
  payout_contract_address varchar(66) DEFAULT '',
  usdt_contract varchar(66) DEFAULT '0x55d398326f99059fF775485246999027B3197955',
  busd_contract varchar(66) DEFAULT '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  trx_contract varchar(66) DEFAULT '0x570A5D26f7765Ecb712C0924E4De545B89fD43dD',
  nft_contract_address varchar(66) DEFAULT '',
  admin_password varchar(128) NOT NULL DEFAULT '123456',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. nft_images (NFT tier image mapping)
CREATE TABLE IF NOT EXISTS nft_images (
  id serial PRIMARY KEY,
  rarity varchar(20) NOT NULL UNIQUE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. users (wallet & referral)
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  wallet_address varchar(66) NOT NULL UNIQUE,
  referral_code varchar(20) NOT NULL UNIQUE,
  parent_code varchar(20),
  parent_l2_code varchar(20),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. nft_inventory (NFT holdings)
CREATE TABLE IF NOT EXISTS nft_inventory (
  id serial PRIMARY KEY,
  wallet_address varchar(66) NOT NULL,
  rarity varchar(20) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'held',
  purchase_price numeric(18,8) NOT NULL,
  purchase_currency varchar(10) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz,
  gifted_to varchar(66),
  gifted_at timestamptz
);

-- 5. commissions (referral earnings)
CREATE TABLE IF NOT EXISTS commissions (
  id serial PRIMARY KEY,
  wallet_address varchar(66) NOT NULL,
  from_wallet varchar(66) NOT NULL,
  level integer NOT NULL,
  amount numeric(18,8) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. trade_listings (marketplace listings)
CREATE TABLE IF NOT EXISTS trade_listings (
  id serial PRIMARY KEY,
  nft_id integer NOT NULL REFERENCES nft_inventory(id),
  seller_wallet varchar(66) NOT NULL,
  rarity varchar(20) NOT NULL,
  price numeric(18,8) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

-- 7. transactions (all financial records)
CREATE TABLE IF NOT EXISTS transactions (
  id serial PRIMARY KEY,
  wallet_address varchar(66) NOT NULL,
  type varchar(30) NOT NULL,
  amount numeric(18,8) NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'USDT',
  fee_amount numeric(18,8) NOT NULL DEFAULT 0,
  nft_id integer,
  related_wallet varchar(66),
  tx_hash varchar(128),
  quantity integer NOT NULL DEFAULT 1,
  receive_amount numeric(18,8) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Enable RLS on ALL tables
-- ============================================================
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: service_role full access (bypasses RLS automatically)
-- anon: read-only for non-sensitive tables, no access to sensitive tables
-- ============================================================

-- admin_settings: anon can read (needed by frontend), only service_role can write
DO $$ BEGIN
  CREATE POLICY "anon read on admin_settings" ON admin_settings FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "anon read on nft_images" ON nft_images FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "anon read on trade_listings" ON trade_listings FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Note: service_role key bypasses ALL RLS policies by default.
-- No need to create explicit policies for service_role.
-- If you use anon key for API routes, RLS will block writes.

-- ============================================================
-- Seed Data
-- ============================================================

-- admin_settings: single row
INSERT INTO admin_settings (id, collection_wallet, payout_wallet)
VALUES (1, '0x61866D26BC800D3Ce52cD4Ca82857f53F7C546C5', '0x61866D26BC800D3Ce52cD4Ca82857f53F7C546C5')
ON CONFLICT (id) DO NOTHING;

-- nft_images: 5 tiers
INSERT INTO nft_images (rarity, image_url) VALUES
  ('fanpin', '/nft/fanpin.svg'),
  ('lingpin', '/nft/lingpin.svg'),
  ('xuanpin', '/nft/xuanpin.svg'),
  ('xianpin', '/nft/xianpin.svg'),
  ('shenpin', '/nft/shenpin.svg')
ON CONFLICT (rarity) DO NOTHING;

-- ============================================================
-- Verification queries (run these to confirm setup)
-- ============================================================
-- SELECT * FROM admin_settings WHERE id = 1;
-- SELECT * FROM nft_images ORDER BY id;
