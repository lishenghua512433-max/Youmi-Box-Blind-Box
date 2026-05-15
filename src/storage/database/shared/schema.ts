import { pgTable, serial, timestamp, varchar, numeric, text, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// System table - do not delete
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// Admin settings - single row configuration
export const adminSettings = pgTable("admin_settings", {
  id: serial().primaryKey().default(1),
  price_bnb: numeric("price_bnb", { precision: 18, scale: 8 }).notNull().default("0.1"),
  price_usdt: numeric("price_usdt", { precision: 18, scale: 8 }).notNull().default("50"),
  price_busd: numeric("price_busd", { precision: 18, scale: 8 }).notNull().default("50"),
  price_usdc: numeric("price_usdc", { precision: 18, scale: 8 }).notNull().default("50"),
  price_sol: numeric("price_sol", { precision: 18, scale: 8 }).notNull().default("0.3"),
  price_doge: numeric("price_doge", { precision: 18, scale: 8 }).notNull().default("300"),
  buy_fee_rate: numeric("buy_fee_rate", { precision: 5, scale: 2 }).notNull().default("5"),
  sell_fee_rate: numeric("sell_fee_rate", { precision: 5, scale: 2 }).notNull().default("5"),
  withdraw_fee_rate: numeric("withdraw_fee_rate", { precision: 5, scale: 2 }).notNull().default("5"),
  recycle_normal: numeric("recycle_normal", { precision: 18, scale: 8 }).notNull().default("10"),
  recycle_rare: numeric("recycle_rare", { precision: 18, scale: 8 }).notNull().default("30"),
  recycle_epic: numeric("recycle_epic", { precision: 18, scale: 8 }).notNull().default("80"),
  recycle_legend: numeric("recycle_legend", { precision: 18, scale: 8 }).notNull().default("200"),
  recycle_myth: numeric("recycle_myth", { precision: 18, scale: 8 }).notNull().default("500"),
  prob_normal: numeric("prob_normal", { precision: 5, scale: 2 }).notNull().default("50"),
  prob_rare: numeric("prob_rare", { precision: 5, scale: 2 }).notNull().default("25"),
  prob_epic: numeric("prob_epic", { precision: 5, scale: 2 }).notNull().default("15"),
  prob_legend: numeric("prob_legend", { precision: 5, scale: 2 }).notNull().default("8"),
  prob_myth: numeric("prob_myth", { precision: 5, scale: 2 }).notNull().default("2"),
  commission_l1: numeric("commission_l1", { precision: 5, scale: 2 }).notNull().default("10"),
  commission_l2: numeric("commission_l2", { precision: 5, scale: 2 }).notNull().default("5"),
  commission_l3: numeric("commission_l3", { precision: 5, scale: 2 }).notNull().default("2"),
  nft_contract_address: varchar("nft_contract_address", { length: 66 }).default(""),
  payment_wallet_address: varchar("payment_wallet_address", { length: 66 }).default(""),
  usdt_contract: varchar("usdt_contract", { length: 66 }).default("0x55d398326f99059fF775485246999027B3197955"),
  busd_contract: varchar("busd_contract", { length: 66 }).default("0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"),
  usdc_contract: varchar("usdc_contract", { length: 66 }).default("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"),
  sol_contract: varchar("sol_contract", { length: 66 }).default("0x570A5D26f7765Ecb712C0924E4De545B89fD43dD"),
  doge_contract: varchar("doge_contract", { length: 66 }).default("0xba2ae424d960c26247dd6c32edc70b295c744c43"),
  admin_password: varchar("admin_password", { length: 128 }).notNull().default("123456"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// NFT images per rarity level
export const nftImages = pgTable("nft_images", {
  id: serial().primaryKey(),
  rarity: varchar("rarity", { length: 20 }).notNull(),
  image_url: text("image_url").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("nft_images_rarity_idx").on(table.rarity),
]);

// Users
export const users = pgTable("users", {
  id: serial().primaryKey(),
  wallet_address: varchar("wallet_address", { length: 66 }).notNull().unique(),
  referral_code: varchar("referral_code", { length: 20 }).notNull().unique(),
  parent_code: varchar("parent_code", { length: 20 }),
  parent_l2_code: varchar("parent_l2_code", { length: 20 }),
  parent_l3_code: varchar("parent_l3_code", { length: 20 }),
  commission_balance: numeric("commission_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  total_commission: numeric("total_commission", { precision: 18, scale: 8 }).notNull().default("0"),
  total_spent: numeric("total_spent", { precision: 18, scale: 8 }).notNull().default("0"),
  total_boxes: integer("total_boxes").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("users_wallet_idx").on(table.wallet_address),
  index("users_referral_idx").on(table.referral_code),
  index("users_parent_code_idx").on(table.parent_code),
]);

// NFT inventory
export const nftInventory = pgTable("nft_inventory", {
  id: serial().primaryKey(),
  wallet_address: varchar("wallet_address", { length: 66 }).notNull(),
  rarity: varchar("rarity", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("held"),
  purchase_price: numeric("purchase_price", { precision: 18, scale: 8 }).notNull(),
  purchase_currency: varchar("purchase_currency", { length: 10 }).notNull(),
  sold_price: numeric("sold_price", { precision: 18, scale: 8 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sold_at: timestamp("sold_at", { withTimezone: true }),
}, (table) => [
  index("nft_inventory_wallet_idx").on(table.wallet_address),
  index("nft_inventory_status_idx").on(table.status),
  index("nft_inventory_rarity_idx").on(table.rarity),
]);

// Transactions
export const transactions = pgTable("transactions", {
  id: serial().primaryKey(),
  wallet_address: varchar("wallet_address", { length: 66 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  fee_amount: numeric("fee_amount", { precision: 18, scale: 8 }).notNull().default("0"),
  nft_id: integer("nft_id"),
  tx_hash: varchar("tx_hash", { length: 128 }),
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("transactions_wallet_idx").on(table.wallet_address),
  index("transactions_type_idx").on(table.type),
  index("transactions_created_idx").on(table.created_at),
]);

// Commission records
export const commissions = pgTable("commissions", {
  id: serial().primaryKey(),
  wallet_address: varchar("wallet_address", { length: 66 }).notNull(),
  from_wallet: varchar("from_wallet", { length: 66 }).notNull(),
  level: integer("level").notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("BNB"),
  source_tx_id: integer("source_tx_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("commissions_wallet_idx").on(table.wallet_address),
  index("commissions_from_wallet_idx").on(table.from_wallet),
  index("commissions_level_idx").on(table.level),
]);
