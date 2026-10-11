export const DEFAULT_NETWORKS = [
  {
    id: 'bsc-mainnet',
    name: 'BNB Smart Chain (BSC)',
    shortName: 'BSC',
    chainId: 56,
    symbol: 'BNB',
    decimals: 18,
    rpcUrl: 'https://bsc-rpc.publicnode.com',
    explorerUrl: 'https://bsc.blockscout.com',
    blockscoutApi: 'https://bsc.blockscout.com/api',
    isTestnet: false,
    color: '#F0B90B'
  },
  {
    id: 'mtt-network',
    name: 'MTT Network',
    shortName: 'MTT',
    chainId: 6880,
    symbol: 'MTT',
    decimals: 18,
    rpcUrl: 'https://evm-rpc.mtt.network',
    explorerUrl: 'https://explorer.mtt.network',
    blockscoutApi: 'https://explorer.mtt.network/api',
    isTestnet: false,
    color: '#10B981'
  },
  {
    id: 'eth-mainnet',
    name: 'Ethereum Mainnet',
    shortName: 'ETH',
    chainId: 1,
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorerUrl: 'https://eth.blockscout.com',
    blockscoutApi: 'https://eth.blockscout.com/api',
    isTestnet: false,
    color: '#627EEA'
  },
  {
    id: 'bsc-testnet',
    name: 'BSC Testnet',
    shortName: 'BSC Test',
    chainId: 97,
    symbol: 'tBNB',
    decimals: 18,
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerUrl: 'https://bsc-testnet.blockscout.com',
    blockscoutApi: 'https://bsc-testnet.blockscout.com/api',
    isTestnet: true,
    color: '#F3BA2F'
  },
  {
    id: 'eth-sepolia',
    name: 'Sepolia Testnet',
    shortName: 'Sepolia',
    chainId: 11155111,
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://eth-sepolia.blockscout.com',
    blockscoutApi: 'https://eth-sepolia.blockscout.com/api',
    isTestnet: true,
    color: '#8C9EFF'
  }
];

export const DEFAULT_TOKENS = {
  'bsc-mainnet': [
    {
      address: '0x55d398326f99059fF775485246999027B3197955',
      symbol: 'USDT',
      name: 'Tether USD (BSC)',
      decimals: 18
    },
    {
      address: '0x0FC223994e0de0a0F952D775Ef00B0389e60a238',
      symbol: 'MTT',
      name: 'MTT Token',
      decimals: 18
    }
  ],
  'mtt-network': [
    {
      address: '0x78a39b9101983D2009Ff14773E8e47Ca3a23BBfD',
      symbol: 'USDT',
      name: 'Yaako-Peg USD Token',
      decimals: 18
    }
  ],
  'eth-mainnet': [
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6
    },
    {
      address: '0x0FC223994e0de0a0F952D775Ef00B0389e60a238',
      symbol: 'MTT',
      name: 'MTT Token',
      decimals: 18
    }
  ]
};
