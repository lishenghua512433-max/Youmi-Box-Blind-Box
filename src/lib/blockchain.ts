import { ethers } from 'ethers';

// ============================================================
// Server-side blockchain utilities for BSC chain operations
// UNIFIED WALLET ARCHITECTURE:
//   - Collection wallet (receives): blind box payments + trade fees
//   - Payout wallet (sends): NFT recycling + commission withdrawal
//   - Both set to same address: 0x61866D26BC800D3Ce52cD4Ca82857f53F7C546C5
//   - Private key ONLY from server env var, NEVER exposed to frontend
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

// Minimal ERC20 ABI
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
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

// ============================================================
// SEND: Platform wallet → User wallet (auto-payout)
// Used for: NFT recycling, commission withdrawal
// ============================================================

async function sendBNB(
  signer: ethers.Wallet,
  toAddress: string,
  amount: string
): Promise<{ txHash: string; status: string }> {
  const balance = await getProvider().getBalance(signer.address);
  const amountWei = ethers.parseEther(amount);
  const gasReserve = ethers.parseEther('0.005');
  if (balance < amountWei + gasReserve) {
    throw new Error(`Insufficient BNB in platform wallet. Balance: ${ethers.formatEther(balance)} BNB, Need: ${amount} BNB`);
  }
  const tx = await signer.sendTransaction({ to: toAddress, value: amountWei });
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`BNB transfer failed on chain. TxHash: ${tx.hash}`);
  }
  return { txHash: tx.hash, status: 'confirmed' };
}

async function sendERC20(
  signer: ethers.Wallet,
  contractAddress: string,
  toAddress: string,
  amount: string,
  decimals: number = 18
): Promise<{ txHash: string; status: string }> {
  const contract = new ethers.Contract(contractAddress, ERC20_ABI, signer);
  const balance = await contract.balanceOf(signer.address);
  const parsedAmount = ethers.parseUnits(amount, decimals);
  if (balance < parsedAmount) {
    throw new Error(`Insufficient token in platform wallet. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${amount}`);
  }
  const tx = await contract.transfer(toAddress, parsedAmount);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Token transfer failed on chain. TxHash: ${tx.hash}`);
  }
  return { txHash: tx.hash, status: 'confirmed' };
}

/**
 * Send payout from platform wallet to user wallet
 * All payouts are sent as the specified currency (default USDT per spec)
 */
export async function sendPayoutToUser(
  toAddress: string,
  amount: string,
  currency: string = 'USDT',
  contractAddress?: string
): Promise<{ txHash: string; status: string }> {
  const signer = getPlatformSigner();
  if (currency === 'BNB') {
    return sendBNB(signer, toAddress, amount);
  }
  if (!contractAddress) {
    throw new Error(`Contract address required for ${currency} payout`);
  }
  const decimals = TOKEN_DECIMALS[currency] || 18;
  return sendERC20(signer, contractAddress, toAddress, amount, decimals);
}

/**
 * Auto split-payment for P2P trade:
 * 1. Buyer pays full amount to platform wallet (verified on-chain by frontend)
 * 2. Platform deducts fee and sends remaining to seller
 * 3. Fee stays in platform wallet automatically
 */
export async function executeTradeSplit(
  sellerWallet: string,
  tradeAmount: string,
  feePercent: number,
  currency: string = 'USDT',
  contractAddress?: string
): Promise<{
  sellerTxHash: string;
  sellerReceiveAmount: string;
  feeAmount: string;
  status: string;
}> {
  const amount = parseFloat(tradeAmount);
  const fee = amount * feePercent / 100;
  const sellerReceives = amount - fee;

  const signer = getPlatformSigner();

  // Send seller's share (principal minus fee) from platform wallet
  let result: { txHash: string; status: string };
  if (currency === 'BNB') {
    result = await sendBNB(signer, sellerWallet, sellerReceives.toFixed(8));
  } else {
    if (!contractAddress) throw new Error(`Contract address required for ${currency}`);
    const decimals = TOKEN_DECIMALS[currency] || 18;
    result = await sendERC20(signer, contractAddress, sellerWallet, sellerReceives.toFixed(8), decimals);
  }

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
// BALANCE: Check platform wallet balance for safety
// ============================================================

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
