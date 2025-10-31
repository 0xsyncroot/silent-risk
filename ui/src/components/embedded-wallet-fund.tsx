'use client';

import { useState, useEffect } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { Wallet, ExternalLink, Copy, Check, AlertCircle } from 'lucide-react';

interface EmbeddedWalletFundProps {
  onClose: () => void;
  onFunded: () => void;
}

export function EmbeddedWalletFund({ onClose, onFunded }: EmbeddedWalletFundProps) {
  const { wallets } = useWallets();
  const [balance, setBalance] = useState<string>('0');
  const [isChecking, setIsChecking] = useState(true);
  const [copied, setCopied] = useState(false);

  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');

  // Check balance
  useEffect(() => {
    const checkBalance = async () => {
      if (!embeddedWallet?.address) return;

      try {
        setIsChecking(true);
        // Get balance from provider
        const provider = await embeddedWallet.getEthereumProvider();
        const balanceHex = await provider.request({
          method: 'eth_getBalance',
          params: [embeddedWallet.address, 'latest']
        });
        
        // Convert from Wei to ETH
        const balanceWei = BigInt(balanceHex as string);
        const balanceEth = Number(balanceWei) / 1e18;
        setBalance(balanceEth.toFixed(6));

        // If funded, notify parent
        if (balanceEth > 0) {
          setTimeout(() => onFunded(), 1000);
        }
      } catch (err) {
        console.error('Failed to check balance:', err);
        setBalance('0');
      } finally {
        setIsChecking(false);
      }
    };

    checkBalance();
    // Check every 5 seconds
    const interval = setInterval(checkBalance, 5000);
    return () => clearInterval(interval);
  }, [embeddedWallet, onFunded]);

  const copyAddress = () => {
    if (embeddedWallet?.address) {
      navigator.clipboard.writeText(embeddedWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!embeddedWallet) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
            No Embedded Wallet Found
          </h2>
          <p className="text-sm text-slate-600 text-center mb-6">
            Please try logging out and back in.
          </p>
          <button onClick={onClose} className="btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-md">
              <Wallet className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Fund Your Embedded Wallet</h2>
              <p className="text-xs text-slate-800">Required for minting anonymous NFT passport</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Balance Display */}
          <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Current Balance
              </span>
              {isChecking && (
                <span className="text-xs text-blue-600 animate-pulse">Checking...</span>
              )}
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold text-slate-900">{balance}</span>
              <span className="text-lg font-semibold text-slate-500">ETH</span>
            </div>
            {parseFloat(balance) === 0 && (
              <p className="text-xs text-red-600 mt-2 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                Insufficient balance for minting
              </p>
            )}
          </div>

          {/* Wallet Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
              Wallet Address
            </label>
            <div className="relative">
              <code className="block text-sm font-mono text-slate-900 bg-slate-100 px-3 py-3 pr-12 rounded-lg border border-slate-200">
                {embeddedWallet.address}
              </code>
              <button
                onClick={copyAddress}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 rounded transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {/* Funding Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">How to Fund:</h3>
            
            {/* Option 1: Transfer from another wallet */}
            <div className="p-4 border-2 border-purple-200 bg-purple-50 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">1</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">Transfer from Another Wallet</h4>
                  <p className="text-xs text-slate-600 mb-2">
                    Send ETH from MetaMask, Coinbase Wallet, or any other wallet to the address above.
                  </p>
                  <p className="text-xs text-orange-600 font-semibold">
                    ⚠️ Make sure you&apos;re on the correct network (Sepolia testnet)
                  </p>
                </div>
              </div>
            </div>

            {/* Option 2: Faucet for testnet */}
            <div className="p-4 border-2 border-green-200 bg-green-50 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">2</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-900 mb-1">Get Test ETH (Sepolia)</h4>
                  <p className="text-xs text-slate-600 mb-2">
                    Use a faucet to get free test ETH for development
                  </p>
                  <a
                    href="https://sepoliafaucet.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Open Sepolia Faucet
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-600">
            Balance will auto-refresh every 5 seconds
          </p>
          <button
            onClick={onClose}
            className="btn-secondary text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

