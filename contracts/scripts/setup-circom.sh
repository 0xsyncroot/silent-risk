#!/bin/bash

# ============================================================================
# Circom Installation Script
# ============================================================================
# Installs circom compiler for Zero-Knowledge circuit compilation
# Usage: ./scripts/setup-circom.sh
# ============================================================================

set -e  # Exit on error

echo ""
echo "📦 CIRCOM INSTALLATION"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Check if circom is already installed
if command -v circom &> /dev/null; then
    CURRENT_VERSION=$(circom --version 2>&1 | head -n1 || echo "unknown")
    echo "✅ Circom is already installed: $CURRENT_VERSION"
    echo ""
    read -p "Do you want to reinstall? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping installation."
        exit 0
    fi
fi

# Configuration
CIRCOM_VERSION="v2.1.8"
CIRCOM_URL="https://github.com/iden3/circom/releases/download/${CIRCOM_VERSION}/circom-linux-amd64"
INSTALL_DIR="/usr/local/bin"
CIRCOM_BIN="${INSTALL_DIR}/circom"

echo "🔧 Installing circom ${CIRCOM_VERSION}..."
echo ""

# Check for sudo
if [ "$EUID" -ne 0 ]; then 
    SUDO="sudo"
else
    SUDO=""
fi

# Download circom binary
echo "📥 Downloading circom binary..."
if ! wget -q --show-progress "${CIRCOM_URL}" -O /tmp/circom-linux-amd64; then
    echo "❌ Failed to download circom"
    echo ""
    echo "💡 Alternative: Build from source"
    echo "   1. Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "   2. Clone repo: git clone https://github.com/iden3/circom.git"
    echo "   3. Build: cd circom && cargo build --release"
    echo "   4. Install: sudo cp target/release/circom /usr/local/bin/"
    exit 1
fi

# Install binary
echo "📦 Installing to ${INSTALL_DIR}..."
$SUDO mv /tmp/circom-linux-amd64 "${CIRCOM_BIN}"
$SUDO chmod +x "${CIRCOM_BIN}"

# Verify installation
echo ""
echo "✅ Verifying installation..."
if ! command -v circom &> /dev/null; then
    echo "❌ Installation failed - circom not found in PATH"
    exit 1
fi

INSTALLED_VERSION=$(circom --version 2>&1 | head -n1)
echo "✅ Installed: ${INSTALLED_VERSION}"
echo ""

# Check snarkjs (needed for trusted setup)
if command -v snarkjs &> /dev/null; then
    SNARKJS_VERSION=$(snarkjs --version 2>&1 | head -n1)
    echo "✅ snarkjs is installed: ${SNARKJS_VERSION}"
else
    echo "⚠️  snarkjs not found (needed for trusted setup)"
    echo ""
    read -p "Install snarkjs via npm? (Y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        if command -v npm &> /dev/null; then
            echo "📦 Installing snarkjs..."
            npm install -g snarkjs
            echo "✅ snarkjs installed"
        else
            echo "❌ npm not found. Please install Node.js first."
        fi
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "✅ INSTALLATION COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "📋 Next steps:"
echo ""
echo "   1. Compile circuit:"
echo "      cd contracts/circuits"
echo "      circom passport_proof.circom --r1cs --wasm --sym"
echo ""
echo "   2. Run trusted setup (Powers of Tau):"
echo "      cd contracts/circuits"
echo "      ./setup-ceremony.sh"
echo ""
echo "   3. Or use Makefile:"
echo "      cd contracts"
echo "      make compile-circuit"
echo ""

