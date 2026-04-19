# FhenixDropBox - Privacy-First Decentralized File Sharing

A privacy-first decentralized file sharing platform built on Fhenix with encrypted access control. Share files with complete privacy using Fully Homomorphic Encryption (FHE).

## What is FhenixDropBox?

FhenixDropBox is a decentralized file sharing platform that keeps all sensitive data private on-chain:

- **Encrypted Access Control**: Prices, passwords, download limits, and expiry times are hidden using Fhenix FHE
- **Private Verification**: All access validations happen on encrypted data without exposure
- **Decentralized Storage**: Files are encrypted locally and stored on IPFS
- **Zero-Knowledge Proofs**: Password verification without revealing the actual password

## Key Features (Available Now - Wave 1)

- Lock icon with secret-based unlock for files
- Eye-slash icon for hidden download counts and access logs
- Shield icon for confidential payments
- Clock icon for encrypted expiry times
- Database icon for decentralized IPFS storage
- Wallet connection with MetaMask and WalletConnect

## How It Works

### 1. Upload & Encrypt
Select your file. It's encrypted locally on your device before uploading to IPFS.

### 2. Set Access Rules
Define price, password, expiry, and download limits. These are encrypted with Fhenix FHE.

### 3. Get Secure Link
Receive a private shareable link. All access conditions remain hidden on-chain.

### 4. Private Verification
When someone accesses the file, all validations happen on encrypted data.

### 5. Secure Download
Access granted? File is decrypted locally for the authorized user only.

## Privacy Comparison

### Traditional Web3 File Sharing
- File prices are public
- Access logs are visible
- Passwords exposed
- Download limits visible

### FhenixDropBox
- Prices encrypted with FHE
- Access logs completely private
- Passwords never exposed
- Download limits hidden

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4, Radix UI
- **Wallet**: Wagmi v2, Viem, WalletConnect
- **Blockchain**: Ethereum Sepolia (testnet)
- **Storage**: IPFS (via Pinata)
- **Smart Contracts**: Solidity, Hardhat, OpenZeppelin

## Deployed Contract

- **Network**: Ethereum Sepolia
- **Contract Address**: `0x4a69Db2288Bb9868Bf6eB87FFBcfaeebB51231e8`
- **RPC**: https://ethereum-sepolia.publicnode.com

## Development Roadmap

### Wave 1 - Available Now
Core platform with essential privacy features:
- Encrypted Access Rules (prices, passwords, limits hidden on-chain)
- IPFS Storage (decentralized file storage)
- Privacy Protection (no data exposed publicly)
- File Upload with access control
- Basic wallet connection

### Wave 2 -  ce and previews:
- File Preview (preview PDFs and images before purchase)
- Multi-File Upload (upload up to 10 files at once)
- Link Expiry (24h / 7d / 30d link expiration)
- Batch Downloads (download multiple files)

### Wave 3 -  
Organization and developer tools:
- Folder Organization (organize files in folders)
- API Access (developer API for integrations)
- Webhooks (real-time event notifications)
- CDN Distribution (fast global file delivery)

### Wave 4 -  
Collaboration and monetization:
- Team Collaboration (share folders with teams)
- Advanced Permissions (granular access control)
- Subscriptions (recurring payments)
- Social Sharing (share to social platforms)

### Wave 5 

- Prodtional ready 
- finishing the things and feature 
- add soem more cool adn important feature 
 

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- MetaMask or another Web3 wallet
- Sepolia test ETH (for deployment)

### Installation

```bash
# Clone the repository
cd frontend

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Start development server
pnpm dev
```

### Environment Variables

```env
# WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Contract Address
NEXT_PUBLIC_CONTRACT_ADDRESS=0x4a69Db2288Bb9868Bf6eB87FFBcfaeebB51231e8

# RPC URLs
SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Pinata IPFS (for file uploads)
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt
```

### Smart Contract Commands

```bash
# Compile contracts
pnpm compile

# Deploy to Sepolia
pnpm deploy --network sepolia

# Run tests
pnpm test
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with video hero and wallet connect |
| `/dashboard` | Main dashboard with stats from blockchain |
| `/upload` | Upload files with encrypted access rules |
| `/files` | Manage uploaded files |
| `/share/[id]` | Public share page with on-chain verification |
| `/settings` | Privacy settings and preferences |

## Smart Contract Functions

### File Management
- `uploadFile()` - Upload file with encrypted access rules
- `requestAccess()` - Request access with payment
- `downloadFile()` - Download after access verification
- `verifyPassword()` - Verify password on encrypted data

### Access Control
- `getFileInfo()` - Get file details
- `getAccessInfo()` - Get user's access status
- `getMyFiles()` - Get files owned by caller

### Owner Functions
- `deactivateFile()` - Deactivate a file
- `updateFileRules()` - Update access rules
- `withdraw()` - Withdraw earnings

## Use Cases

- **Legal Documents**: Share sensitive legal files with clients securely
- **Enterprise Data**: Distribute internal data without exposure
- **Private Content**: Monetize content with confidential pricing

## Resources

- [Fhenix Documentation](https://cofhe-docs.fhenix.zone)
- [Cofhe SDK](https://cofhe-docs.fhenix.zone/cofhejs)
- [FHE Library](https://cofhe-docs.fhenix.zone/fhe-library)
- [WalletConnect](https://cloud.walletconnect.com)

## Get Test ETH

To deploy contracts, you'll need Sepolia test ETH:

- https://www.sepoliafaucet.com/
- https://faucet.quicknode.com/ethereum/sepolia

## License

MIT

## Author

Built with Fhenix FHE Technology
