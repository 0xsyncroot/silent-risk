'use client';

import { Menu, X, BarChart3, Settings, FileText, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import Image from 'next/image';
import { PrivyLoginButton } from './privy-login-button';
import { NotificationPanel } from './notification-panel';

const navigation = [
  { name: 'Risk Analysis', href: '/risk-analysis', icon: BarChart3 },
  { name: 'Strategy Validation', href: '/strategy-validation', icon: Settings },
  { name: 'Documentation', href: '/docs', icon: FileText },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { authenticated } = usePrivy();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Scroll to top utility (reserved for future use)
  // const scrollToTop = () => {
  //   window.scrollTo({ top: 0, behavior: 'smooth' });
  // };

  const isHomePage = pathname === '/';

  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
      <div className="container mx-auto px-3 py-2.5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link 
            href="/"
            className="flex items-center space-x-2.5 group transition-all duration-200"
          >
            <div className="relative w-7 h-7 flex-shrink-0">
              <Image 
                src="/logo.png" 
                alt="Silent Risk Logo" 
                width={28}
                height={28}
                className="object-contain group-hover:scale-110 transition-transform duration-200"
                priority
              />
            </div>
            <span className="text-base font-semibold text-slate-900 group-hover:text-yellow-600 transition-colors duration-200">
              Silent Risk
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-0.5">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative flex items-center cursor-pointer space-x-1.5 px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg
                    ${isActive 
                      ? 'text-yellow-600 bg-yellow-50' 
                      : 'text-slate-600 hover:text-yellow-600 hover:bg-slate-50'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.name}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 w-6 h-0.5 bg-yellow-500 transform -translate-x-1/2 rounded-full"></div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Header Actions */}
          <div className="flex items-center space-x-2">
            {/* Quick Actions - Desktop */}
            {!isHomePage && authenticated && (
              <div className="hidden xl:flex items-center space-x-1">
                <Link
                  href="/risk-analysis"
                  className="btn-primary inline-flex items-center cursor-pointer text-xs font-bold"
                >
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden 2xl:inline">Quick Analysis</span>
                </Link>
              </div>
            )}

            {/* Notification Bell - Always visible */}
            <NotificationPanel />

            {/* Privy Login/User Menu */}
            <div className="hidden sm:block">
              <PrivyLoginButton />
            </div>
            
            {/* Mobile Menu Button */}
            <button
              className="md:hidden cursor-pointer p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-all duration-200"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 border-t border-slate-200/60">
            <div className="flex flex-col space-y-1 pt-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center cursor-pointer space-x-2.5 px-3 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg
                      ${isActive 
                        ? 'text-yellow-600 bg-yellow-50' 
                        : 'text-slate-600 hover:text-yellow-600 hover:bg-slate-50'
                      }
                    `}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                    )}
                  </Link>
                );
              })}
              
              {/* Mobile Login Button */}
              <div className="pt-3 sm:hidden">
                <PrivyLoginButton />
              </div>

              {/* Mobile Quick Actions */}
              {!isHomePage && authenticated && (
                <div className="pt-3">
                  <Link
                    href="/risk-analysis"
                    className="btn-primary flex items-center justify-center space-x-2 w-full text-sm font-bold"
                  >
                    <Zap className="h-4 w-4" />
                    <span>Quick Analysis</span>
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
