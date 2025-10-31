'use client';

import { Github, Twitter, Book, Mail, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="bg-gradient-to-br from-slate-50 to-blue-50/30 border-t border-slate-200/60 py-16 px-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4 group cursor-pointer">
              <div className="relative w-10 h-10 flex-shrink-0">
                <Image 
                  src="/logo.png" 
                  alt="Silent Risk Logo" 
                  width={40}
                  height={40}
                  className="object-contain group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-lg"></div>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Silent Risk
              </span>
            </div>
            <p className="text-slate-600 mb-6 max-w-md leading-relaxed">
              Privacy-preserving AI-powered risk analysis for Web3. 
              Built with Zama fhEVM and Concrete-ML for complete confidentiality.
            </p>
            <div className="flex space-x-4">
              {[
                { href: "https://github.com/silent-risk", icon: Github, label: "GitHub" },
                { href: "https://twitter.com/silentrisk", icon: Twitter, label: "Twitter" },
                { href: "mailto:team@silentrisk.xyz", icon: Mail, label: "Email" }
              ].map((social, index) => (
                <a 
                  key={index}
                  href={social.href}
                  className="group p-3 bg-white hover:bg-yellow-50 rounded-xl transition-all duration-300 border border-slate-200 hover:border-yellow-300 shadow-sm hover:shadow-md"
                  target={social.href.startsWith('http') ? "_blank" : undefined}
                  rel={social.href.startsWith('http') ? "noopener noreferrer" : undefined}
                  aria-label={social.label}
                >
                  <social.icon className="h-5 w-5 text-slate-600 group-hover:text-yellow-600 transition-colors duration-300" />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-slate-900 font-bold mb-4">Product</h3>
            <ul className="space-y-3">
              {[
                { href: "/risk-analysis", label: "Risk Analysis" },
                { href: "/strategy-validation", label: "Strategy Validation" },
                { href: "/attestation", label: "NFT Certificates" },
                { href: "/api", label: "Developer API" }
              ].map((item, index) => (
                <li key={index}>
                  <Link 
                    href={item.href} 
                    className="text-slate-600 hover:text-yellow-600 transition-colors duration-300 font-medium hover:translate-x-1 transform inline-block"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-slate-900 font-bold mb-4">Resources</h3>
            <ul className="space-y-3">
              {[
                { href: "/docs", label: "Documentation", icon: Book },
                { href: "/whitepaper", label: "Whitepaper" },
                { href: "/security", label: "Security Audits" },
                { href: "/privacy", label: "Privacy Policy" }
              ].map((item, index) => (
                <li key={index}>
                  <Link 
                    href={item.href}
                    className="text-slate-600 hover:text-yellow-600 transition-all duration-300 font-medium flex items-center space-x-2 hover:translate-x-1 transform group"
                  >
                    {item.icon && <item.icon className="h-4 w-4 group-hover:text-yellow-600" />}
                    <span>{item.label}</span>
                    {item.href.startsWith('http') && <ExternalLink className="h-3 w-3 opacity-50" />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Technology Stack */}
        <div className="mt-16 pt-12 border-t border-slate-200/60">
          <div className="text-center">
            <h4 className="text-slate-700 font-semibold text-lg mb-8">Powered by cutting-edge privacy technology</h4>
            <div className="flex flex-wrap justify-center items-center gap-8">
              {[
                { name: "Zama fhEVM", color: "from-blue-500 to-blue-600" },
                { name: "Concrete-ML", color: "from-purple-500 to-purple-600" },
                { name: "Zero Knowledge Proofs", color: "from-indigo-500 to-indigo-600" },
                { name: "Homomorphic Encryption", color: "from-cyan-500 to-cyan-600" }
              ].map((tech, index) => (
                <div key={index} className="flex items-center space-x-3 px-6 py-3 bg-white rounded-xl border border-slate-200 hover:border-yellow-300 hover:shadow-md transition-all duration-300 group">
                  <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full group-hover:scale-110 transition-transform duration-300 shadow-sm"></div>
                  <span className="text-slate-700 font-medium group-hover:text-yellow-700 transition-colors duration-300">{tech.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-slate-200/60 text-center">
          <p className="text-slate-600 font-medium">
            © 2024 Silent Risk Team. All rights reserved. Built with{' '}
            <span className="text-red-500 animate-pulse">❤️</span>{' '}
            for Web3 privacy.
          </p>
        </div>
      </div>
    </footer>
  );
}
