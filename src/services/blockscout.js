import { ethers } from 'ethers';
import { getProvider } from './wallet';

/**
 * Fetch native balance using Blockscout API, with RPC Provider fallback
 */
export const fetchNativeBalance = async (address, network) => {
  if (!address || !network) return '0.0000';

  // Attempt 1: Try Blockscout API if configured
  if (network.blockscoutApi) {
    try {
      const url = `${network.blockscoutApi}?module=account&action=balance&address=${address}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.status === '1' && data.result) {
          const wei = BigInt(data.result);
          return ethers.formatEther(wei);
        }
      }
    } catch (e) {
      // Silently fall back to direct RPC provider
    }
  }

  // Attempt 2: Direct RPC Provider fallback
  try {
    const provider = getProvider(network);
    const balanceWei = await provider.getBalance(address);
    return ethers.formatEther(balanceWei);
  } catch (err) {
    console.error('Failed to get balance via RPC:', err);
    return '0.0000';
  }
};

/**
 * Fetch Normal Transaction History (Incoming & Outgoing Native)
 */
export const fetchTransactionHistory = async (address, network) => {
  if (!address || !network || !network.blockscoutApi) {
    return [];
  }

  try {
    const url = `${network.blockscoutApi}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const data = await res.json();
    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result.map((tx) => {
        const isOutgoing = tx.from.toLowerCase() === address.toLowerCase();
        let valueEth = '0';
        try {
          valueEth = ethers.formatEther(BigInt(tx.value || 0));
        } catch {
          valueEth = '0';
        }

        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to || 'Kontrak Dibuat',
          value: valueEth,
          symbol: network.symbol,
          timeStamp: parseInt(tx.timeStamp, 10) * 1000,
          isError: tx.isError === '1' || tx.txreceipt_status === '0',
          isOutgoing,
          type: 'native',
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice,
          blockNumber: tx.blockNumber
        };
      });
    }

    return [];
  } catch (err) {
    console.warn('Blockscout txlist fetch error:', err.message);
    return [];
  }
};

/**
 * Fetch ERC-20 / BEP-20 Token Transfers History
 */
export const fetchTokenTransferHistory = async (address, network) => {
  if (!address || !network || !network.blockscoutApi) {
    return [];
  }

  try {
    const url = `${network.blockscoutApi}?module=account&action=tokentx&address=${address}&page=1&offset=50&sort=desc`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const data = await res.json();
    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result.map((tx) => {
        const isOutgoing = tx.from.toLowerCase() === address.toLowerCase();
        const decimals = parseInt(tx.tokenDecimal || '18', 10);
        let formattedValue = '0';
        try {
          formattedValue = ethers.formatUnits(BigInt(tx.value || 0), decimals);
        } catch {
          formattedValue = '0';
        }

        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: formattedValue,
          symbol: tx.tokenSymbol || 'TOKEN',
          tokenName: tx.tokenName || '',
          contractAddress: tx.contractAddress,
          timeStamp: parseInt(tx.timeStamp, 10) * 1000,
          isError: false,
          isOutgoing,
          type: 'token',
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice,
          blockNumber: tx.blockNumber
        };
      });
    }

    return [];
  } catch (err) {
    console.warn('Blockscout tokentx fetch error:', err.message);
    return [];
  }
};

/**
 * Fetch Internal Transactions (contract-initiated native transfers)
 * These include transfers from DEX swaps, staking rewards, contract payouts, etc.
 * that don't appear in normal txlist but carry native coin value.
 */
export const fetchInternalTransactionHistory = async (address, network) => {
  if (!address || !network || !network.blockscoutApi) {
    return [];
  }

  try {
    const url = `${network.blockscoutApi}?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const data = await res.json();
    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result
        .filter((tx) => {
          // Only include transactions with actual value transferred
          const val = BigInt(tx.value || 0);
          return val > 0n;
        })
        .map((tx) => {
          const isOutgoing = tx.from.toLowerCase() === address.toLowerCase();
          let valueEth = '0';
          try {
            valueEth = ethers.formatEther(BigInt(tx.value || 0));
          } catch {
            valueEth = '0';
          }

          return {
            hash: tx.transactionHash || tx.hash,
            from: tx.from,
            to: tx.to,
            value: valueEth,
            symbol: network.symbol,
            timeStamp: parseInt(tx.timeStamp, 10) * 1000,
            isError: tx.isError === '1',
            isOutgoing,
            type: 'internal',
            blockNumber: tx.blockNumber
          };
        });
    }

    return [];
  } catch (err) {
    console.warn('Blockscout txlistinternal fetch error:', err.message);
    return [];
  }
};
