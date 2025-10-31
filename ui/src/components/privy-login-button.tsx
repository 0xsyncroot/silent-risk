'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { LogOut, Wallet, ChevronDown, Copy, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function PrivyLoginButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Not ready yet
  if (!ready) {
    return (
      <div className="px-4 py-2 bg-slate-100 rounded-lg animate-pulse">
        <div className="h-4 w-16 bg-slate-200 rounded"></div>
      </div>
    );
  }

  // Not logged in
  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="btn-primary inline-flex items-center space-x-2 cursor-pointer font-semibold"
      >
        <Wallet className="h-4 w-4" />
        <span>Login</span>
      </button>
    );
  }

  // Get user info
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
  
  // Get social account
  const twitterAccount = user?.twitter;
  const farcasterAccount = user?.farcaster;
  const displayName = twitterAccount?.username || farcasterAccount?.username || 'User';
  
  // Copy address to clipboard
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="group relative px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-yellow-300 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
      >
        <div className="flex items-center space-x-2.5">
          {/* Avatar */}
          <div className="relative">
            <div className="w-7 h-7 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-sm font-bold text-slate-900">
                {twitterAccount ? '𝕏' : 'F'}
              </span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          
          {/* Username */}
          <span className="font-semibold text-sm text-slate-900 max-w-[120px] truncate">
            {displayName}
          </span>
          
          {/* Chevron */}
          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-br from-slate-50 to-white border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-xl font-bold text-slate-900">
                  {twitterAccount ? '𝕏' : 'F'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate text-base">
                  @{displayName}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  {twitterAccount ? 'Twitter Account' : 'Farcaster Account'}
                </p>
              </div>
            </div>
          </div>

          {/* Wallet Section */}
          {embeddedWallet && (
            <div className="px-4 py-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Wallet Address
                  </span>
                </div>
                <button
                  onClick={() => copyAddress(embeddedWallet.address)}
                  className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>
              </div>
              
              <div className="group relative">
                <code className="block text-xs font-mono text-slate-900 bg-slate-100 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-yellow-300 transition-colors">
                  {embeddedWallet.address.substring(0, 8)}...{embeddedWallet.address.substring(34)}
                </code>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-slate-200"></div>

          {/* Actions */}
          <div className="p-2">
            <button
              onClick={() => {
                logout();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

