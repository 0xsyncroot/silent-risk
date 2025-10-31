#!/bin/bash

# ============================================================================
# ZK Trusted Setup Ceremony
# ============================================================================
# Generates proving and verification keys for the passport proof circuit
# Uses Powers of Tau ceremony for secure random number generation
# ============================================================================

set -e  # Exit on error

echo ""
echo "🔐 ZK TRUSTED SETUP CEREMONY"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Check dependencies
if ! command -v circom &> /dev/null; then
    echo "❌ circom not found. Run: make setup-circom"
    exit 1
fi

if ! command -v snarkjs &> /dev/null; then
    echo "❌ snarkjs not found. Installing..."
    npm install -g snarkjs
fi

# Configuration
CIRCUIT_NAME="passport_proof"
PTAU_FILE="powersOfTau28_hez_final_14.ptau"
# Alternative URLs (try in order if one fails)
PTAU_URLS=(
    "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"
    "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau"
)

# Step 1: Download Powers of Tau file (if not exists)
if [ ! -f "$PTAU_FILE" ]; then
    echo "📥 Step 1/6: Downloading Powers of Tau file..."
    echo "   (This is a one-time download, ~200MB)"
    echo ""
    
    DOWNLOAD_SUCCESS=false
    for PTAU_URL in "${PTAU_URLS[@]}"; do
        echo "Trying: $PTAU_URL"
        if wget -q --show-progress --timeout=30 "$PTAU_URL"; then
            DOWNLOAD_SUCCESS=true
            echo "✅ Downloaded $PTAU_FILE"
            break
        else
            echo "⚠️  Failed, trying next URL..."
        fi
    done
    
    if [ "$DOWNLOAD_SUCCESS" = false ]; then
        echo ""
        echo "❌ Failed to download Powers of Tau file from all sources"
        echo ""
        echo "💡 Manual download options:"
        echo "   1. wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"
        echo "   2. curl -O https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"
        echo "   3. Download from browser and move to: $(pwd)/"
        echo ""
        exit 1
    fi
else
    echo "✅ Step 1/6: Powers of Tau file already exists"
fi
echo ""

# Step 2: Compile circuit (if not compiled)
if [ ! -f "${CIRCUIT_NAME}.r1cs" ]; then
    echo "🔧 Step 2/6: Compiling circuit..."
    circom ${CIRCUIT_NAME}.circom --r1cs --wasm --sym -l ../../node_modules
    echo "✅ Circuit compiled"
else
    echo "✅ Step 2/6: Circuit already compiled"
fi
echo ""

# Step 3: Generate witness calculator info
echo "📊 Step 3/6: Circuit info..."
snarkjs r1cs info ${CIRCUIT_NAME}.r1cs
echo ""

# Step 4: Start a new zkey and make a contribution
echo "🔑 Step 4/6: Starting zkey and making contribution..."
snarkjs groth16 setup ${CIRCUIT_NAME}.r1cs $PTAU_FILE ${CIRCUIT_NAME}_0000.zkey
echo ""

# Step 5: Contribute to the ceremony
echo "🎲 Step 5/6: Contributing random entropy..."
echo "random entropy" | snarkjs zkey contribute ${CIRCUIT_NAME}_0000.zkey ${CIRCUIT_NAME}_final.zkey --name="1st Contributor" -v
echo "✅ Contribution complete"
echo ""

# Step 6: Export verification key
echo "📤 Step 6/6: Exporting verification key..."
snarkjs zkey export verificationkey ${CIRCUIT_NAME}_final.zkey verification_key.json
echo "✅ Verification key exported"
echo ""

# Export Solidity verifier
echo "📝 Generating Solidity verifier contract..."
snarkjs zkey export solidityverifier ${CIRCUIT_NAME}_final.zkey ../contracts/Verifier.sol
echo "✅ Solidity verifier generated"
echo ""

# Cleanup intermediate files
echo "🧹 Cleaning up intermediate files..."
rm -f ${CIRCUIT_NAME}_0000.zkey
echo "✅ Cleanup complete"
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════════════════════"
echo "✅ TRUSTED SETUP COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "📋 Generated files:"
echo ""
echo "   Circuit files:"
echo "   ✓ ${CIRCUIT_NAME}.r1cs          - Constraint system"
echo "   ✓ ${CIRCUIT_NAME}.wasm          - WebAssembly witness calculator"
echo "   ✓ ${CIRCUIT_NAME}.sym           - Symbol mapping"
echo ""
echo "   Proving keys:"
echo "   ✓ ${CIRCUIT_NAME}_final.zkey    - Final proving key"
echo "   ✓ verification_key.json         - Verification key (JSON)"
echo ""
echo "   Smart contract:"
echo "   ✓ ../contracts/Verifier.sol     - Solidity verifier"
echo ""
echo "📦 Files needed for frontend:"
echo "   1. Copy to ui/public/circuits/:"
echo "      - ${CIRCUIT_NAME}.wasm"
echo "      - ${CIRCUIT_NAME}_final.zkey"
echo ""
echo "   2. Deploy Verifier.sol contract"
echo "   3. Update PassportNFT with verifier address"
echo ""
echo "🚀 Next steps:"
echo "   1. Deploy verifier: npx hardhat run scripts/deploy-verifier.ts"
echo "   2. Deploy PassportNFT with verifier address"
echo "   3. Copy circuit files to frontend"
echo ""

