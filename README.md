# FhenixDropBox - Privacy-First Decentralized File Sharing

A privacy-first decentralized file sharing platform built on Fhenix with encrypted access control.

## Features

- **Encrypted Access Control**: Prices, passwords, and access rules are hidden on-chain using Fhenix FHE
- **Decentralized Storage**: Files are encrypted locally and stored on IPFS
- **Private Verification**: All access validations happen on encrypted data
- **Confidential Payments**: Payment verification without revealing amounts
- **Secret-Based Unlock**: Users unlock files using hidden codes
- **Encrypted Expiry & Limits**: Download limits and expiry times hidden from public view

## Architecture

```
├── frontend/
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/         # Dashboard (requires wallet)
│   │   ├── upload/            # File upload page
│   │   ├── files/             # File management page
│   │   ├── settings/          # User settings
│   │   └── share/[id]/        # Public share page
│   ├── components/            # UI components
│   ├── lib/                   # Utilities
│   │   ├── wagmi.ts          # Wallet configuration
│   │   ├── fhenix.ts         # Fhenix utilities
│   │   └── ipfs.ts           # IPFS integration
│   └── contracts/             # Smart contracts
│       └── FhenixDropBox.sol  # Main contract
├── contracts/                  # Hardhat project
└── README.md
```

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4, Radix UI
- **Wallet**: Wagmi v2, Viem, WalletConnect
- **Blockchain**: Fhenix (Arbitrum Sepolia testnet)
- **Storage**: IPFS (via Pinata)
- **Smart Contracts**: Solidity, Hardhat, OpenZeppelin

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- MetaMask or another Web3 wallet

### Installation

```bash
# Install dependencies
cd frontend
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Start development server
pnpm dev
```

### Smart Contract Deployment

```bash
# Compile contracts
pnpm compile

# Deploy to testnet
pnpm deploy

# Update .env.local with the deployed contract address
```

## Privacy Model

Unlike traditional Web3 file sharing:

| Aspect | Traditional | FhenixDropBox |
|--------|-------------|---------------|
| Price | Public | Encrypted |
| Password | Often plaintext | Encrypted |
| Access rules | Visible | Hidden |
| Download count | Trackable | Private |
| Expiry time | Public | Encrypted |

## Smart Contract Functions

### Core Functions

- `uploadFile()` - Upload file with encrypted access rules
- `requestAccess()` - Request access with encrypted payment verification
- `downloadFile()` - Download after access verification
- `verifyPassword()` - Verify password on encrypted data
- `getFileDetails()` - Get file info (access-controlled)

### Owner Functions

- `deactivateFile()` - Deactivate a file
- `updateFileRules()` - Update access rules
- `withdraw()` - Withdraw contract balance

## Testing

```bash
# Run contract tests
cd contracts
npx hardhat test

# Start local node
npx hardhat node
```

## Environment Variables

```env
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Smart Contract
NEXT_PUBLIC_CONTRACT_ADDRESS=deployed_address

# IPFS
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt
```

## Supported Networks

- Arbitrum Sepolia (recommended)
- Ethereum Sepolia
- Base Sepolia

## FHE Integration

This project uses Fhenix's Fully Homomorphic Encryption to keep sensitive data private:

- Encrypted integers (`euint64`, `euint128`) for prices and limits
- Encrypted booleans for access flags
- Operations on encrypted data without decryption

**Note**: The current smart contract is a mock implementation demonstrating the architecture. Replace placeholder types with actual FHE types when deploying to Fhenix mainnet.

## License

MIT

## Links

- [Fhenix Documentation](https://cofhe-docs.fhenix.zone)
- [Cofhe SDK](https://cofhe-docs.fhenix.zone/cofhejs)
- [FHE Library](https://cofhe-docs.fhenix.zone/fhe-library)
