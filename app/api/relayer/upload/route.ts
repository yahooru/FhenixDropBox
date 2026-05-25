import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  isHex,
  parseEventLogs,
  recoverMessageAddress,
  zeroHash,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { FHENIX_DROPBOX_ABI } from '@/lib/fhenix'
import { sepolia } from '@/lib/sepolia'
import {
  MAX_RELAYER_INPUTS,
  MAX_RELAYER_INTENT_TTL_SECONDS,
  buildRelayerIntentHash,
  serializeRelayerInputs,
} from '@/lib/relayer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_RPC = 'https://ethereum-sepolia.publicnode.com'

type RelayedUploadInput = {
  ipfsHash: string
  fileName: string
  mimeType: string
  fileSize: bigint
  price: bigint
  maxDownloads: bigint
  expiryDays: bigint
  accessCodeHash: Hex
  contentEncrypted: boolean
  encryptionKeyHash: Hex
  folderId: bigint
  previewEnabled: boolean
  previewHash: string
  anonymousUpload: boolean
}

class RelayerRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

function asBytes32(value: unknown, fallback: Hex = zeroHash) {
  const candidate = typeof value === 'string' && value ? value : fallback
  if (!isHex(candidate, { strict: true }) || candidate.length !== 66) {
    throw new RelayerRequestError('Invalid bytes32 value')
  }
  return candidate
}

function asUint(value: unknown, field: string) {
  try {
    const parsed = BigInt(String(value ?? 0))
    if (parsed < 0n) throw new Error()
    return parsed
  } catch {
    throw new RelayerRequestError(`Invalid ${field}`)
  }
}

function normalizeInputs(value: unknown): RelayedUploadInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_RELAYER_INPUTS) {
    throw new RelayerRequestError('Invalid relayed upload payload')
  }

  return value.map((input) => {
    if (!input || typeof input !== 'object') {
      throw new RelayerRequestError('Invalid upload input')
    }

    const record = input as Record<string, unknown>
    const ipfsHash = String(record.ipfsHash || '')
    const fileName = String(record.fileName || '')
    const mimeType = String(record.mimeType || 'application/octet-stream')

    if (!ipfsHash || !fileName) {
      throw new RelayerRequestError('Upload input is missing required metadata')
    }

    return {
      ipfsHash,
      fileName,
      mimeType,
      fileSize: asUint(record.fileSize, 'fileSize'),
      price: asUint(record.price, 'price'),
      maxDownloads: asUint(record.maxDownloads, 'maxDownloads'),
      expiryDays: asUint(record.expiryDays, 'expiryDays'),
      accessCodeHash: asBytes32(record.accessCodeHash),
      contentEncrypted: Boolean(record.contentEncrypted),
      encryptionKeyHash: asBytes32(record.encryptionKeyHash),
      folderId: asUint(record.folderId, 'folderId'),
      previewEnabled: Boolean(record.previewEnabled),
      previewHash: String(record.previewHash || ''),
      anonymousUpload: Boolean(record.anonymousUpload),
    }
  })
}

function assertOwnerAllowedForRelayer(owner: `0x${string}`) {
  const rawAllowlist = process.env.RELAYER_ALLOWED_OWNERS || ''
  const allowedOwners = rawAllowlist
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (!isAddress(entry)) {
        throw new RelayerRequestError('Relayer owner allowlist is misconfigured', 503)
      }
      return getAddress(entry)
    })

  if (allowedOwners.length === 0) {
    throw new RelayerRequestError('Relayer owner allowlist is not configured', 503)
  }

  if (!allowedOwners.includes(owner)) {
    throw new RelayerRequestError('Relayed uploads are not enabled for this wallet', 403)
  }
}

export async function POST(request: NextRequest) {
  try {
    const relayerKey = process.env.RELAYER_PRIVATE_KEY
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
    const rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC

    if (!relayerKey || !contractAddress) {
      return NextResponse.json(
        { error: 'Dedicated relayer key is not configured' },
        { status: 503 },
      )
    }

    const body = await request.json()
    const owner = String(body.owner || '')
    const ownerCommitment = asBytes32(body.ownerCommitment, zeroHash)
    const inputs = normalizeInputs(body.inputs)
    const signature = String(body.signature || '')
    const nonce = asUint(body.nonce, 'nonce')
    const expiresAt = asUint(body.expiresAt, 'expiresAt')
    const now = BigInt(Math.floor(Date.now() / 1000))

    if (!isAddress(owner) || !isHex(signature, { strict: true })) {
      return NextResponse.json({ error: 'Invalid relayed upload payload' }, { status: 400 })
    }

    if (expiresAt <= now || expiresAt > now + BigInt(MAX_RELAYER_INTENT_TTL_SECONDS)) {
      return NextResponse.json({ error: 'Relayed upload intent is expired or too far in the future' }, { status: 400 })
    }

    const normalizedOwner = getAddress(owner)
    assertOwnerAllowedForRelayer(normalizedOwner)
    const normalizedContract = getAddress(contractAddress)
    const intentHash = buildRelayerIntentHash({
      inputs: serializeRelayerInputs(inputs),
      owner: normalizedOwner,
      ownerCommitment,
      nonce,
      expiresAt,
      contractAddress: normalizedContract,
    })
    const recovered = await recoverMessageAddress({
      message: { raw: intentHash },
      signature: signature as Hex,
    })

    if (getAddress(recovered) !== normalizedOwner) {
      return NextResponse.json({ error: 'Invalid relayed upload owner signature' }, { status: 401 })
    }

    const account = privateKeyToAccount((relayerKey.startsWith('0x') ? relayerKey : `0x${relayerKey}`) as `0x${string}`)
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) })
    const trusted = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: 'trustedRelayers',
      args: [account.address],
    })

    if (!trusted) {
      return NextResponse.json(
        { error: 'Configured relayer is not trusted by the contract' },
        { status: 403 },
      )
    }

    const hash = await walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: 'relayedUploadFilesBatch',
      args: [inputs, normalizedOwner, ownerCommitment, intentHash],
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const relayedLogs = parseEventLogs({
      abi: FHENIX_DROPBOX_ABI,
      logs: receipt.logs,
      eventName: 'RelayedUpload',
    })
    const fileIds = relayedLogs.flatMap((log) => {
      const args = log.args as Record<string, unknown>
      const ids = args.fileIds
      return Array.isArray(ids) ? ids.map((id) => id.toString()) : []
    })

    return NextResponse.json({
      transactionHash: receipt.transactionHash,
      relayer: account.address,
      fileIds,
    })
  } catch (error) {
    if (error instanceof RelayerRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Relayed upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Relayed upload failed' },
      { status: 500 },
    )
  }
}
