/**
 * Privy Configuration
 * 
 * Configures social login (X/Farcaster) with automatic embedded wallet creation
 * External wallets can be linked later for signature verification
 */

import { PrivyClientConfig } from '@privy-io/react-auth';

export const privyConfig: PrivyClientConfig = {
  // Appearance
  appearance: {
    theme: 'light',
    accentColor: '#EAB308', // yellow-500 to match Silent Risk branding
    logo: 'https://i.imgur.com/your-logo.png', // Replace with actual logo URL
  },

  // Login methods - ONLY social (X and Farcaster)
  loginMethods: ['twitter', 'farcaster'],

  // Embedded wallet configuration
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets', // Auto-create wallet for users without wallets
    },
  },

  // Wallet configuration
  supportedChains: [
    // Sepolia testnet
    {
      id: 11155111,
      name: 'Sepolia',
      network: 'sepolia',
      nativeCurrency: {
        name: 'Sepolia ETH',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: {
        default: { http: ['https://rpc.sepolia.org'] },
        public: { http: ['https://rpc.sepolia.org'] },
      },
    },
    // Hardhat local
    {
      id: 31337,
      name: 'Hardhat',
      network: 'hardhat',
      nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: {
        default: { http: ['http://127.0.0.1:8545'] },
        public: { http: ['http://127.0.0.1:8545'] },
      },
    },
  ],

  // Legal and branding
  legal: {
    termsAndConditionsUrl: 'https://silent-risk.xyz/terms',
    privacyPolicyUrl: 'https://silent-risk.xyz/privacy',
  },

  // Wallet UI (optional - only needed for WalletConnect mobile wallets)
  // walletConnectCloudProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
};

/**
 * Get Privy App ID from environment
 * Required for Privy to work
 */
export const getPrivyAppId = (): string => {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  
  if (!appId) {
    console.warn(
      '⚠️  Privy App ID not found. Please:\n' +
      '1. Go to https://dashboard.privy.io\n' +
      '2. Create a new app\n' +
      '3. Copy your App ID\n' +
      '4. Add to .env.local: NEXT_PUBLIC_PRIVY_APP_ID=your_app_id\n' +
      '5. Restart your development server\n'
    );
    return ''; // Will cause Privy to fail gracefully
  }
  
  return appId;
};

