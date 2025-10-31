'use client';

import { Shield, Lock, Brain, Zap } from 'lucide-react';
import { useAccount } from 'wagmi';
import Link from 'next/link';

export function Hero() {
  const { isConnected } = useAccount();

  return (
    <section className="relative pt-24 pb-16 px-4 overflow-hidden bg-white">
      {/* Subtle Background - Clean & Minimal */}
      <div className="absolute inset-0 bg-white"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-yellow-400/5 to-amber-400/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-yellow-300/5 to-yellow-400/5 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto text-center relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-xs font-bold rounded-full mb-6 animate-fade-in-up shadow-[0_4px_12px_rgba(255,203,5,0.35)]">
          <Lock className="w-3 h-3 mr-2" />
          Powered by Zama FHE Technology
        </div>

        {/* Main Heading */}
        <div className="mb-8 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
          <h1 className="heading-1 mb-4 text-black">
            Silent Risk
            <br />
            <span className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-500 bg-clip-text text-transparent">Vault</span>
          </h1>
          <p className="text-lg md:text-xl font-medium text-slate-700 max-w-3xl mx-auto leading-relaxed">
            Privacy-preserving AI-powered risk analysis for Web3. 
            Get professional-grade risk assessments without exposing your wallet or trading data.
          </p>
        </div>

        {/* Feature Icons */}
        <div className="flex flex-wrap justify-center items-center gap-6 mb-12 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
          {[
            { icon: Lock, label: "Fully Private", color: "from-blue-500 to-blue-600" },
            { icon: Brain, label: "AI-Powered", color: "from-purple-500 to-purple-600" },
            { icon: Shield, label: "On-Chain Proof", color: "from-indigo-500 to-indigo-600" },
            { icon: Zap, label: "Real-Time", color: "from-cyan-500 to-cyan-600" }
          ].map((feature, index) => (
            <div key={index} className="flex flex-col items-center group">
              <div className="relative p-3 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl mb-2 shadow-[0_2px_8px_rgba(255,203,5,0.25)] group-hover:shadow-[0_4px_12px_rgba(255,203,5,0.35)] transition-all duration-300 group-hover:scale-105">
                <feature.icon className="h-5 w-5 text-black relative z-10" />
              </div>
              <span className="text-xs text-slate-600 font-medium group-hover:text-yellow-600 transition-colors duration-300">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-fade-in-up" style={{animationDelay: '0.6s'}}>
          {isConnected ? (
            <>
              <Link 
                href="/risk-analysis"
                className="btn-primary flex items-center space-x-3 group"
              >
                <span>Analyze Risk Score</span>
                <svg className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link 
                href="/strategy-validation"
                className="btn-secondary"
              >
                Validate Strategy
              </Link>
            </>
          ) : (
            <>
              <button 
                className="btn-primary flex items-center space-x-3 group"
                onClick={() => {
                  // Trigger wallet connection
                  const connectButton = document.querySelector('[data-testid="rk-connect-button"]') as HTMLButtonElement;
                  connectButton?.click();
                }}
              >
                <span>Connect Wallet to Start</span>
                <svg className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button 
                className="btn-secondary"
                onClick={() => {
                  const featuresSection = document.getElementById('features');
                  featuresSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View Demo
              </button>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-fade-in-up" style={{animationDelay: '0.8s'}}>
          {[
            { value: "100%", label: "Private", color: "from-blue-600 to-blue-700" },
            { value: "0", label: "Data Exposure", color: "from-purple-600 to-purple-700" },
            { value: "24/7", label: "Analysis", color: "from-indigo-600 to-indigo-700" },
            { value: "∞", label: "Scalability", color: "from-cyan-600 to-cyan-700" }
          ].map((stat, index) => (
            <div key={index} className="text-center group">
              <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2 group-hover:scale-105 transition-transform duration-300">
                {stat.value}
              </div>
              <div className="text-sm text-slate-700 font-semibold group-hover:text-slate-900 transition-colors duration-300">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
