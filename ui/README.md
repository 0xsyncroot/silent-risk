# Silent Risk - UI

Privacy-preserving AI-powered risk analysis for Web3 with social login and embedded wallets.

## 🌟 Features

- **Social Login**: Login với X (Twitter) hoặc Farcaster - không cần ví crypto
- **Embedded Wallet**: Tự động tạo ví khi login, được Privy quản lý an toàn
- **External Wallet Support**: Link thêm MetaMask, Coinbase Wallet cho advanced users
- **Privacy-First**: EIP-191 signature verification không lộ private key
- **Beautiful UI**: Modern design với Tailwind CSS

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Create `.env.local` file:

```bash
# Privy Configuration (Required)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here

# API Endpoint
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Get Privy App ID**:
1. Go to [Privy Dashboard](https://dashboard.privy.io)
2. Create a new app
3. Enable login methods: **Twitter** and **Farcaster** 
4. Enable embedded wallets: "Create on login"
5. Copy your App ID

See [ENV_TEMPLATE.md](./ENV_TEMPLATE.md) for detailed setup.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🏗️ Architecture

### Authentication Flow

```
User → Login (X/Farcaster) → Embedded Wallet Created → Ready to Use
                                      ↓
                            Option to Link External Wallet
                                      ↓
                              Wallet Verification (EIP-191)
```

### Key Components

- **PrivyLoginButton**: Social login + user menu
- **WalletSelector**: Chọn ví để ký (embedded or external)
- **SignatureModal**: Modal xác thực với EIP-191
- **useWalletSignature**: Hook để sign messages

### Tech Stack

- **Next.js 15**: React framework with App Router
- **Privy**: Social login + embedded wallets
- **Wagmi**: Ethereum interactions
- **Tailwind CSS**: Styling
- **TypeScript**: Type safety

## 📖 Usage Examples

### Check if User is Authenticated

```tsx
import { usePrivy } from '@privy-io/react-auth';

export function MyComponent() {
  const { authenticated, user } = usePrivy();
  
  if (!authenticated) {
    return <p>Please login to continue</p>;
  }
  
  return <p>Welcome, {user?.twitter?.username}!</p>;
}
```

### Request Wallet Signature

```tsx
import { useState } from 'react';
import { SignatureModal } from '@/components/signature-modal';

export function RiskAnalysis() {
  const [showModal, setShowModal] = useState(false);
  
  const handleSignature = async (result) => {
    // Send signature to backend for verification
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(result)
    });
  };
  
  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Start Analysis
      </button>
      
      <SignatureModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSignatureComplete={handleSignature}
      />
    </>
  );
}
```

## 🔒 Security

### EIP-191 Message Signing

Messages follow this format:
```
Silent Risk Analysis: {wallet_address} at {timestamp}
```

This prevents:
- ✅ Signature reuse for different wallets
- ✅ Replay attacks (timestamp validation)
- ✅ Cross-dApp signature reuse

### Backend Verification

See [PRIVY_INTEGRATION.md](./PRIVY_INTEGRATION.md) for complete verification code.

## 📚 Documentation

- [Privy Integration Guide](./PRIVY_INTEGRATION.md) - Chi tiết về Privy setup
- [Environment Variables](./ENV_TEMPLATE.md) - Hướng dẫn config
- [Next.js Documentation](https://nextjs.org/docs)
- [Privy Documentation](https://docs.privy.io)

## 🎨 UX Benefits

**Before (RainbowKit)**:
- ❌ Requires existing crypto wallet
- ❌ High barrier for new users
- ❌ Browser extension needed

**After (Privy)**:
- ✅ Login with social accounts
- ✅ No crypto wallet needed to start
- ✅ Embedded wallet auto-created
- ✅ Still supports external wallets
- ✅ Better onboarding experience

## 🛠️ Build & Deploy

### Build for Production

```bash
npm run build
npm start
```

### Deploy

Deploy to Vercel, Netlify, or any Node.js hosting:

```bash
# Vercel (recommended)
vercel deploy

# Or build and deploy manually
npm run build
# Upload .next/, public/, package.json to your server
```

## 🐛 Troubleshooting

**"Privy App ID not found"**
→ Add `NEXT_PUBLIC_PRIVY_APP_ID` to `.env.local`

**Signature fails**
→ Ensure user is logged in and wallets are ready

**External wallet not linking**
→ Check wallet extension is installed and on correct network

See [PRIVY_INTEGRATION.md](./PRIVY_INTEGRATION.md#-troubleshooting) for more.

## 📝 License

MIT
