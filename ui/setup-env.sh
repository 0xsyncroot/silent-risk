#!/bin/bash

echo "🔧 Setting up environment variables for Silent Risk Vault..."
echo ""

# Check if .env.local already exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists. Backing up to .env.local.backup"
    cp .env.local .env.local.backup
fi

# Create .env.local file
cat > .env.local << 'ENVEOF'
# WalletConnect Project ID
# Get your project ID from https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Development settings
NODE_ENV=development
ENVEOF

echo "✅ Created .env.local file"
echo ""
echo "📝 Next steps:"
echo "1. Go to https://cloud.walletconnect.com"
echo "2. Create a new project (it's free)"
echo "3. Copy your Project ID"
echo "4. Edit .env.local and replace 'your_project_id_here' with your actual Project ID"
echo "5. Restart your development server: npm run dev"
echo ""
echo "🔍 Your .env.local file is located at: $(pwd)/.env.local"

