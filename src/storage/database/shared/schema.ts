import { pgTable, serial, varchar, numeric, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const adminSettings = pgTable('admin_settings', {
  id: serial('id').primaryKey(),
  priceUsdt: numeric('price_usdt', { precision: 18, scale: 8 }).notNull().default('3'),
  probFanpin: numeric('prob_fanpin', { precision: 5, scale: 2 }).notNull().default('71'),
  probLingpin: numeric('prob_lingpin', { precision: 5, scale: 2 }).notNull().default('22'),
  probXuanpin: numeric('prob_xuanpin', { precision: 5, scale: 2 }).notNull().default('5.5'),
  probXianpin: numeric('prob_xianpin', { precision: 5, scale: 2 }).notNull().default('1.2'),
  probShenpin: numeric('prob_shenpin', { precision: 5, scale: 2 }).notNull().default('0.3'),
  recycleFanpin: numeric('recycle_fanpin', { precision: 18, scale: 8 }).notNull().default('2.7'),
  recycleLingpin: numeric('recycle_lingpin', { precision: 18, scale: 8 }).notNull().default('2.9'),
  recycleXuanpin: numeric('recycle_xuanpin', { precision: 18, scale: 8 }).notNull().default('3.3'),
  recycleXianpin: numeric('recycle_xianpin', { precision: 18, scale: 8 }).notNull().default('4.6'),
  recycleShenpin: numeric('recycle_shenpin', { precision: 18, scale: 8 }).notNull().default('12'),
  tradeFeeRate: numeric('trade_fee_rate', { precision: 5, scale: 2 }).notNull().default('5'),
  recycleFeeRate: numeric('recycle_fee_rate', { precision: 5, scale: 2 }).notNull().default('5'),
  withdrawFeeRate: numeric('withdraw_fee_rate', { precision: 5, scale: 2 }).notNull().default('5'),
  commissionL1: numeric('commission_l1', { precision: 5, scale: 2 }).notNull().default('4'),
  commissionL2: numeric('commission_l2', { precision: 5, scale: 2 }).notNull().default('1'),
  referralEnabled: boolean('referral_enabled').notNull().default(true),
  minWithdraw: numeric('min_withdraw', { precision: 18, scale: 8 }).notNull().default('5'),
  collectionWallet: varchar('collection_wallet', { length: 66 }).default(''),
  payoutWallet: varchar('payout_wallet', { length: 66 }).default(''),
  usdtContract: varchar('usdt_contract', { length: 66 }).default('0x55d398326f99059fF775485246999027B3197955'),
  busdContract: varchar('busd_contract', { length: 66 }).default('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'),
  trxContract: varchar('trx_contract', { length: 66 }).default('0x570A5D26f7765Ecb712C0924E4De545B89fD43dD'),
  nftContractAddress: varchar('nft_contract_address', { length: 66 }).default(''),
  adminPassword: varchar('admin_password', { length: 128 }).notNull().default('123456'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const nftImages = pgTable('nft_images', {
  id: serial('id').primaryKey(),
  rarity: varchar('rarity', { length: 20 }).notNull().unique(),
  imageUrl: varchar('image_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  walletAddress: varchar('wallet_address', { length: 66 }).notNull().unique(),
  referralCode: varchar('referral_code', { length: 20 }).notNull().unique(),
  parentCode: varchar('parent_code', { length: 20 }),
  parentL2Code: varchar('parent_l2_code', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const nftInventory = pgTable('nft_inventory', {
  id: serial('id').primaryKey(),
  walletAddress: varchar('wallet_address', { length: 66 }).notNull(),
  rarity: varchar('rarity', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('held'),
  purchasePrice: numeric('purchase_price', { precision: 18, scale: 8 }).notNull(),
  purchaseCurrency: varchar('purchase_currency', { length: 10 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  soldAt: timestamp('sold_at', { withTimezone: true }),
  giftedTo: varchar('gifted_to', { length: 66 }),
  giftedAt: timestamp('gifted_at', { withTimezone: true }),
});

export const commissions = pgTable('commissions', {
  id: serial('id').primaryKey(),
  walletAddress: varchar('wallet_address', { length: 66 }).notNull(),
  fromWallet: varchar('from_wallet', { length: 66 }).notNull(),
  level: integer('level').notNull(),
  amount: numeric('amount', { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tradeListings = pgTable('trade_listings', {
  id: serial('id').primaryKey(),
  nftId: integer('nft_id').notNull().references(() => nftInventory.id),
  sellerWallet: varchar('seller_wallet', { length: 66 }).notNull(),
  rarity: varchar('rarity', { length: 20 }).notNull(),
  price: numeric('price', { precision: 18, scale: 8 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  walletAddress: varchar('wallet_address', { length: 66 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('USDT'),
  feeAmount: numeric('fee_amount', { precision: 18, scale: 8 }).notNull().default('0'),
  nftId: integer('nft_id'),
  relatedWallet: varchar('related_wallet', { length: 66 }),
  txHash: varchar('tx_hash', { length: 128 }),
  quantity: integer('quantity').notNull().default(1),
  receiveAmount: numeric('receive_amount', { precision: 18, scale: 8 }).notNull().default('0'),
  status: varchar('status', { length: 20 }).notNull().default('completed'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
