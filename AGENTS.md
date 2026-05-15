# AGENTS.md

# BSC NFT Blind Box DApp

## Project Overview
BSC链NFT盲盒DApp平台，包含用户前端和管理员后台。支持多币种支付购买盲盒、NFT品级随机抽取、自动回收、三级邀请返佣等功能。

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI Components**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: ethers.js v6 (BSC Mainnet)

## Directory Structure
```
├── public/nft/                # NFT品级占位图 (SVG)
├── src/
│   ├── app/
│   │   ├── page.tsx           # DApp主页 (盲盒/藏品/邀请)
│   │   ├── admin/page.tsx     # 管理员后台
│   │   ├── layout.tsx         # Root布局
│   │   ├── globals.css        # 全局样式
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── settings/route.ts  # GET/PUT 管理设置
│   │       │   ├── login/route.ts     # POST 管理员登录
│   │       │   ├── images/route.ts    # GET/PUT NFT图片
│   │       │   └── stats/route.ts     # GET 统计数据
│   │       ├── blindbox/buy/route.ts  # POST 购买盲盒
│   │       ├── inventory/route.ts     # GET/POST 藏品查询与卖出
│   │       └── referral/route.ts      # GET/POST 邀请信息与提现
│   ├── lib/
│   │   ├── i18n.ts            # 双语系统 (en/zh)
│   │   ├── web3.ts            # Web3钱包连接与交易
│   │   └── utils.ts           # 工具函数
│   ├── components/ui/         # shadcn/ui组件库
│   └── storage/database/      # Supabase数据库
│       ├── shared/schema.ts   # 数据表Schema
│       └── supabase-client.ts # Supabase客户端
```

## Build & Run Commands
- **Install**: `pnpm install`
- **Dev**: `pnpm run dev` (port 5000)
- **Build**: `pnpm run build`
- **Start**: `pnpm run start`
- **Lint**: `pnpm lint`
- **Type Check**: `pnpm ts-check`

## Database Tables
- `admin_settings` - 全局配置 (价格/手续费/概率/佣金/合约地址)
- `nft_images` - NFT品级图片映射
- `users` - 用户信息 (钱包/邀请码/佣金余额)
- `nft_inventory` - NFT藏品记录
- `transactions` - 交易记录
- `commissions` - 佣金记录

## API Routes Summary
| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/settings` | GET/PUT | 获取/更新管理设置 |
| `/api/admin/login` | POST | 管理员登录验证 |
| `/api/admin/images` | GET/PUT | NFT品级图片管理 |
| `/api/admin/stats` | GET | 用户/交易统计 |
| `/api/blindbox/buy` | POST | 购买盲盒 |
| `/api/inventory` | GET/POST | 藏品查询/卖出 |
| `/api/referral` | GET/POST | 邀请信息/佣金提现 |

## Coding Standards
- TypeScript strict mode, no implicit any
- pnpm only, no npm/yarn
- shadcn/ui components for UI
- All wallet operations use ethers.js v6 BrowserProvider
- Hydration-safe: use useEffect + useState for client-only values (window, sessionStorage)
- i18n keys in `src/lib/i18n.ts`, access via `t('key')`

## Admin Access
- Hidden entry in page footer (nearly invisible text)
- Default credentials: admin / 123456
- Session stored in sessionStorage
