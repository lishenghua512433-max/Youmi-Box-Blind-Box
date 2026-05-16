import { ethers } from 'ethers';

// ============================================================
// Server-side blockchain utilities for BSC chain operations
// - Platform auto-payout (sell/recycle, commission withdrawal)
// - On-chain payment verification
// - Token transfers with correct decimals
// ============================================================

// BSC Mainnet RPC
const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';

// Payout wallet private key (NEVER store in database)
const PAYOUT_PRIVATE_KEY = process.env.PAYOUT_WALLET_PRIVATE_KEY || '';

// Token decimals on BSC chain
const TOKEN_DECIMALS: Record<string, number> = {
  BNB: 18,
  USDT: 18,
  BUSD: 18,
  TRX: 6, // TRX on BSC is 6 decimals BEP-20
};

// Minimal ERC20 ABI for transfer + balanceOf + decimals
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// Get provider (server-side JsonRpcProvider)
function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BSC_RPC);
}

// Get signer from payout wallet private key
function getPayoutSigner(): ethers.Wallet {
  if (!PAYOUT_PRIVATE_KEY) {
    throw new Error('PAYOUT_WALLET_PRIVATE_KEY not configured in environment');
  }
  const provider = getProvider();
  return new ethers.Wallet(PAYOUT_PRIVATE_KEY, provider);
}

// Get payout wallet address
export function getPayoutWalletAddress(): string | null {
  if (!PAYOUT_PRIVATE_KEY) return null;
  try {
    const wallet = new ethers.Wallet(PAYOUT_PRIVATE_KEY);
    return wallet.address;
  } catch {
    return null;
  }
}

/**
 * Send BNB from payout wallet to user
 */
export async function sendBNBFromPayout(
  toAddress: string,
  amount: string
): Promise<{ txHash: string; status: string }> {
  const signer = getPayoutSigner();

  // Check BNB balance
  const balance = await getProvider().getBalance(signer.address);
  const amountWei = ethers.parseEther(amount);
  const gasEstimate = ethers.parseEther('0.005'); // Reserve for gas
  if (balance < amountWei + gasEstimate) {
    throw new Error(`Insufficient BNB in payout wallet. Balance: ${ethers.formatEther(balance)} BNB`);
  }

  const tx = await signer.sendTransaction({
    to: toAddress,
    value: amountWei,
  });

  const receipt = await tx.wait(1); // Wait for 1 confirmation
  if (!receipt || receipt.status !== 1) {
    throw new Error(`BNB transfer failed. TxHash: ${tx.hash}`);
  }

  return { txHash: tx.hash, status: 'confirmed' };
}

/**
 * Send ERC20 token from payout wallet to user
 */
