/**
 * IPFS Integration Utilities
 *
 * This module provides utilities for uploading and retrieving files from IPFS.
 * Uses Pinata as the IPFS provider.
 */

const PINATA_API_URL = 'https://api.pinata.cloud'

interface PinataResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

interface UploadResult {
  hash: string
  size: number
  timestamp: string
}

/**
 * Upload a file to IPFS via Pinata
 *
 * @param file - The file to upload
 * @returns The IPFS hash and metadata
 */
export async function uploadToIPFS(file: File): Promise<UploadResult> {
  const pinataJWT = process.env.NEXT_PUBLIC_PINATA_JWT || process.env.PINATA_JWT

  if (!pinataJWT) {
    // Fallback to mock upload for demo
    return mockUpload(file)
  }

  const formData = new FormData()
  formData.append('file', file)

  const metadata = JSON.stringify({
    name: file.name,
    keyvalues: {
      type: file.type,
      size: file.size
    }
  })
  formData.append('pinataMetadata', metadata)

  const options = JSON.stringify({
    cidVersion: 1
  })
  formData.append('pinataContent', options)

  try {
    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const result: PinataResponse = await response.json()

    return {
      hash: result.IpfsHash,
      size: result.PinSize,
      timestamp: result.Timestamp
    }
  } catch (error) {
    console.error('IPFS upload error:', error)
    throw error
  }
}

/**
 * Mock upload for demo purposes
 */
async function mockUpload(file: File): Promise<UploadResult> {
  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Generate a mock IPFS hash
  const mockHash = 'Qm' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

  return {
    hash: mockHash,
    size: file.size,
    timestamp: new Date().toISOString()
  }
}

/**
 * Get a file from IPFS
 *
 * @param hash - The IPFS hash
 * @returns The file content as a blob
 */
export async function getFromIPFS(hash: string): Promise<Blob> {
  // Try multiple IPFS gateways
  const gateways = [
    `https://gateway.pinata.cloud/ipfs/${hash}`,
    `https://ipfs.io/ipfs/${hash}`,
    `https://cloudflare-ipfs.com/ipfs/${hash}`
  ]

  for (const gateway of gateways) {
    try {
      const response = await fetch(gateway)
      if (response.ok) {
        return await response.blob()
      }
    } catch (error) {
      console.warn(`Gateway ${gateway} failed:`, error)
      continue
    }
  }

  throw new Error('Failed to fetch from IPFS')
}

/**
 * Get the public gateway URL for an IPFS hash
 */
export function getIPFSUrl(hash: string): string {
  return `https://gateway.pinata.cloud/ipfs/${hash}`
}

/**
 * Download a file from IPFS
 *
 * @param hash - The IPFS hash
 * @param filename - The filename to save as
 */
export async function downloadFromIPFS(hash: string, filename: string): Promise<void> {
  const blob = await getFromIPFS(hash)
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Pin an IPFS hash (keep it available)
 */
export async function pinHash(hash: string): Promise<boolean> {
  const pinataJWT = process.env.NEXT_PUBLIC_PINATA_JWT || process.env.PINATA_JWT

  if (!pinataJWT) {
    console.warn('Pinata JWT not configured, skipping pin')
    return false
  }

  try {
    const response = await fetch(`${PINATA_API_URL}/pinning/pinByHash`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        hashToPin: hash,
        hostNodes: [
          {
            host: "pinata",
            port: 443,
            protocol: "https"
          }
        ]
      })
    })

    return response.ok
  } catch (error) {
    console.error('Pin error:', error)
    return false
  }
}

/**
 * Unpin an IPFS hash
 */
export async function unpinHash(hash: string): Promise<boolean> {
  // This would require fetching pinned items and finding the ID
  // For simplicity, just log a warning
  console.warn('Unpin requires Pinata API access')
  return false
}

/**
 * Check if a hash exists on IPFS
 */
export async function checkIPFSExists(hash: string): Promise<boolean> {
  try {
    const response = await fetch(getIPFSUrl(hash), { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Encrypt file content (client-side)
 * Uses Web Crypto API for client-side encryption
 */
export async function encryptFile(file: File, password: string): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: crypto.getRandomValues(new Uint8Array(16)),
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    await file.arrayBuffer()
  )

  return { encrypted, iv }
}

/**
 * Decrypt file content (client-side)
 */
export async function decryptFile(
  encrypted: ArrayBuffer,
  password: string,
  salt: Uint8Array,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  )
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Get file icon based on type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'sheet'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive'
  return 'file'
}
