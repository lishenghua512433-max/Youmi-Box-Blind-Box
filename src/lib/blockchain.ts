import { ethers } from 'ethers';

// ============================================================
// Server-side blockchain utilities for BSC chain operations
// SMART CONTRACT ARCHITECTURE:
//   - Collection wallet (receives): 盲盒购买全款 + 交易手续费 → 直达私人钱包
//   - Payout Contract (sends): NFT回收兑付 + 佣金发放 + 交易卖家本金 → 从合约出款
//   - Admin wallet = 私人钱包 0x61866D26BC800D3Ce52cD4Ca82857f53F7C546C5
//   - Private key ONLY from server env var, NEVER exposed to frontend
//   - Contract address stored in database admin_settings.payout_contract_address
// ============================================================

// BSC Mainnet RPC
const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';

// Platform wallet private key — ONLY from env, NEVER from database or frontend
const PLATFORM_PRIVATE_KEY = process.env.PAYOUT_WALLET_PRIVATE_KEY || '';

// Token decimals on BSC chain
const TOKEN_DECIMALS: Record<string, number> = {
  BNB: 18,
  USDT: 18,
  BUSD: 18,
  TRX: 6,
};

// Minimal ERC20 ABI for balance check
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// YoumiPayoutPool contract ABI — inlined for Vercel/Serverless compatibility
// (fs.readFileSync fails on Vercel's read-only filesystem + contract file not in bundle)
const YOUMI_PAYOUT_POOL_ABI: ethers.InterfaceAbi = [
  {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Deposited","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"string","name":"reason","type":"string"}],"name":"PayoutBNB","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"string","name":"reason","type":"string"}],"name":"PayoutToken","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"WithdrawAllBNB","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":true,"internalType":"address","name":"token","type":"address"}],"name":"WithdrawAllToken","type":"event"},
  {"stateMutability":"payable","type":"fallback"},
  {"inputs":[{"internalType":"address[]","name":"recipients","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"},{"internalType":"string","name":"reason","type":"string"}],"name":"batchPayoutBNB","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address[]","name":"recipients","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"},{"internalType":"address","name":"token","type":"address"},{"internalType":"string","name":"reason","type":"string"}],"name":"batchPayoutToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"getBNBBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"getTokenBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"string","name":"reason","type":"string"}],"name":"payoutBNB","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"token","type":"address"},{"internalType":"string","name":"reason","type":"string"}],"name":"payoutToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"withdrawAllBNB","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"withdrawAllToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"stateMutability":"payable","type":"receive"}
];

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BSC_RPC);
}

/**
 * Get platform signer — private key from env var ONLY
 * Security: format validation, never logged, never returned to frontend
 */
function getPlatformSigner(): ethers.Wallet {
  if (!PLATFORM_PRIVATE_KEY) {
    throw new Error('PAYOUT_WALLET_PRIVATE_KEY not configured in server environment');
  }
  const cleanKey = PLATFORM_PRIVATE_KEY.startsWith('0x') ? PLATFORM_PRIVATE_KEY.slice(2) : PLATFORM_PRIVATE_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
    throw new Error('PAYOUT_WALLET_PRIVATE_KEY format invalid — must be 64 hex characters');
  }
  return new ethers.Wallet(PLATFORM_PRIVATE_KEY, getProvider());
}

/**
 * Get platform wallet address derived from private key (address only, never the key)
 */
export function getPlatformWalletAddress(): string | null {
  if (!PLATFORM_PRIVATE_KEY) return null;
  try {
    return new ethers.Wallet(PLATFORM_PRIVATE_KEY).address;
  } catch {
    return null;
  }
}

/**
 * Get connected payout contract instance
 * Requires contract address parameter (from database settings)
 */
function getPayoutContract(contractAddress: string): ethers.Contract {
  const signer = getPlatformSigner();
  return new ethers.Contract(contractAddress, YOUMI_PAYOUT_POOL_ABI, signer);
}

// ============================================================
// CONTRACT PAYOUT: Smart Contract → User wallet
// Used for: NFT recycling, commission withdrawal, trade seller payment
// All payouts go through the YoumiPayoutPool smart contract
// ============================================================

