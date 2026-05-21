-- ============================================================
-- Youmi Box Blind Box - Database Migration Script
-- Run this SQL in Supabase SQL Editor to add missing fields
-- ============================================================

-- 1. Add new columns to admin_settings
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS royalty_commission NUMERIC(5,2) NOT NULL DEFAULT '0';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS service_fee NUMERIC(5,2) NOT NULL DEFAULT '0';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS max_withdraw NUMERIC(18,8) NOT NULL DEFAULT '10000';

-- 2. Ensure all existing columns exist (idempotent - ADD COLUMN IF NOT EXISTS)
-- Core pricing
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS price_usdt NUMERIC(18,8) NOT NULL DEFAULT '3';

-- Probabilities
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS prob_fanpin NUMERIC(5,2) NOT NULL DEFAULT '71';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS prob_lingpin NUMERIC(5,2) NOT NULL DEFAULT '22';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS prob_xuanpin NUMERIC(5,2) NOT NULL DEFAULT '5.5';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS prob_xianpin NUMERIC(5,2) NOT NULL DEFAULT '1.2';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS prob_shenpin NUMERIC(5,2) NOT NULL DEFAULT '0.3';

-- Recycle prices
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS recycle_fanpin NUMERIC(18,8) NOT NULL DEFAULT '2.7';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS recycle_lingpin NUMERIC(18,8) NOT NULL DEFAULT '2.9';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS recycle_xuanpin NUMERIC(18,8) NOT NULL DEFAULT '3.3';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS recycle_xianpin NUMERIC(18,8) NOT NULL DEFAULT '4.6';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS recycle_shenpin NUMERIC(18,8) NOT NULL DEFAULT '12';

-- Fee rates
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS trade_fee_rate NUMERIC(5,2) NOT NULL DEFAULT '5';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS recycle_fee_rate NUMERIC(5,2) NOT NULL DEFAULT '5';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS withdraw_fee_rate NUMERIC(5,2) NOT NULL DEFAULT '5';

-- Commission
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS commission_l1 NUMERIC(5,2) NOT NULL DEFAULT '4';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS commission_l2 NUMERIC(5,2) NOT NULL DEFAULT '1';

-- Referral
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS referral_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS min_withdraw NUMERIC(18,8) NOT NULL DEFAULT '5';

-- Wallets & Contracts
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS collection_wallet VARCHAR(66) DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS payout_wallet VARCHAR(66) DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS payout_contract_address VARCHAR(66) DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS usdt_contract VARCHAR(66) DEFAULT '0x55d398326f99059fF775485246999027B3197955';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS busd_contract VARCHAR(66) DEFAULT '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS trx_contract VARCHAR(66) DEFAULT '0x570A5D26f7765Ecb712C0924E4De545B89fD43dD';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS nft_contract_address VARCHAR(66) DEFAULT '';

-- Admin
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS admin_password VARCHAR(128) NOT NULL DEFAULT '123456';

-- Timestamps
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Ensure seed row exists (upsert with id=1)
INSERT INTO admin_settings (id, price_usdt, prob_fanpin, prob_lingpin, prob_xuanpin, prob_xianpin, prob_shenpin,
  recycle_fanpin, recycle_lingpin, recycle_xuanpin, recycle_xianpin, recycle_shenpin,
  trade_fee_rate, recycle_fee_rate, withdraw_fee_rate,
  commission_l1, commission_l2, royalty_commission, service_fee,
  referral_enabled, min_withdraw, max_withdraw,
  collection_wallet, payout_wallet, payout_contract_address,
  usdt_contract, busd_contract, trx_contract, nft_contract_address,
  admin_password)
VALUES (1, 3, 71, 22, 5.5, 1.2, 0.3,
  2.7, 2.9, 3.3, 4.6, 12,
  5, 5, 5,
  4, 1, 0, 0,
  true, 5, 10000,
  '', '', '',
  '0x55d398326f99059fF775485246999027B3197955', '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', '0x570A5D26f7765Ecb712C0924E4De545B89fD43dD', '',
  '123456')
ON CONFLICT (id) DO UPDATE SET
  royalty_commission = COALESCE(admin_settings.royalty_commission, EXCLUDED.royalty_commission),
  service_fee = COALESCE(admin_settings.service_fee, EXCLUDED.service_fee),
  max_withdraw = COALESCE(admin_settings.max_withdraw, EXCLUDED.max_withdraw),
  updated_at = NOW();

