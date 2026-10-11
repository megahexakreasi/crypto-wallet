import { ethers } from 'ethers';
import { ERC20_ABI } from '../constants/erc20Abi';
import { getProvider, getSigner } from './wallet';

/**
 * Inspect custom token on chain by its contract address
 */
export const getTokenDetails = async (contractAddress, network) => {
  const provider = getProvider(network);
  const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);

  const [name, symbol, decimals] = await Promise.all([
    contract.name().catch(() => 'Unknown Token'),
    contract.symbol().catch(() => 'TOKEN'),
    contract.decimals().catch(() => 18)
  ]);

  return {
    address: contractAddress,
    name,
    symbol,
    decimals: Number(decimals)
  };
};

/**
 * Fetch token balance for an address
 */
export const fetchTokenBalance = async (contractAddress, userAddress, decimals = 18, network) => {
  try {
    const provider = getProvider(network);
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
    const rawBalance = await contract.balanceOf(userAddress);
    return ethers.formatUnits(rawBalance, decimals);
  } catch (err) {
    console.error('Failed to fetch token balance:', err);
    return '0.0';
  }
};

/**
 * Estimate gas fee for a transfer (Native or Token)
 */
export const estimateTransferGas = async ({
  fromAddress,
  toAddress,
  amount,
  token = null,
  network
}) => {
  try {
    const provider = getProvider(network);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('3', 'gwei');

    let estimatedGasLimit = 21000n;

    if (token && token.address) {
      // ERC20 token transfer estimation
      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const parsedAmount = ethers.parseUnits(amount || '0', token.decimals || 18);
        estimatedGasLimit = await contract.transfer.estimateGas(toAddress, parsedAmount, {
          from: fromAddress
        });
        // add 20% safety margin for gas limit
        estimatedGasLimit = (estimatedGasLimit * 120n) / 100n;
      } catch (e) {
        estimatedGasLimit = 65000n; // safe typical ERC20 transfer limit
      }
    } else {
      // Native coin transfer
      try {
        const parsedAmount = ethers.parseEther(amount || '0');
        estimatedGasLimit = await provider.estimateGas({
          from: fromAddress,
          to: toAddress,
          value: parsedAmount
        });
      } catch (e) {
        estimatedGasLimit = 21000n;
      }
    }

    const estimatedCostWei = estimatedGasLimit * gasPrice;
    const estimatedCostEth = ethers.formatEther(estimatedCostWei);

    return {
      gasLimit: estimatedGasLimit.toString(),
      gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
      estimatedFee: estimatedCostEth,
      feeSymbol: network.symbol
    };
  } catch (err) {
    console.error('Error estimating gas:', err);
    return {
      gasLimit: '21000',
      gasPrice: '3',
      estimatedFee: '0.000063',
      feeSymbol: network.symbol
    };
  }
};

/**
 * Send Native or Token Transfer
 */
export const sendTransfer = async ({
  privateKey,
  toAddress,
  amount,
  token = null, // null for native coin
  network
}) => {
  const signer = getSigner(privateKey, network);

  if (token && token.address) {
    // Transfer ERC-20 / BEP-20
    const contract = new ethers.Contract(token.address, ERC20_ABI, signer);
    const parsedAmount = ethers.parseUnits(amount, token.decimals || 18);
    const tx = await contract.transfer(toAddress, parsedAmount);
    return tx;
  } else {
    // Transfer Native Coin (ETH / BNB / MTT)
    const parsedAmount = ethers.parseEther(amount);
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: parsedAmount
    });
    return tx;
  }
};
