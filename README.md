# FhenixDropBox

Privacy-first decentralized file sharing for the Fhenix ecosystem.

FhenixDropBox lets a user encrypt files in the browser, pin the encrypted payload to IPFS, register access rules on Sepolia, and share a secret link that keeps the file key off-chain. The app is built as a working Wave 1-4 product, with the remaining confidential-computing and automation work documented under Wave 5.

Live app: https://fhenixdropbox.vercel.app

## What It Does

- Encrypts file contents locally with AES-GCM before upload.
- Stores encrypted files and optional image/PDF previews on IPFS through Pinata.
- Registers file metadata and access rules on the deployed Sepolia contract.
- Supports native Sepolia ETH access payments with refund handling.
- Supports access PIN hashes, expiry, max download limits, and download accounting.
- Generates secret share links with the AES key and IV in the URL fragment.
- Provides QR sharing, folder organization, batch upload, batch download, webhooks, private analytics, and anonymous share mode.

## Deployed Contract

- Network: Ethereum Sepolia
- Address: `0x4B41c506a718774b15aDd13703B61B4C7282f221`
- Explorer: https://sepolia.etherscan.io/address/0x4B41c506a718774b15aDd13703B61B4C7282f221

## How It Works

1. Connect a wallet on Sepolia.
2. Upload one or more files on `/upload`.
3. The browser encrypts each file and sends only encrypted bytes to the server upload route.
4. The server pins the encrypted payload to IPFS using server-side Pinata credentials.
5. The app writes file rules to `FhenixDropBox.uploadFilesBatch`.
6. The uploader copies a secret share link or QR code.
7. A recipient opens `/share/[id]`, requests access on-chain, pays if required, and downloads.
8. The browser decrypts the file locally using the secret fragment in the URL.

## Wave Status

### Wave 1 - Core Sharing

- Wallet connection.
- Single-file upload.
- Encrypted file delivery.
- Sepolia contract deployment.
- On-chain access rules.

### Wave 2 - Share And Download Flow

- Public share pages.
- QR codes.
- Secret share links.
- On-chain access checks.
- On-chain download tracking.
- Local AES decrypt and download.

### Wave 3 - Rich File Rules

- Multi-file upload, up to 10 files per batch.
- Public previews for images and PDFs.
- 24h, 7d, 30d, or no-expiry links.
- Native ETH payment and refund handling.
- Batch download accounting.
- Private analytics from contract reads.
- Anonymous share mode for public owner lookups.

### Wave 4 - Organization And Developer Tools

- Folder creation and file moves.
- Webhook endpoint hash registry.
- Event masks for upload, access, and download consumers.
- IPFS gateway delivery.
- Settings defaults for new uploads.
- Production build wired to the latest deployed contract.

### Wave 5 - Final Items Still To Build

These are not fully production-complete yet and are intentionally tracked for Wave 5:

- Real CoFHE encrypted access-rule storage using current Fhenix `@cofhe/sdk` and `@fhenixprotocol/cofhe-contracts` patterns.
- Relayer or account-abstraction flow for stronger anonymous uploads. Current anonymous mode hides owner lookup in the app contract API, but the originating wallet transaction remains visible on public Sepolia explorers.
- Webhook delivery worker. The contract stores hashed webhook endpoints and event masks today; a backend/indexer still needs to deliver events to user endpoints.
- Team folders and shared folder permissions.
- Recurring subscriptions and recurring access payments.
- Production analytics indexer for historical charts beyond direct contract reads.
- Contract verification and monitoring pipeline for main deployment environments.
- Larger-file resumable uploads and dedicated gateway/CDN configuration.
- Pinata credential rotation before public production launch, because the current test credentials were shared during development.

## Environment

Create `.env.local` from `.env.example` and fill the values:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_CONTRACT_ADDRESS=0x4B41c506a718774b15aDd13703B61B4C7282f221

SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

PINATA_JWT=your_server_side_pinata_jwt
PINATA_API_KEY=optional_pinata_api_key
PINATA_API_SECRET=optional_pinata_api_secret
PRIVATE_KEY=your_testnet_deploy_key
ETHERSCAN_API_KEY=
```

Pinata credentials must stay server-side. Do not expose them as `NEXT_PUBLIC_*` values. The upload route uses `PINATA_API_KEY` + `PINATA_API_SECRET` first and falls back to `PINATA_JWT`.

## Commands

```bash
npm install
npm run compile
npm run test
npx tsc --noEmit
npm run build
npm run dev
```

Deploy to Sepolia:

```bash
npm run deploy:sepolia
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Product landing page |
| `/dashboard` | Wallet dashboard and contract stats |
| `/upload` | Encrypt, upload, preview, and register files |
| `/files` | Manage files, folders, QR links, anonymous mode, and batch downloads |
| `/share/[id]` | Recipient access, payment, decrypt, and download flow |
| `/settings` | Defaults, privacy controls, webhooks, and appearance |

## Notes

- The current production path is AES-encrypted IPFS delivery plus Sepolia-enforced access rules.
- File keys are not stored on-chain.
- Access code values are not stored directly; the contract stores hashes.
- The Wave 5 CoFHE work is the final step for confidential on-chain rule storage.
