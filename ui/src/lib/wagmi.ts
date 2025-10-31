/**
 * Wagmi Configuration for Privy
 * 
 * This is a minimal wagmi config that Privy uses internally.
 * Privy handles most wallet connection logic, so we keep this simple.
 */

import { createConfig, http } from 'wagmi';
import { sepolia, hardhat } from 'wagmi/chains';

export const config = createConfig({
  chains: [sepolia, hardhat],
  transports: {
    [sepolia.id]: http(),
    [hardhat.id]: http(),
  },
  ssr: true,
});
