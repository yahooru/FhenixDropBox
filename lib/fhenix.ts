/**
 * Fhenix Integration Utilities
 *
 * Utilities for interacting with FhenixDropBox smart contract on Sepolia.
 */

import { sepolia, arbitrumSepolia } from 'wagmi/chains'

// Contract address
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x820D442CC6BB930307183926C7805212668C7Cff'

// Supported chains
export const SUPPORTED_CHAINS = [sepolia, arbitrumSepolia]

// Contract ABI
export const FHENIX_DROPBOX_ABI = [
  {
    name: "uploadFile",
    type: "function",
    inputs: [
      { name: "ipfsHash_", type: "string" },
      { name: "price_", type: "uint256" },
      { name: "maxDownloads_", type: "uint256" },
      { name: "expiryDays_", type: "uint256" },
      { name: "accessCodeHash_", type: "bytes32" },
      { name: "contentEncrypted_", type: "bool" },
      { name: "encryptionKeyHash_", type: "bytes32" }
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    name: "requestAccess",
    type: "function",
    inputs: [
      { name: "fileId", type: "uint256" },
      { name: "accessCode_", type: "bytes32" }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    name: "requestAccessERC20",
    type: "function",
    inputs: [
      { name: "fileId", type: "uint256" },
      { name: "accessCode_", type: "bytes32" },
      { name: "amount_", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "downloadFile",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "getFileInfo",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [
      { name: "ipfsHash", type: "string" },
      { name: "createdAt", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "maxDownloads", type: "uint256" },
      { name: "downloadCount", type: "uint256" },
      { name: "isActive", type: "bool" },
      { name: "hasPassword", type: "bool" },
      { name: "contentEncrypted", type: "bool" }
    ],
    stateMutability: "view"
  },
  {
    name: "getFileExpiry",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "getAccessInfo",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [
      { name: "isAuthorized", type: "bool" },
      { name: "hasDownloaded", type: "bool" }
    ],
    stateMutability: "view"
  },
  {
    name: "getFileOwner",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  },
  {
    name: "getEncryptionInfo",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [
      { name: "contentEncrypted", type: "bool" },
      { name: "isOwnerOrAuthorized", type: "bool" }
    ],
    stateMutability: "view"
  },
  {
    name: "getMyFiles",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view"
  },
  {
    name: "getStats",
    type: "function",
    inputs: [],
    outputs: [
      { name: "_totalFiles", type: "uint256" },
      { name: "_totalDownloads", type: "uint256" },
      { name: "_totalVolume", type: "uint256" },
      { name: "_myFileCount", type: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    name: "getRemainingDownloads",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "isFileExpired",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    name: "getLatestFileId",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "deactivateFile",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "reactivateFile",
    type: "function",
    inputs: [{ name: "fileId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "updateFileRules",
    type: "function",
    inputs: [
      { name: "fileId", type: "uint256" },
      { name: "newPrice", type: "uint256" },
      { name: "newMaxDownloads", type: "uint256" },
      { name: "newExpiryDays", type: "uint256" },
      { name: "newAccessCodeHash", type: "bytes32" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "revokeAccess",
    type: "function",
    inputs: [
      { name: "fileId", type: "uint256" },
      { name: "user", type: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "totalFiles",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "totalDownloads",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  }
] as const

// ─── Utility Functions ────────────────────────────────────────────────────────

export const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const

/**
 * Hash password for storage
 */
export function hashPassword(password: string): `0x${string}` {
  if (!password) return ZERO_BYTES32
  const { keccak256 } = require('viem')
  return keccak256(new TextEncoder().encode(password)) as `0x${string}`
}

/**
 * Format USDC value for display
 */
export function formatUSDC(value: bigint | number): string {
  const num = typeof value === 'bigint' ? Number(value) : value
  return (num / 1000000).toFixed(2)
}

/**
 * Parse USDC input to wei
 */
export function parseUSDC(value: string): bigint {
  const num = parseFloat(value)
  return BigInt(Math.floor(num * 1000000))
}

/**
 * Check if a file has expired
 */
export function isExpired(expiresAt: number): boolean {
  return expiresAt > 0 && Date.now() / 1000 > expiresAt
}

/**
 * Get remaining downloads
 */
export function getRemainingDownloads(maxDownloads: number, downloadCount: number): number {
  if (maxDownloads === 0) return Infinity
  return Math.max(0, maxDownloads - downloadCount)
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Get file type from filename
 */
export function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ext
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const RPC_URLS = {
  sepolia: 'https://ethereum-sepolia.publicnode.com',
  arbitrumSepolia: 'https://sepolia-rollup.arbitrum.io/rpc',
  baseSepolia: 'https://sepolia.base.org'
} as const

export const BLOCK_EXPLORERS = {
  sepolia: 'https://sepolia.etherscan.io',
  arbitrumSepolia: 'https://sepolia.arbiscan.io',
  baseSepolia: 'https://sepolia.basescan.org'
} as const
