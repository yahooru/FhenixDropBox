/**
 * FhenixDropBox contract utilities.
 *
 * The ABI is loaded from the compiled Hardhat artifact so the frontend stays
 * aligned with every contract compile/deploy.
 */

import { arbitrumSepolia, baseSepolia, sepolia } from 'wagmi/chains'
import { formatEther, keccak256, parseEther, type Abi } from 'viem'
import FhenixDropBoxArtifact from '@/artifacts/contracts/FhenixDropBox.sol/FhenixDropBox.json'

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x4B41c506a718774b15aDd13703B61B4C7282f221'

export const SUPPORTED_CHAINS = [sepolia, arbitrumSepolia, baseSepolia]
export const FHENIX_DROPBOX_ABI = FhenixDropBoxArtifact.abi as Abi

export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

export interface FileInfo {
  ipfsHash: string
  createdAt: bigint
  price: bigint
  maxDownloads: bigint
  downloadCount: bigint
  isActive: boolean
  hasPassword: boolean
  contentEncrypted: boolean
}

export interface FileMetadata {
  fileName: string
  mimeType: string
  fileSize: bigint
  expiresAt: bigint
  folderId: bigint
  previewEnabled: boolean
  previewHash: string
}

export interface FolderInfo {
  id: bigint
  owner: `0x${string}`
  name: string
  color: string
  createdAt: bigint
  fileCount: bigint
  isActive: boolean
}

export interface WebhookInfo {
  id: bigint
  owner: `0x${string}`
  endpointHash: `0x${string}`
  label: string
  eventMask: number
  isActive: boolean
  createdAt: bigint
}

export interface FilePrivacy {
  anonymousUpload: boolean
  visibleOwner: `0x${string}`
}

export type UploadInput = {
  ipfsHash: string
  fileName: string
  mimeType: string
  fileSize: bigint
  price: bigint
  maxDownloads: bigint
  expiryDays: bigint
  accessCodeHash: `0x${string}`
  contentEncrypted: boolean
  encryptionKeyHash: `0x${string}`
  folderId: bigint
  previewEnabled: boolean
  previewHash: string
  anonymousUpload: boolean
}

export function hashPassword(password: string): `0x${string}` {
  if (!password) return ZERO_BYTES32
  return keccak256(new TextEncoder().encode(password))
}

export function hashWebhookEndpoint(endpoint: string): `0x${string}` {
  return hashPassword(endpoint.trim())
}

export function parseNativePrice(value: string): bigint {
  const trimmed = value.trim()
  if (!trimmed) return 0n
  return parseEther(trimmed)
}

export function formatNativePrice(value: bigint | number): string {
  const wei = typeof value === 'bigint' ? value : BigInt(value)
  return Number(formatEther(wei)).toLocaleString('en-US', {
    maximumFractionDigits: 6,
  })
}

// Backward-compatible aliases for older components.
export const parseUSDC = parseNativePrice
export const formatUSDC = formatNativePrice

export function tupleToFileInfo(data: unknown): FileInfo | undefined {
  if (!Array.isArray(data)) return undefined
  return {
    ipfsHash: data[0] || '',
    createdAt: data[1] || 0n,
    price: data[2] || 0n,
    maxDownloads: data[3] || 0n,
    downloadCount: data[4] || 0n,
    isActive: data[5] || false,
    hasPassword: data[6] || false,
    contentEncrypted: data[7] || false,
  }
}

export function tupleToFileMetadata(data: unknown): FileMetadata | undefined {
  if (!Array.isArray(data)) return undefined
  return {
    fileName: data[0] || '',
    mimeType: data[1] || '',
    fileSize: data[2] || 0n,
    expiresAt: data[3] || 0n,
    folderId: data[4] || 0n,
    previewEnabled: data[5] || false,
    previewHash: data[6] || '',
  }
}

export function tupleToFolderInfo(data: unknown): FolderInfo | undefined {
  if (!Array.isArray(data)) return undefined
  return {
    id: data[0] || 0n,
    owner: data[1],
    name: data[2] || '',
    color: data[3] || '',
    createdAt: data[4] || 0n,
    fileCount: data[5] || 0n,
    isActive: data[6] || false,
  }
}

export function tupleToWebhookInfo(data: unknown): WebhookInfo | undefined {
  if (!Array.isArray(data)) return undefined
  return {
    id: data[0] || 0n,
    owner: data[1],
    endpointHash: data[2],
    label: data[3] || '',
    eventMask: Number(data[4] || 0),
    isActive: data[5] || false,
    createdAt: data[6] || 0n,
  }
}

export function tupleToFilePrivacy(data: unknown): FilePrivacy | undefined {
  if (!Array.isArray(data)) return undefined
  return {
    anonymousUpload: data[0] || false,
    visibleOwner: data[1],
  }
}

export function isExpired(expiresAt: bigint | number): boolean {
  const exp = typeof expiresAt === 'bigint' ? Number(expiresAt) : expiresAt
  return exp > 0 && Date.now() / 1000 > exp
}

export function getRemainingDownloads(maxDownloads: bigint | number, downloadCount: bigint | number): number {
  const max = Number(maxDownloads)
  const count = Number(downloadCount)
  if (max === 0) return Infinity
  return Math.max(0, max - count)
}

export function formatDate(timestamp: bigint | number): string {
  const seconds = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp
  if (!seconds) return 'Never'
  return new Date(seconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getFileType(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

export const RPC_URLS = {
  sepolia: 'https://ethereum-sepolia.publicnode.com',
  arbitrumSepolia: 'https://sepolia-rollup.arbitrum.io/rpc',
  baseSepolia: 'https://sepolia.base.org',
} as const

export const BLOCK_EXPLORERS = {
  sepolia: 'https://sepolia.etherscan.io',
  arbitrumSepolia: 'https://sepolia.arbiscan.io',
  baseSepolia: 'https://sepolia.basescan.org',
} as const
