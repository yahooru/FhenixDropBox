# FhenixDropBox

Privacy-first decentralized file sharing for the Fhenix ecosystem.

FhenixDropBox lets a user encrypt files in the browser, pin the encrypted payload to IPFS, register access rules on Sepolia, and share a secret link that keeps the file key off-chain. The app is now wired as a Wave 5 product with CoFHE encrypted rule mirrors, team folders, subscriptions, relayed anonymous upload support, resumable IPFS uploads, webhook delivery, analytics indexing, and deployment monitoring.

Live app: [https://fhenixdropbox.vercel.app](https://fhenixdropbox.vercel.app)

## What It Does

- Encrypts file contents locally with AES-GCM before upload.
- Stores encrypted files and optional public image previews on IPFS through Pinata.
- Registers file metadata and access rules on the deployed Sepolia contract.
- Supports native Sepolia ETH access payments with refund handling.
- Supports access PIN hashes, expiry, max download limits, and download accounting.
- Generates secret share links with the AES key and IV in the URL fragment.
- Provides QR sharing, folder organization, batch upload, batch download, webhooks, private analytics, and anonymous share mode.
- Stores access-rule mirrors as CoFHE encrypted handles using `@cofhe/sdk` and `@fhenixprotocol/cofhe-contracts`.
- Supports team folder permissions, recurring subscription access, trusted relayed uploads, webhook delivery, and resumable large-file upload.

## Deployment

- Network: Ethereum Sepolia
- Current Wave 5 contract: `0x80437029FA1a8367A83dA2860091aeA98Cf2D3bC`
- The configured `NEXT_PUBLIC_CONTRACT_ADDRESS` must pass `npm run production:check`, which verifies the deployed bytecode matches the local `FhenixDropBox` artifact.
- After deploying Wave 5, update `.env.local` and your hosting environment with the new contract address.
- The trusted relayer must remain funded on Sepolia for anonymous relayed uploads.

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
- Public previews for images.
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
- Production checks that verify the configured contract matches the local artifact.

### Wave 5 - Production Completion

- Real CoFHE encrypted access-rule mirrors using current Fhenix `@cofhe/sdk`, `@cofhe/hardhat-plugin`, and `@fhenixprotocol/cofhe-contracts` patterns.
- Trusted relayer endpoint and contract entrypoint for stronger anonymous uploads.
- Self-service webhook target registration plus a delivery endpoint and worker script that validates hashed webhook endpoints before delivery.
- Team folders and shared folder permissions.
- Recurring subscriptions and recurring access payments.
- Production analytics API that indexes recent upload, access, download, and subscription events.
- Contract verification and monitoring commands for Sepolia deployment environments.
- Larger-file resumable uploads with chunk assembly before IPFS pinning.
- Production environment check that blocks sample keys and missing Pinata/contract settings before launch.

## Environment

Create `.env.local` from `.env.example` and fill the values:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_CONTRACT_ADDRESS=0x_deployed_wave5_contract_address

SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

PINATA_JWT=your_server_side_pinata_jwt
PINATA_API_KEY=optional_pinata_api_key
PINATA_API_SECRET=optional_pinata_api_secret
PRIVATE_KEY=your_testnet_deploy_key
RELAYER_PRIVATE_KEY=dedicated_trusted_relayer_key_for_public_upload_api
RELAYER_ALLOWED_OWNERS=comma_separated_wallets_allowed_to_use_public_relayer
ETHERSCAN_API_KEY=
APP_BASE_URL=http://localhost:3000
WEBHOOK_DELIVERY_TARGETS=[]
WEBHOOK_DELIVERY_SECRET=replace_with_a_long_worker_secret
WEBHOOK_BLOCK_WINDOW=5000
WEBHOOK_CHECKPOINT_FILE=.webhook-checkpoints.json
WEBHOOK_TARGETS_FILE=.webhook-targets.json
ANALYTICS_BLOCK_WINDOW=25000
NEXT_PUBLIC_ENABLE_RESUMABLE_UPLOADS=false
RESUMABLE_UPLOAD_DIR=/absolute/path/to/durable/upload-storage
```

Pinata credentials must stay server-side. Do not expose them as `NEXT_PUBLIC_*` values. The upload route uses `PINATA_API_KEY` + `PINATA_API_SECRET` first and falls back to `PINATA_JWT`.

Resumable uploads are opt-in for production: set `NEXT_PUBLIC_ENABLE_RESUMABLE_UPLOADS=true` only when `RESUMABLE_UPLOAD_DIR` points at durable storage shared by the running server process. Webhook endpoint URLs are saved off-chain in `WEBHOOK_TARGETS_FILE`; the worker delivers only observed on-chain events and stores its high-water mark in `WEBHOOK_CHECKPOINT_FILE`.

## Commands

```bash
npm install
npm run compile
npm run test
npm run lint
npm run build
npm run production:check
npm run monitor:sepolia
npm run webhook:worker
npm run dev
```

Final release verification:

```bash
npm run lint
npm run build
npm run test
npm run production:check
npm run monitor:sepolia
npm run webhook:worker
```

The final Wave 5 flow is expected to run on Sepolia end to end: upload pins encrypted bytes to IPFS, writes file access rules on-chain, creates secret share links, supports recipient payment/access/download, and routes anonymous uploads through the trusted relayer.

Deploy to Sepolia:

```bash
npm run deploy:sepolia
npm run verify:sepolia -- <deployed_contract_address>
```

## Routes


| Route                   | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `/`                     | Product landing page                                                 |
| `/dashboard`            | Wallet dashboard and contract stats                                  |
| `/upload`               | Encrypt, upload, preview, and register files                         |
| `/files`                | Manage files, folders, QR links, anonymous mode, and batch downloads |
| `/share/[id]`           | Recipient access, payment, decrypt, and download flow                |
| `/settings`             | Defaults, privacy controls, webhooks, and appearance                 |
| `/api/ipfs/resumable`   | Chunked large-file upload assembly and Pinata pinning                |
| `/api/relayer/upload`   | Trusted relayer upload endpoint for anonymous mode                   |
| `/api/webhooks/deliver` | Webhook delivery endpoint with on-chain endpoint-hash validation     |
| `/api/analytics`        | Production analytics event-indexing endpoint                         |


##  

