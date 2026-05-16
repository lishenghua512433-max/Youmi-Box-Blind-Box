# AGENTS.md

# Youmi Box Blind Box - 优秘盒盲盒

## Project Overview
BSC链NFT盲盒DApp平台，支持多币种支付、五品级藏品、自由交易市场、平台兜底回收、NFT转赠、两级分销佣金、风控伪装等功能。

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
├── public/nft/                # NFT品级占位图 (SVG): fanpin/lingpin/xuanpin/xianpin/shenpin
├── src/
│   ├── app/
│   │   ├── page.tsx           # DApp主页 (盲盒/藏品/市场/邀请)
│   │   ├── admin/page.tsx     # 管理员后台
│   │   ├── layout.tsx         # Root布局
│   │   ├── globals.css        # 全局样式
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── settings/route.ts  # GET/PUT 管理设置
│   │       │   ├── login/route.ts     # POST 管理员登录
│   │       │   ├── images/route.ts    # GET/PUT NFT图片
│   │       │   └── stats/route.ts     # GET 统计数据
│   │       ├── blindbox/buy/route.ts  # POST 购买盲盒(支持批量)
│   │       ├── inventory/route.ts     # GET/POST 藏品查询/卖出/转赠
│   │       ├── market/route.ts        # GET/POST/PUT/DELETE 交易市场
│   │       ├── transactions/route.ts  # GET 交易记录查询
│   │       └── referral/route.ts      # GET/POST 邀请信息与提现
│   ├── lib/
│   │   ├── i18n.ts            # 双语系统 (en/zh) - 品级:凡品/灵品/玄品/仙品/神品
│   │   ├── web3.ts            # Web3钱包连接与交易(BNB/USDT/BUSD/TRX)
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
- `admin_settings` - 全局配置 (价格/概率/回收价/手续费/佣金/双钱包/合约地址)
- `nft_images` - NFT品级图片映射 (fanpin/lingpin/xuanpin/xianpin/shenpin)
- `users` - 用户信息 (钱包/邀请码/上级关系)
- `nft_inventory` - NFT藏品记录 (held/listed/sold/gifted)
- `trade_listings` - 交易市场挂单
- `transactions` - 交易流水记录 (购买/回收/交易/佣金/提现, 含手续费明细)
- `commissions` - 佣金记录
- `commissions` - 佣金记录
- `transactions` - 交易记录

## API Routes Summary
| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/settings` | GET/PUT | 获取/更新管理设置 |
| `/api/admin/login` | POST | 管理员登录验证 |
| `/api/admin/images` | GET/PUT | NFT品级图片管理 |
| `/api/admin/stats` | GET | 用户/交易统计 |
| `/api/blindbox/buy` | POST | 购买盲盒(1-99个,0手续费) |
| `/api/inventory` | GET/POST | 藏品查询/平台回收卖出/转赠 |
| `/api/market` | GET/POST/PUT/DELETE | 交易市场(挂单/购买/取消) |
| `/api/transactions` | GET | 交易流水记录查询(用户/全站) |
| `/api/referral` | GET/POST | 邀请信息/佣金提现 |

## Key Business Rules
- 购买盲盒: 0手续费, 支持1-99个批量购买, BNB/USDT/BUSD/TRX四种币种
- 自由交易: 买卖双方各5%手续费
- 平台回收: 卖方5%手续费
- NFT转赠: 0手续费, 仅记录流转
- 两级分销: 直推4%, 间推1%, 全额即时到账
- 风控: 未登录用户隐藏收益相关功能, 爬虫访问跳转净化页
- 资金安全: 归集钱包与兑付钱包分离, 兑付余额不足暂停回收提现

## Coding Standards
- TypeScript strict mode, no implicit any
- pnpm only, no npm/yarn
- shadcn/ui components for UI
- All wallet operations use ethers.js v6 BrowserProvider
- Hydration-safe: use useEffect + useState for client-only values
- i18n keys in `src/lib/i18n.ts`, access via `t('key')`

## Admin Access
- Hidden entry in page footer (nearly invisible text)
- Default credentials: admin / 123456
- Session stored in sessionStorage
