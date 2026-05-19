import { ethers } from 'ethers';

// BSC Mainnet Chain
export const BSC_CHAIN_ID = 56;
export const BSC_CHAIN_ID_HEX = '0x38';
export const BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';
export const BSC_CHAIN_PARAMS = {
  chainId: BSC_CHAIN_ID_HEX,
  chainName: 'BSC Mainnet',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: ['https://bsc-dataseed.binance.org/', 'https://bsc-dataseed1.defibit.io/'],
  blockExplorerUrls: ['https://bscscan.com/'],
};

// ERC20 ABI (minimal for transfer + balance)
export const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

// Currency decimals on BSC (TRX is 6 decimals on BSC)
export const CURRENCY_DECIMALS: Record<string, number> = {
  BNB: 18,
  USDT: 18,
  BUSD: 18,
  TRX: 6,
};

// Currency info for display
export const CURRENCIES = ['BNB', 'USDT', 'BUSD', 'TRX'] as const;
export type Currency = (typeof CURRENCIES)[number];

export function getProvider(): ethers.BrowserProvider | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { ethereum?: { isMetaMask?: boolean; isTrust?: boolean; isWalletConnect?: boolean } };
  if (win.ethereum) return new ethers.BrowserProvider(win.ethereum as ethers.Eip1193Provider);
  return null;
}

export async function switchToBSC(): Promise<boolean> {
  const win = window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } };
  if (!win.ethereum) return false;
  try {
    await win.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID_HEX }],
    });
    return true;
  } catch (switchError: unknown) {
    const err = switchError as { code?: number };
    if (err.code === 4902) {
      try {
        await win.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_CHAIN_PARAMS],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export async function isBSCNetwork(): Promise<boolean> {
  const win = window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } };
  if (!win.ethereum) return false;
  const chainId = await win.ethereum.request({ method: 'eth_chainId' }) as string;
  return chainId === BSC_CHAIN_ID_HEX;
}

export async function connectWallet(): Promise<string | null> {
  const win = window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } };
  if (!win.ethereum) {
    window.open('https://metamask.io/download/', '_blank');
    return null;
  }
  try {
    const accounts = await win.ethereum.request({
      method: 'eth_requestAccounts',
    }) as string[];
    if (accounts.length > 0) {
      const onBSC = await isBSCNetwork();
      if (!onBSC) {
        await switchToBSC();
      }
      return accounts[0];
    }
    return null;
  } catch {
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    const win = window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } };
    if (win.ethereum) {
      await win.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

export async function sendBNB(toAddress: string, amount: string): Promise<string | null> {
  try {
    const provider = getProvider();
    if (!provider) return null;
    const signer = await provider.getSigner();
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount),
    });
    await tx.wait();
    return tx.hash;
  } catch {
    return null;
  }
}

export async function sendERC20(
  contractAddress: string,
  toAddress: string,
  amount: string,
  decimals: number = 18
): Promise<string | null> {
  try {
    const provider = getProvider();
    if (!provider) return null;
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, signer);
    const parsedAmount = ethers.parseUnits(amount, decimals);
    const tx = await contract.transfer(toAddress, parsedAmount);
    await tx.wait();
    return tx.hash;
  } catch {
    return null;
  }
}

// Send payment to collection wallet based on currency
// Returns txHash on success, null on failure
export async function sendPayment(
  currency: Currency,
  contractAddress: string | undefined,
  toAddress: string,
  amount: string
): Promise<string | null> {
  if (currency === 'BNB') {
    return sendBNB(toAddress, amount);
  }
  if (!contractAddress) return null;
  const decimals = CURRENCY_DECIMALS[currency] || 18;
  return sendERC20(contractAddress, toAddress, amount, decimals);
}

// Send payment with detailed result (for market trades & verified purchases)
export interface PaymentResult {
  success: boolean;
  txHash: string | null;
  error?: string;
}

export async function sendPaymentWithResult(
  currency: Currency,
  contractAddress: string | undefined,
  toAddress: string,
  amount: string
): Promise<PaymentResult> {
  try {
    if (currency === 'BNB') {
      const provider = getProvider();
      if (!provider) return { success: false, txHash: null, error: 'No wallet provider' };
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount),
      });
      await tx.wait();
      return { success: true, txHash: tx.hash };
    }

    if (!contractAddress) return { success: false, txHash: null, error: 'No contract address' };
    const decimals = CURRENCY_DECIMALS[currency] || 18;
    const provider = getProvider();
    if (!provider) return { success: false, txHash: null, error: 'No wallet provider' };
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, signer);
    const parsedAmount = ethers.parseUnits(amount, decimals);
    const tx = await contract.transfer(toAddress, parsedAmount);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment failed';
    return { success: false, txHash: null, error: message };
  }
}

// Generate referral code from wallet address
export function generateReferralCode(wallet: string): string {
  const hash = wallet.toLowerCase().slice(2, 10);
  return hash.toUpperCase();
}
