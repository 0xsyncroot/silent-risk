# Zero-Knowledge Circuits

This directory contains Circom circuits for the Silent Risk passport system.

## Circuits

### `passport_proof.circom`
Proves knowledge of the secret used to generate a commitment without revealing:
- The original wallet address
- The secret value
- The encrypted risk score

## Quick Start

### Option 1: Using Makefile (Recommended)

```bash
# From contracts/ directory
cd /root/develop/silent-risk/contracts

# Install circom compiler
make setup-circom

# Compile circuit
make compile-circuit

# Run trusted setup ceremony
cd circuits
chmod +x setup-ceremony.sh
./setup-ceremony.sh
```

### Option 2: Manual Installation

```bash
# Install circom
wget https://github.com/iden3/circom/releases/download/v2.1.8/circom-linux-amd64
sudo mv circom-linux-amd64 /usr/local/bin/circom
sudo chmod +x /usr/local/bin/circom

# Install snarkjs
npm install -g snarkjs

# Compile circuit
circom passport_proof.circom --r1cs --wasm --sym

# Run trusted setup
./setup-ceremony.sh
```

## Output Files

After compilation:
- `passport_proof.r1cs` - Constraint system
- `passport_proof.wasm` - WebAssembly witness calculator (copy to frontend)
- `passport_proof.sym` - Symbol mapping

After trusted setup:
- `passport_proof_final.zkey` - Proving key (copy to frontend)
- `verification_key.json` - Verification key
- `../contracts/Verifier.sol` - Solidity verifier contract

## Frontend Integration

Copy these files to `ui/public/circuits/`:
```bash
cp passport_proof.wasm ../../ui/public/circuits/
cp passport_proof_final.zkey ../../ui/public/circuits/
```

## Security Notes

- The Powers of Tau file is downloaded from Hermez (trusted setup)
- For production, conduct your own ceremony with multiple contributors
- The `setup-ceremony.sh` script uses test entropy - replace for production

## Troubleshooting

### Circom not found
```bash
make setup-circom
```

### snarkjs not found
```bash
npm install -g snarkjs
```

### Permission denied
```bash
chmod +x setup-ceremony.sh
chmod +x ../scripts/setup-circom.sh
```
