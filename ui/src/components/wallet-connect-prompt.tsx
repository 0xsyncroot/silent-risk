'use client';

import { Wallet, Link as LinkIcon, Shield, AlertCircle } from 'lucide-react';
import { useWalletSignature } from '@/hooks/useWalletSignature';
import { useState } from 'react';

interface WalletConnectPromptProps {
  onConnected?: () => void;
  onCancel?: () => void;
}

export function WalletConnectPrompt({ onConnected, onCancel }: WalletConnectPromptProps) {
  const { connectExternalWallet, isLoading, error } = useWalletSignature();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    const success = await connectExternalWallet();
    setIsConnecting(false);

    if (success) {
      onConnected?.();
    }
  };

  return (
    <div className="card p-8 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Wallet className="h-8 w-8 text-slate-900" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Connect External Wallet
        </h3>
        <p className="text-sm text-slate-600">
          To verify ownership, you need to connect an external wallet (MetaMask, Coinbase Wallet, etc)
        </p>
      </div>

      {/* Why external wallet */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-start space-x-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-blue-900 mb-1">
              Why external wallet?
            </h4>
            <p className="text-xs text-blue-800">
              Your social login (X/Farcaster) created an embedded wallet for convenience. 
              To verify ownership of transaction history, we need you to sign with an external wallet.
            </p>
          </div>
        </div>
      </div>

      {/* Supported wallets */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-slate-700 mb-3">Supported wallets:</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: 'MetaMask', icon: '🦊' },
            { name: 'Coinbase', icon: '💠' },
            { name: 'WalletConnect', icon: '🔗' },
          ].map((wallet) => (
            <div key={wallet.name} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
              <div className="text-2xl mb-1">{wallet.icon}</div>
              <div className="text-xs font-medium text-slate-700">{wallet.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading || isConnecting}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleConnect}
          disabled={isLoading || isConnecting}
          className="btn-primary flex-1 inline-flex items-center justify-center"
        >
          {isConnecting ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mr-2"></div>
              Connecting...
            </>
          ) : (
            <>
              <LinkIcon className="h-4 w-4 mr-2" />
              Connect Wallet
            </>
          )}
        </button>
      </div>

      {/* Security note */}
      <p className="text-xs text-slate-500 text-center mt-4">
        🔒 This connection is secure and your funds are safe
      </p>
    </div>
  );
}