export async function sendERC20FromPayout(
  contractAddress: string,
  toAddress: string,
  amount: string,
  decimals: number = 18
): Promise<{ txHash: string; status: string }> {
  const signer = getPayoutSigner();
  const contract = new ethers.Contract(contractAddress, ERC20_ABI, signer);

  // Check token balance
  const balance = await contract.balanceOf(signer.address);
  const parsedAmount = ethers.parseUnits(amount, decimals);
  if (balance < parsedAmount) {
    throw new Error(
      `Insufficient token balance in payout wallet. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${amount}`
    );
  }

  const tx = await contract.transfer(toAddress, parsedAmount);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Token transfer failed. TxHash: ${tx.hash}`);
  }

  return { txHash: tx.hash, status: 'confirmed' };
}

/**
 * Unified: Send token from payout wallet based on currency type
 * All payouts are sent as USDT per spec: "所有收益、佣金、提现均自动发放BSC-USDT"
 */
export async function sendPayoutToUser(
  toAddress: string,
  amount: string,
  currency: string = 'USDT',
  contractAddress?: string
): Promise<{ txHash: string; status: string }> {
  if (currency === 'BNB') {
    return sendBNBFromPayout(toAddress, amount);
  }

  if (!contractAddress) {
    throw new Error(`Contract address required for ${currency} payout`);
  }

  const decimals = TOKEN_DECIMALS[currency] || 18;
  return sendERC20FromPayout(contractAddress, toAddress, amount, decimals);
}

/**
 * Verify on-chain transaction
 * Checks: tx exists, confirmed, from/to addresses match, amount matches, token type matches
 */
export async function verifyOnChainPayment(params: {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
  expectedAmount: string;
  currency: string;
  contractAddress?: string;
  tolerancePercent?: number; // Allow slight slippage (default 1%)
}): Promise<{
  valid: boolean;
  reason?: string;
  blockNumber?: number;
  actualAmount?: string;
}> {
  const {
    txHash,
    expectedFrom,
    expectedTo,
    expectedAmount,
    currency,
    contractAddress,
    tolerancePercent = 1,
  } = params;

  try {
    const provider = getProvider();

    // 1. Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { valid: false, reason: 'Transaction not found on chain' };
    }
    if (receipt.status !== 1) {
      return { valid: false, reason: 'Transaction failed on chain' };
    }

    // 2. Get full transaction
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return { valid: false, reason: 'Transaction data not found' };
    }

    const decimals = TOKEN_DECIMALS[currency] || 18;
    const fromLower = expectedFrom.toLowerCase();
    const toLower = expectedTo.toLowerCase();

    if (currency === 'BNB') {
      // Native BNB transfer
      if (!tx.from.toLowerCase().startsWith(fromLower) && tx.from.toLowerCase() !== fromLower) {
        return { valid: false, reason: `Sender mismatch. Expected: ${fromLower}, Got: ${tx.from}` };
      }
      if (tx.to?.toLowerCase() !== toLower) {
        return { valid: false, reason: `Recipient mismatch. Expected: ${toLower}, Got: ${tx.to}` };
      }

      const actualAmount = ethers.formatEther(tx.value);
      const expected = parseFloat(expectedAmount);
      const actual = parseFloat(actualAmount);
      const diff = Math.abs(expected - actual) / expected * 100;

      if (diff > tolerancePercent) {
        return {
          valid: false,
          reason: `Amount mismatch. Expected: ~${expectedAmount} BNB, Got: ${actualAmount} BNB`,
          actualAmount,
        };
      }

      return {
        valid: true,
        blockNumber: receipt.blockNumber,
        actualAmount,
      };
    } else {
      // ERC20 token transfer - parse logs
      if (!contractAddress) {
        return { valid: false, reason: 'Contract address required for token verification' };
      }

      // ERC20 Transfer event topic
      const transferTopic = ethers.id('Transfer(address,address,uint256)');
      const transferLog = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === contractAddress.toLowerCase() &&
          log.topics[0] === transferTopic
      );

      if (!transferLog) {
        return { valid: false, reason: `No ${currency} transfer found in transaction` };
      }

      // Decode from/to from topics (indexed parameters)
      const logFrom = '0x' + transferLog.topics[1].slice(-40);
      const logTo = '0x' + transferLog.topics[2].slice(-40);

      if (logFrom.toLowerCase() !== fromLower) {
        return { valid: false, reason: `Token sender mismatch. Expected: ${fromLower}, Got: ${logFrom}` };
      }
      if (logTo.toLowerCase() !== toLower) {
        return { valid: false, reason: `Token recipient mismatch. Expected: ${toLower}, Got: ${logTo}` };
      }

      // Decode amount from data
      const actualAmount = ethers.formatUnits(transferLog.data, decimals);
      const expected = parseFloat(expectedAmount);
      const actual = parseFloat(actualAmount);
      const diff = Math.abs(expected - actual) / expected * 100;

      if (diff > tolerancePercent) {
        return {
          valid: false,
          reason: `Amount mismatch. Expected: ~${expectedAmount} ${currency}, Got: ${actualAmount} ${currency}`,
          actualAmount,
        };
      }

      return {
        valid: true,
        blockNumber: receipt.blockNumber,
        actualAmount,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, reason: `Verification error: ${message}` };
  }
}

/**
 * Get token balance for a wallet address
 */
export async function getTokenBalance(
  walletAddress: string,
  currency: string,
  contractAddress?: string
): Promise<string> {
  const provider = getProvider();

  if (currency === 'BNB') {
    const balance = await provider.getBalance(walletAddress);
    return ethers.formatEther(balance);
  }

  if (!contractAddress) return '0';

  const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
  const decimals = TOKEN_DECIMALS[currency] || 18;
  const balance = await contract.balanceOf(walletAddress);
  return ethers.formatUnits(balance, decimals);
}

/**
 * Check if payout wallet has sufficient balance for a given payout
 */
export async function checkPayoutBalance(
  amount: string,
  currency: string = 'USDT',
  contractAddress?: string
): Promise<{ sufficient: boolean; balance: string; required: string }> {
  const signer = getPayoutSigner();
  const balance = await getTokenBalance(signer.address, currency, contractAddress);
  const balanceNum = parseFloat(balance);
  const requiredNum = parseFloat(amount);
  return {
    sufficient: balanceNum >= requiredNum,
    balance,
    required: amount,
  };
}
