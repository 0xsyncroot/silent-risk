import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Silent Risk - Privacy-Preserving AI Risk Analysis for Web3",
  description: "Privacy-preserving AI-powered risk analysis for Web3. Built with Zama fhEVM and Concrete-ML for complete confidentiality. Analyze your portfolio with zero-knowledge proofs.",
  keywords: ["fhEVM", "Zama", "Privacy", "DeFi", "Risk Analysis", "AI", "Web3", "Zero-Knowledge", "Homomorphic Encryption", "Blockchain Security", "Smart Contract", "NFT Passport"],
  authors: [{ name: "Silent Risk Team" }],
  metadataBase: new URL('https://silentrisk.ai'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'android-chrome-192x192', url: '/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/android-chrome-512x512.png' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: "Silent Risk - Privacy-Preserving AI Risk Analysis for Web3",
    description: "Privacy-preserving AI-powered risk analysis for Web3. Built with Zama fhEVM and Concrete-ML for complete confidentiality.",
    type: "website",
    url: "https://silentrisk.ai",
    siteName: "Silent Risk",
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: 'Silent Risk Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Silent Risk - Privacy-Preserving AI Risk Analysis",
    description: "Privacy-preserving AI-powered risk analysis for Web3 with complete confidentiality",
    images: ['/logo.png'],
    creator: '@silentrisk',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased bg-white">
        <Providers>
          <div className="min-h-screen flex flex-col relative">
            {/* Clean Background - 60% White */}
            <div className="fixed inset-0 -z-10 bg-white"></div>
            
            <Header />
            <main className="flex-1 pt-16 relative">
              <div className="animate-fade-in-up">
                {children}
              </div>
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}