/**
 * Send payout from smart contract pool to user wallet
 * Contract owner (admin) calls payoutBNB or payoutToken
 * 
 * @param toAddress - User wallet address
 * @param amount - Human-readable amount (e.g., "2.75")
 * @param currency - BNB / USDT / BUSD / TRX
 * @param contractAddress - YoumiPayoutPool contract address
 * @param tokenAddress - ERC20 token contract address (required for non-BNB)
 * @param reason - Payout reason: "recycle" / "commission" / "trade"
 */
export async function sendPayoutToUser(
  toAddress: string,
  amount: string,
  currency: string = 'USDT',
  contractAddress: string,
  tokenAddress?: string,
  reason: string = 'payout'
): Promise<{ txHash: string; status: string }> {
  if (!contractAddress) {
    throw new Error('Payout contract address not configured. Please deploy and configure the YoumiPayoutPool contract.');
  }

  const payoutContract = getPayoutContract(contractAddress);
  const decimals = TOKEN_DECIMALS[currency] || 18;

  if (currency === 'BNB') {
    // Check contract BNB balance
    const bnbBalance = await getProvider().getBalance(contractAddress);
    const amountWei = ethers.parseEther(amount);
    if (bnbBalance < amountWei) {
      throw new Error(`Insufficient BNB in payout contract. Balance: ${ethers.formatEther(bnbBalance)} BNB, Required: ${amount} BNB. Please fund the contract.`);
    }
    const tx = await payoutContract.payoutBNB(toAddress, amountWei, reason);
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw new Error(`BNB payout failed on chain. TxHash: ${tx.hash}`);
    }
    return { txHash: tx.hash, status: 'confirmed' };
  } else {
    // ERC20 token payout
    if (!tokenAddress) {
      throw new Error(`Token contract address required for ${currency} payout`);
    }
    // Check contract token balance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, getProvider());
    const tokenBalance = await tokenContract.balanceOf(contractAddress);
    const parsedAmount = ethers.parseUnits(amount, decimals);
    if (tokenBalance < parsedAmount) {
      throw new Error(`Insufficient ${currency} in payout contract. Balance: ${ethers.formatUnits(tokenBalance, decimals)} ${currency}, Required: ${amount} ${currency}. Please fund the contract.`);
    }
    const tx = await payoutContract.payoutToken(toAddress, parsedAmount, tokenAddress, reason);
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Token payout failed on chain. TxHash: ${tx.hash}`);
    }
    return { txHash: tx.hash, status: 'confirmed' };
  }
}

/**
 * Auto split-payment for P2P trade:
 * 1. Buyer pays full amount to admin private wallet (verified on-chain)
 * 2. Contract pays seller their share (principal minus fee) from pool
 * 3. Fee stays in admin private wallet (buyer already paid there)
 */
export async function executeTradeSplit(
  sellerWallet: string,
  tradeAmount: string,
  feePercent: number,
  currency: string = 'USDT',
  contractAddress: string,
  tokenAddress?: string
): Promise<{
  sellerTxHash: string;
  sellerReceiveAmount: string;
  feeAmount: string;
  status: string;
}> {
  const amount = parseFloat(tradeAmount);
  const fee = amount * feePercent / 100;
  const sellerReceives = amount - fee;

  // Contract pays seller from pool
  const result = await sendPayoutToUser(
    sellerWallet,
    sellerReceives.toFixed(8),
    currency,
    contractAddress,
    tokenAddress,
    'trade'
  );

  return {
    sellerTxHash: result.txHash,
    sellerReceiveAmount: sellerReceives.toFixed(8),
    feeAmount: fee.toFixed(8),
    status: 'confirmed',
  };
}

// ============================================================
// VERIFY: On-chain payment verification
// Used for: blind box purchase, P2P trade buyer payment
// Checks: tx exists, confirmed, from/to/amount/currency match
// ============================================================

export async function verifyOnChainPayment(params: {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
  expectedAmount: string;
  currency: string;
  contractAddress?: string;
  tolerancePercent?: number;
}): Promise<{
  valid: boolean;
  reason?: string;
  blockNumber?: number;
  actualAmount?: string;
}> {
  const {
    txHash, expectedFrom, expectedTo, expectedAmount,
    currency, contractAddress, tolerancePercent = 1,
  } = params;

  try {
    const provider = getProvider();

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return { valid: false, reason: 'Transaction not found on chain' };
    if (receipt.status !== 1) return { valid: false, reason: 'Transaction failed on chain' };

    const tx = await provider.getTransaction(txHash);
    if (!tx) return { valid: false, reason: 'Transaction data not found' };

    const decimals = TOKEN_DECIMALS[currency] || 18;
    const fromLower = expectedFrom.toLowerCase();
    const toLower = expectedTo.toLowerCase();

    if (currency === 'BNB') {
      if (tx.from.toLowerCase() !== fromLower) {
        return { valid: false, reason: `Sender mismatch. Expected: ${fromLower}, Got: ${tx.from}` };
      }
      if (tx.to?.toLowerCase() !== toLower) {
        return { valid: false, reason: `Recipient mismatch. Expected: ${toLower}, Got: ${tx.to}` };
      }
      const actualAmount = ethers.formatEther(tx.value);
      const expected = parseFloat(expectedAmount);
      const actual = parseFloat(actualAmount);
      if (expected > 0 && Math.abs(expected - actual) / expected * 100 > tolerancePercent) {
        return { valid: false, reason: `Amount mismatch. Expected: ~${expectedAmount} BNB, Got: ${actualAmount} BNB`, actualAmount };
      }
      return { valid: true, blockNumber: receipt.blockNumber, actualAmount };
    } else {
      if (!contractAddress) return { valid: false, reason: 'Contract address required for token verification' };

      const transferTopic = ethers.id('Transfer(address,address,uint256)');
      const transferLog = receipt.logs.find(
        (log) => log.address.toLowerCase() === contractAddress.toLowerCase() && log.topics[0] === transferTopic
      );
      if (!transferLog) return { valid: false, reason: `No ${currency} transfer found in transaction` };

      const logFrom = '0x' + transferLog.topics[1].slice(-40);
      const logTo = '0x' + transferLog.topics[2].slice(-40);

      if (logFrom.toLowerCase() !== fromLower) {
        return { valid: false, reason: `Token sender mismatch. Expected: ${fromLower}, Got: ${logFrom}` };
      }
      if (logTo.toLowerCase() !== toLower) {
        return { valid: false, reason: `Token recipient mismatch. Expected: ${toLower}, Got: ${logTo}` };
      }

      const actualAmount = ethers.formatUnits(transferLog.data, decimals);
      const expected = parseFloat(expectedAmount);
      const actual = parseFloat(actualAmount);
      if (expected > 0 && Math.abs(expected - actual) / expected * 100 > tolerancePercent) {
        return { valid: false, reason: `Amount mismatch. Expected: ~${expectedAmount} ${currency}, Got: ${actualAmount} ${currency}`, actualAmount };
      }
      return { valid: true, blockNumber: receipt.blockNumber, actualAmount };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, reason: `Verification error: ${message}` };
  }
}

// ============================================================
// BALANCE: Check contract pool balance for safety checks
// ============================================================

/**
 * Get payout contract pool balance
 * This is the balance of the YoumiPayoutPool contract (used for payouts)
 */
export async function getContractBalance(
  payoutContractAddress: string,
  currency: string,
  tokenAddress?: string
): Promise<string> {
  if (!payoutContractAddress) return '0';

  const provider = getProvider();
  if (currency === 'BNB') {
    const balance = await provider.getBalance(payoutContractAddress);
    return ethers.formatEther(balance);
  }
  if (!tokenAddress) return '0';
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = TOKEN_DECIMALS[currency] || 18;
  const balance = await contract.balanceOf(payoutContractAddress);
  return ethers.formatUnits(balance, decimals);
}

/**
 * Get admin private wallet balance (for backward compatibility and info)
 * This is the balance of the collection/payout wallet address
 */
export async function getPlatformBalance(
  currency: string,
  contractAddress?: string
): Promise<string> {
  const address = getPlatformWalletAddress();
  if (!address) return '0';

  const provider = getProvider();
  if (currency === 'BNB') {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  }
  if (!contractAddress) return '0';
  const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
  const decimals = TOKEN_DECIMALS[currency] || 18;
  const balance = await contract.balanceOf(address);
  return ethers.formatUnits(balance, decimals);
}
