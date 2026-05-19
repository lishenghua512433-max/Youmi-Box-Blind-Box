/**
 * YoumiPayoutPool 合约部署脚本
 * 
 * 使用方法:
 *   1. 确保环境变量 PAYOUT_WALLET_PRIVATE_KEY 已设置（你的管理员钱包私钥）
 *   2. 确保钱包有足够BNB支付Gas费（约0.005-0.01 BNB）
 *   3. 运行: npx tsx scripts/deploy-contract.ts
 * 
 * 部署成功后，将输出的合约地址填入:
 *   - 后台管理设置页面的"兑付合约地址"字段
 *   - 或直接在数据库 admin_settings.payout_contract_address 中更新
 */
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const PRIVATE_KEY = process.env.PAYOUT_WALLET_PRIVATE_KEY;
  const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';

  if (!PRIVATE_KEY) {
    console.error('❌ Error: PAYOUT_WALLET_PRIVATE_KEY environment variable not set');
    console.error('   Please set it before deploying:');
    console.error('   export PAYOUT_WALLET_PRIVATE_KEY=your_private_key_here');
    process.exit(1);
  }

  // Validate private key format
  const cleanKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY.slice(2) : PRIVATE_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
    console.error('❌ Error: PAYOUT_WALLET_PRIVATE_KEY format invalid — must be 64 hex characters');
    process.exit(1);
  }

  console.log('🚀 Deploying YoumiPayoutPool to BSC Mainnet...');
  console.log(`📡 RPC: ${BSC_RPC}`);

  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`👛 Deployer wallet: ${wallet.address}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Wallet BNB balance: ${ethers.formatEther(balance)} BNB`);
  if (balance === BigInt(0)) {
    console.error('❌ Error: Wallet has no BNB for gas. Please fund your wallet first.');
    process.exit(1);
  }

  // Load contract artifact
  const artifactPath = path.join(__dirname, '..', 'contracts', 'YoumiPayoutPool.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));

  // Deploy
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log('⏳ Deploying contract...');

  const contract = await factory.deploy();
  console.log(`📝 Transaction hash: ${contract.deploymentTransaction()?.hash}`);
  console.log('⏳ Waiting for confirmation...');

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log('');
  console.log('✅ Contract deployed successfully!');
  console.log(`📍 Contract address: ${contractAddress}`);
  console.log(`👤 Owner: ${wallet.address}`);
  console.log('');
  console.log('📋 Next steps:');
  console.log('  1. Copy the contract address above');
  console.log('  2. Go to admin panel → Settings → Payout Contract Address');
  console.log('  3. Paste the contract address and save');
  console.log('  4. Send BNB/USDT to the contract address as liquidity pool');
  console.log('');
  console.log('⚠️  IMPORTANT: Only the owner wallet can call payout/withdraw functions.');
  console.log('    The contract has no admin_password — only blockchain wallet ownership matters.');

  // Verify owner on-chain
  try {
    const ownerFunc = contract.getFunction('owner');
    if (ownerFunc) {
      const owner = await ownerFunc() as string;
      console.log(`🔍 Verified owner on-chain: ${owner}`);
      if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error('❌ Owner mismatch! This should not happen.');
      }
    }
  } catch {
    console.log('🔍 Owner verification skipped (contract may not have owner function in ABI)');
  }
}

main().catch((err) => {
  console.error('❌ Deployment failed:', err.message || err);
  process.exit(1);
});
