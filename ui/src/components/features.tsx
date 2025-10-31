'use client';

import { Shield, Eye, Brain, Zap, Lock, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: Lock,
    title: "Complete Privacy",
    description: "Wallet addresses and trading data remain encrypted throughout the entire analysis process using Zama's fhEVM technology.",
    color: "purple",
    link: "/privacy"
  },
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description: "Advanced machine learning models analyze risk patterns and trading strategies using Concrete-ML on encrypted data.",
    color: "violet",
    link: "/analysis"
  },
  {
    icon: Shield,
    title: "On-Chain Attestation",
    description: "Verifiable risk scores and strategy validations stored immutably on-chain without revealing sensitive information.",
    color: "indigo",
    link: "/attestation"
  },
  {
    icon: Eye,
    title: "Zero Knowledge Proofs",
    description: "Prove compliance and risk levels without exposing underlying data through cryptographic proofs.",
    color: "blue",
    link: "/zk-proofs"
  },
  {
    icon: Zap,
    title: "Real-Time Processing",
    description: "Instant risk analysis and strategy validation with sub-second response times for critical trading decisions.",
    color: "cyan",
    link: "/dashboard"
  },
  {
    icon: CheckCircle,
    title: "Regulatory Compliance",
    description: "Built-in compliance frameworks help institutions meet regulatory requirements while maintaining privacy.",
    color: "green",
    link: "/compliance"
  }
];


export function Features() {
  return (
    <section id="features" className="py-16 px-4 bg-gray-50">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-xs font-bold rounded-full mb-4 shadow-[0_4px_12px_rgba(255,203,5,0.35)]">
            <Lock className="w-3 h-3 mr-2" />
            CONFIDENTIAL SMART CONTRACTS
          </div>
          <h2 className="heading-2 mb-6 text-black leading-tight">
            Revolutionary Features
          </h2>
          <p className="text-lg font-medium text-slate-700 max-w-3xl mx-auto leading-relaxed">
            Powered by cutting-edge cryptographic technology and AI, Silent Risk Vault 
            delivers unprecedented privacy and accuracy in DeFi risk analysis.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            
            return (
              <div 
                key={index}
                className="group relative p-6 bg-white rounded-xl border border-gray-100 hover:border-blue-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                {/* Background Gradient on Hover - Subtle Yellow */}
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/50 to-amber-50/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 mb-4 group-hover:scale-105 transition-transform duration-300 shadow-[0_2px_8px_rgba(255,203,5,0.25)] group-hover:shadow-[0_4px_12px_rgba(255,203,5,0.35)]">
                    <Icon className="h-5 w-5 text-black" />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-black mb-3 group-hover:text-yellow-600 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-slate-600 font-medium leading-relaxed text-sm">
                    {feature.description}
                  </p>

                  {/* Learn More Link */}
                  <div className="mt-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <Link 
                      href={feature.link}
                      className="inline-flex items-center text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                    >
                      Learn more
                      <ArrowRight className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Technology Stack */}
        <div className="text-center">
          <h3 className="text-3xl font-bold text-black mb-12">Built with Zama Protocol</h3>
          <div className="flex flex-wrap justify-center items-center gap-6">
            <div className="group flex items-center space-x-3 px-8 py-4 bg-white rounded-2xl border border-slate-100 hover:border-yellow-200 hover:shadow-lg transition-all duration-300">
              <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full shadow-sm"></div>
              <span className="text-black font-semibold text-lg group-hover:text-yellow-700 transition-colors">Zama fhEVM</span>
            </div>
            <div className="group flex items-center space-x-3 px-8 py-4 bg-white rounded-2xl border border-slate-100 hover:border-yellow-200 hover:shadow-lg transition-all duration-300">
              <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full shadow-sm"></div>
              <span className="text-black font-semibold text-lg group-hover:text-yellow-700 transition-colors">Concrete-ML</span>
            </div>
            <div className="group flex items-center space-x-3 px-8 py-4 bg-white rounded-2xl border border-slate-100 hover:border-yellow-200 hover:shadow-lg transition-all duration-300">
              <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full shadow-sm"></div>
              <span className="text-black font-semibold text-lg group-hover:text-yellow-700 transition-colors">Next.js</span>
            </div>
            <div className="group flex items-center space-x-3 px-8 py-4 bg-white rounded-2xl border border-slate-100 hover:border-yellow-200 hover:shadow-lg transition-all duration-300">
              <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full shadow-sm"></div>
              <span className="text-black font-semibold text-lg group-hover:text-yellow-700 transition-colors">Sepolia</span>
            </div>
          </div>
          
          {/* Call to Action */}
          <div className="mt-16 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/risk-analysis"
              className="btn-primary inline-flex items-center"
            >
              <span>Launch App</span>
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <Link 
              href="/docs"
              className="btn-secondary inline-flex items-center"
            >
              <span>Learn More</span>
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