-- 4. Ensure all other tables exist
CREATE TABLE IF NOT EXISTS nft_images (
  id SERIAL PRIMARY KEY,
  rarity VARCHAR(20) NOT NULL UNIQUE,
  image_url VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(66) NOT NULL UNIQUE,
  referral_code VARCHAR(20) NOT NULL UNIQUE,
  parent_code VARCHAR(20),
  parent_l2_code VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nft_inventory (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(66) NOT NULL,
  rarity VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'held',
  purchase_price NUMERIC(18,8) NOT NULL,
  purchase_currency VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ,
  gifted_to VARCHAR(66),
  gifted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS commissions (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(66) NOT NULL,
  from_wallet VARCHAR(66) NOT NULL,
  level INTEGER NOT NULL,
  amount NUMERIC(18,8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_listings (
  id SERIAL PRIMARY KEY,
  nft_id INTEGER NOT NULL REFERENCES nft_inventory(id),
  seller_wallet VARCHAR(66) NOT NULL,
  rarity VARCHAR(20) NOT NULL,
  price NUMERIC(18,8) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(66) NOT NULL,
  type VARCHAR(30) NOT NULL,
  amount NUMERIC(18,8) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USDT',
  fee_amount NUMERIC(18,8) NOT NULL DEFAULT '0',
  nft_id INTEGER,
  related_wallet VARCHAR(66),
  tx_hash VARCHAR(128),
  quantity INTEGER NOT NULL DEFAULT 1,
  receive_amount NUMERIC(18,8) NOT NULL DEFAULT '0',
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable RLS (Row Level Security)
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies: allow service_role full access, anon read-only
-- (These may already exist; use CREATE OR REPLACE or IF NOT EXISTS pattern)

DO $$ BEGIN
  -- admin_settings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'service_all_admin_settings') THEN
    CREATE POLICY service_all_admin_settings ON admin_settings FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'anon_read_admin_settings') THEN
    CREATE POLICY anon_read_admin_settings ON admin_settings FOR SELECT USING (true);
  END IF;

  -- nft_images
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nft_images' AND policyname = 'service_all_nft_images') THEN
    CREATE POLICY service_all_nft_images ON nft_images FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nft_images' AND policyname = 'anon_read_nft_images') THEN
    CREATE POLICY anon_read_nft_images ON nft_images FOR SELECT USING (true);
  END IF;

  -- users
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'service_all_users') THEN
    CREATE POLICY service_all_users ON users FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'anon_read_users') THEN
    CREATE POLICY anon_read_users ON users FOR SELECT USING (true);
  END IF;

  -- nft_inventory
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nft_inventory' AND policyname = 'service_all_nft_inventory') THEN
    CREATE POLICY service_all_nft_inventory ON nft_inventory FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nft_inventory' AND policyname = 'anon_read_nft_inventory') THEN
    CREATE POLICY anon_read_nft_inventory ON nft_inventory FOR SELECT USING (true);
  END IF;

  -- commissions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commissions' AND policyname = 'service_all_commissions') THEN
    CREATE POLICY service_all_commissions ON commissions FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commissions' AND policyname = 'anon_read_commissions') THEN
    CREATE POLICY anon_read_commissions ON commissions FOR SELECT USING (true);
  END IF;

  -- trade_listings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trade_listings' AND policyname = 'service_all_trade_listings') THEN
    CREATE POLICY service_all_trade_listings ON trade_listings FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trade_listings' AND policyname = 'anon_read_trade_listings') THEN
    CREATE POLICY anon_read_trade_listings ON trade_listings FOR SELECT USING (true);
  END IF;

  -- transactions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'service_all_transactions') THEN
    CREATE POLICY service_all_transactions ON transactions FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'anon_read_transactions') THEN
    CREATE POLICY anon_read_transactions ON transactions FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- Migration complete!
-- 
-- Field mapping reference (user requested → database column):
--   receiver_wallet     → collection_wallet (already exists)
--   admin_wallet        → payout_wallet (already exists)
--   box_price           → price_usdt (already exists)
--   payout_contract_address → already exists
--   royalty_commission  → NEW (added above)
--   service_fee         → NEW (added above)
--   min_withdraw_amount → min_withdraw (already exists)
--   max_withdraw_amount → max_withdraw (NEW, added above)
--   recycle_common      → recycle_fanpin (凡品/Common)
--   recycle_rare        → recycle_lingpin (灵品/Rare)
--   recycle_epic        → recycle_xuanpin (玄品/Epic)
--   recycle_legendary   → recycle_xianpin (仙品/Legendary)
--   (神品/Shenpin/Mythic → recycle_shenpin, already exists)
-- ============================================================
