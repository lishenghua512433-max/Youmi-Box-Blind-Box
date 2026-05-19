# 优秘盒盲盒 - Windows 部署全教程（小白版）

> 从零开始，一步一步在 Windows 上部署本项目

---

## 目录

1. [安装基础环境](#1-安装基础环境)
2. [创建 Supabase 数据库](#2-创建-supabase-数据库)
3. [初始化数据库表](#3-初始化数据库表)
4. [下载项目代码](#4-下载项目代码)
5. [配置环境变量](#5-配置环境变量)
6. [安装依赖并启动](#6-安装依赖并启动)
7. [验证部署成功](#7-验证部署成功)
8. [后台管理配置](#8-后台管理配置)
9. [常见问题](#9-常见问题)

---

## 1. 安装基础环境

### 1.1 安装 Node.js（必装）

1. 打开浏览器访问 https://nodejs.org
2. 下载 **LTS 版本**（长期支持版，左边的按钮）
3. 双击安装包，**一路点 Next**，全部默认即可
4. 安装完成后，按 `Win + R`，输入 `cmd`，回车打开命令行
5. 输入以下命令确认安装成功：
```bash
node -v
# 应显示 v20.x.x 或更高版本

npm -v
# 应显示 10.x.x 或更高版本
```

### 1.2 安装 pnpm（必装）

在命令行中执行：
```bash
npm install -g pnpm
```

确认安装：
```bash
pnpm -v
# 应显示版本号
```

### 1.3 安装 Git（推荐）

1. 访问 https://git-scm.com/download/win
2. 下载并安装，全部默认选项
3. 命令行验证：
```bash
git --version
```

---

## 2. 创建 Supabase 数据库

Supabase 是免费云数据库服务，提供 PostgreSQL 数据库。

### 2.1 注册账号

1. 打开 https://supabase.com
2. 点击 **Start your project**
3. 用 GitHub 账号或邮箱注册登录

### 2.2 创建项目

1. 登录后点击 **New Project**
2. 填写信息：
   - **Name**（项目名）：`youmi-box`（随便取）
   - **Database Password**（数据库密码）：**记住这个密码！** 建议复制保存到记事本
   - **Region**（地区）：选 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**
3. 点击 **Create new project**，等待约 2 分钟创建完成

### 2.3 获取连接密钥

1. 项目创建完成后，点击左侧菜单 **Settings**（齿轮图标）
2. 点击 **API**
3. 找到以下三个值，**全部复制保存到记事本**：

| 字段 | 位置 | 示例格式 |
|------|------|---------|
| **Project URL** | Config > URL | `https://abcdefgh.supabase.co` |
| **anon public** | Project API keys > anon public | `eyJhbGciOiJIUzI1NiIs...`（很长的字符串） |
| **service_role** | Project API keys > service_role | `eyJhbGciOiJIUzI1NiIs...`（很长的字符串） |

> ⚠️ **service_role 密钥拥有管理员权限，千万不要公开分享！**

---

## 3. 初始化数据库表

### 3.1 打开 SQL 编辑器

1. 在 Supabase 项目页面，点击左侧菜单 **SQL Editor**
2. 点击 **New query**

### 3.2 执行建表 SQL

将以下 **全部 SQL** 复制粘贴到编辑器中，点击 **Run** 执行：

```sql
-- =============================================
-- 优秘盒盲盒 数据库建表脚本
-- =============================================

-- 1. 管理员设置表（全局配置，仅一条记录）
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  price_usdt NUMERIC(18,8) NOT NULL DEFAULT '3',
  prob_fanpin NUMERIC(5,2) NOT NULL DEFAULT '71',
  prob_lingpin NUMERIC(5,2) NOT NULL DEFAULT '22',
  prob_xuanpin NUMERIC(5,2) NOT NULL DEFAULT '5.5',
  prob_xianpin NUMERIC(5,2) NOT NULL DEFAULT '1.2',
  prob_shenpin NUMERIC(5,2) NOT NULL DEFAULT '0.3',
  recycle_fanpin NUMERIC(18,8) NOT NULL DEFAULT '2.7',
  recycle_lingpin NUMERIC(18,8) NOT NULL DEFAULT '2.9',
  recycle_xuanpin NUMERIC(18,8) NOT NULL DEFAULT '3.3',
  recycle_xianpin NUMERIC(18,8) NOT NULL DEFAULT '4.6',
  recycle_shenpin NUMERIC(18,8) NOT NULL DEFAULT '12',
  trade_fee_rate NUMERIC(5,2) NOT NULL DEFAULT '5',
  recycle_fee_rate NUMERIC(5,2) NOT NULL DEFAULT '5',
  withdraw_fee_rate NUMERIC(5,2) NOT NULL DEFAULT '5',
  commission_l1 NUMERIC(5,2) NOT NULL DEFAULT '4',
  commission_l2 NUMERIC(5,2) NOT NULL DEFAULT '1',
  referral_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  min_withdraw NUMERIC(18,8) NOT NULL DEFAULT '5',
  collection_wallet VARCHAR(66) DEFAULT '',
  payout_wallet VARCHAR(66) DEFAULT '',
  usdt_contract VARCHAR(66) DEFAULT '0x55d398326f99059fF775485246999027B3197955',
  busd_contract VARCHAR(66) DEFAULT '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  trx_contract VARCHAR(66) DEFAULT '0x570A5D26f7765Ecb712C0924E4De545B89fD43dD',
  nft_contract_address VARCHAR(66) DEFAULT '',
  admin_password VARCHAR(128) NOT NULL DEFAULT '123456',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. NFT 品级图片表
CREATE TABLE IF NOT EXISTS nft_images (
  id SERIAL PRIMARY KEY,
  rarity VARCHAR(20) NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. 用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(66) NOT NULL UNIQUE,
  referral_code VARCHAR(20) NOT NULL UNIQUE,
  parent_code VARCHAR(20),
  parent_l2_code VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS users_wallet_idx ON users(wallet_address);
CREATE INDEX IF NOT EXISTS users_referral_idx ON users(referral_code);

-- 4. NFT 藏品表
CREATE TABLE IF NOT EXISTS nft_inventory (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(66) NOT NULL,
  rarity VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'held',
  purchase_price NUMERIC(18,8) NOT NULL,
  purchase_currency VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  sold_at TIMESTAMP WITH TIME ZONE,
  gifted_to VARCHAR(66),
  gifted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS nft_inventory_wallet_idx ON nft_inventory(wallet_address);
CREATE INDEX IF NOT EXISTS nft_inventory_status_idx ON nft_inventory(status);

-- 5. 交易市场挂单表
CREATE TABLE IF NOT EXISTS trade_listings (
  id SERIAL PRIMARY KEY,
  nft_id INTEGER NOT NULL REFERENCES nft_inventory(id),
  seller_wallet VARCHAR(66) NOT NULL,
  rarity VARCHAR(20) NOT NULL,
  price NUMERIC(18,8) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS trade_seller_idx ON trade_listings(seller_wallet);
CREATE INDEX IF NOT EXISTS trade_status_idx ON trade_listings(status);

-- 6. 交易记录表
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_wallet_idx ON transactions(wallet_address);
CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions(type);
CREATE INDEX IF NOT EXISTS transactions_created_idx ON transactions(created_at);

-- 7. 佣金记录表
CREATE TABLE IF NOT EXISTS commissions (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(66) NOT NULL,
  from_wallet VARCHAR(66) NOT NULL,
  level INTEGER NOT NULL,
  amount NUMERIC(18,8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS commissions_wallet_idx ON commissions(wallet_address);

-- =============================================
-- 开启 RLS + 允许全访问策略
-- =============================================
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on admin_settings" ON admin_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on nft_images" ON nft_images FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on nft_inventory" ON nft_inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on trade_listings" ON trade_listings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on commissions" ON commissions FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 初始化默认数据
-- =============================================

-- 插入管理员默认设置
INSERT INTO admin_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 插入默认 NFT 品级图片
INSERT INTO nft_images (rarity, image_url) VALUES
  ('fanpin', '/nft/fanpin.svg'),
  ('lingpin', '/nft/lingpin.svg'),
  ('xuanpin', '/nft/xuanpin.svg'),
  ('xianpin', '/nft/xianpin.svg'),
  ('shenpin', '/nft/shenpin.svg')
ON CONFLICT (rarity) DO NOTHING;
```

### 3.3 确认建表成功

1. 点击左侧菜单 **Table Editor**
2. 应该能看到 7 张表：`admin_settings`、`nft_images`、`users`、`nft_inventory`、`trade_listings`、`transactions`、`commissions`
3. 点击 `admin_settings` 表，应能看到 1 条默认记录
4. 点击 `nft_images` 表，应能看到 5 条品级图片记录

---

## 4. 下载项目代码

### 方式一：Git 克隆（推荐）

```bash
# 在命令行中执行，进入你想放项目的目录
cd D:\
git clone https://你的仓库地址 youmi-box
cd youmi-box
```

### 方式二：下载 ZIP

1. 在代码仓库页面点击 **Code** > **Download ZIP**
2. 解压到 `D:\youmi-box`
3. 打开命令行进入目录：
```bash
cd D:\youmi-box
```

---

## 5. 配置环境变量

这是最关键的一步！**环境变量配置错误 = 全站 500 错误**

### 5.1 创建环境变量文件

在项目根目录（如 `D:\youmi-box`）创建文件 `.env.local`：

> ⚠️ 文件名是 `.env.local`，注意前面有个点！
> Windows 资源管理器可能不让创建以点开头的文件名，请用命令行：

```bash
# 在项目根目录下执行
cd D:\youmi-box
notepad .env.local
```

如果弹出"文件不存在"提示，点 **是** 创建新文件。

### 5.2 填写内容

将第 2 步保存的 Supabase 密钥填入：

```
COZE_SUPABASE_URL=https://abcdefgh.supabase.co
COZE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
COZE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
```

> 替换为你自己的实际值！不要照抄示例！

### 5.3 保存文件

按 `Ctrl + S` 保存，关闭记事本。

### 5.4 验证文件内容

```bash
type .env.local
```

应该能看到 3 行配置。确认无误后继续。

---

## 6. 安装依赖并启动

### 6.1 安装项目依赖

```bash
cd D:\youmi-box
pnpm install
```

> 首次安装可能需要 2-5 分钟，请耐心等待。
> 如果报错，尝试删除 `node_modules` 文件夹后重新 `pnpm install`。

### 6.2 启动开发服务器

由于项目默认启动脚本使用 bash（Windows 不支持），需要用 Next.js 原生命令启动：

```bash
pnpm next dev -p 5000
```

看到以下输出即表示启动成功：

```
✓ Ready in 2s
○ Local:   http://localhost:5000
```

### 6.3 构建生产版本（可选，正式上线时用）

```bash
pnpm next build
pnpm next start -p 5000
```

---

## 7. 验证部署成功

### 7.1 访问首页

打开浏览器访问 http://localhost:5000

应看到优秘盒盲盒首页，包含品牌名、宣传标语和连接钱包按钮。

### 7.2 测试后台接口

在浏览器中访问：

- http://localhost:5000/api/admin/settings → 应返回 JSON 配置数据
- http://localhost:5000/api/admin/images → 应返回 5 个品级图片数据

如果返回 `{"success":true,"data":{...}}` 说明数据库连接正常！

如果返回 500 错误，请检查：
1. `.env.local` 文件是否在项目根目录
2. 3 个环境变量是否填写正确
3. Supabase 项目是否正常运行

### 7.3 访问管理后台

1. 在首页底部找到隐藏入口（页面最底部极小的文字）
2. 点击进入后台登录页
3. 输入默认账号密码：`admin` / `123456`
4. 登录成功后即可配置所有参数

---

## 8. 后台管理配置

登录后台后，按以下顺序配置：

### 8.1 必填配置

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **Payment Wallet** | 收款钱包地址 | `0xYourWalletAddress...` |
| **NFT Contract** | NFT 合约地址 | `0xYourContractAddress...` |

### 8.2 价格配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| BNB 价格 | 0.1 | 用 BNB 购买一个盲盒的价格 |
| USDT 价格 | 50 | 用 USDT 购买的价格 |
| BUSD 价格 | 50 | 用 BUSD 购买的价格 |
| USDC 价格 | 50 | 用 USDC 购买的价格 |
| SOL 价格 | 0.3 | 用 SOL 购买的价格 |
| DOGE 价格 | 300 | 用 DOGE 购买的价格 |

### 8.3 回收定价

| 品级 | 默认回收价 | 说明 |
|------|-----------|------|
| Normal（普通） | 10 BNB | 普通藏品回收价 |
| Rare（稀有） | 30 BNB | 稀有藏品回收价 |
| Epic（史诗） | 80 BNB | 史诗藏品回收价 |
| Legend（传说） | 200 BNB | 传说藏品回收价 |
| Myth（神话） | 500 BNB | 神话藏品回收价 |

### 8.4 手续费比例

| 手续费 | 默认值 | 说明 |
|--------|--------|------|
| 买入手续费 | 5% | 购买盲盒时收取 |
| 卖出手续费 | 5% | 回收藏品时收取 |
| 提现手续费 | 5% | 提现佣金时收取 |

### 8.5 上传 NFT 图片

1. 在后台找到 **NFT Images** 区域
2. 为每个品级上传图片（普通/稀有/史诗/传说/神话）
3. 图片会替换首页开箱后展示的占位图

---

## 9. 常见问题

### Q1：接口返回 500，日志显示 `injecting env (0)`

**原因**：环境变量未被读取。

**解决**：
1. 确认项目根目录有 `.env.local` 文件（不是 `.env`）
2. 确认文件内容格式正确，每行一个 `KEY=VALUE`，没有多余空格
3. 确认三个变量名拼写正确：`COZE_SUPABASE_URL`、`COZE_SUPABASE_ANON_KEY`、`COZE_SUPABASE_SERVICE_ROLE_KEY`
4. 修改 `.env.local` 后需要重启服务：`Ctrl + C` 停止，再重新 `pnpm next dev -p 5000`

### Q2：`pnpm install` 报错

**解决**：
1. 确认 Node.js 版本 >= 18：`node -v`
2. 清除缓存重试：`pnpm store prune && pnpm install`
3. 如果有网络问题，设置镜像：`pnpm config set registry https://registry.npmmirror.com`

### Q3：启动报错 `bash: scripts/dev.sh: No such file or directory`

**原因**：项目的 `pnpm dev` 命令调用了 bash 脚本，Windows 不支持。

**解决**：直接使用 Next.js 命令启动：
```bash
pnpm next dev -p 5000
```

### Q4：Supabase 连接超时

**解决**：
1. 检查 Supabase 项目状态（登录控制台查看是否 Paused，如果是点击 Restore）
2. 确认 `COZE_SUPABASE_URL` 格式为 `https://xxxxx.supabase.co`（注意是 https）
3. 中国大陆访问 Supabase 可能较慢，需要稳定网络环境

### Q5：如何修改管理员密码

1. 登录后台后，在 Settings 中修改 Admin Password 字段
2. 或者在 Supabase SQL Editor 中执行：
```sql
UPDATE admin_settings SET admin_password = '你的新密码' WHERE id = 1;
```

### Q6：如何部署到服务器（Linux VPS）

```bash
# 1. 安装 Node.js 和 pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm

# 2. 克隆项目
git clone https://你的仓库地址 /opt/youmi-box
cd /opt/youmi-box

# 3. 创建环境变量
cp .env.example .env.local
nano .env.local  # 填写 Supabase 密钥

# 4. 安装依赖并构建
pnpm install
pnpm next build

# 5. 用 pm2 后台运行
npm install -g pm2
pm2 start "pnpm next start -p 5000" --name youmi-box
pm2 save
pm2 startup
```

### Q7：如何让外网访问

- **开发测试**：使用 ngrok（`ngrok http 5000`）临时暴露
- **正式部署**：购买 VPS 服务器 + 域名，用 Nginx 反向代理 5000 端口

---

## 文件结构速查

```
youmi-box/
├── .env.local          ← 你的环境变量（不提交到 Git）
├── .env.example        ← 环境变量模板
├── public/nft/         ← NFT 品级图片
├── src/
│   ├── app/
│   │   ├── page.tsx    ← 前端主页
│   │   ├── admin/      ← 管理员后台
│   │   ├── layout.tsx  ← 页面布局
│   │   └── api/        ← 后端接口
│   │       ├── admin/  ← 管理接口（设置/登录/图片/统计）
│   │       ├── blindbox/buy/  ← 购买盲盒
│   │       ├── inventory/     ← 藏品查询/卖出
│   │       └── referral/      ← 邀请/提现
│   ├── lib/
│   │   ├── i18n.ts     ← 双语文案
│   │   ├── web3.ts     ← 钱包连接
│   │   └── utils.ts    ← 工具函数
│   └── storage/
│       └── database/
│           ├── shared/schema.ts       ← 数据表定义
│           └── supabase-client.ts     ← 数据库连接
└── package.json
```
