/**
 * IPFS Integration Utilities
 *
 * This module provides utilities for uploading and retrieving files from IPFS.
 * Uses Pinata as the IPFS provider.
 *
 * IMPORTANT: Pinata JWT should be used server-side only.
 * For client-side, use the /api/ipfs route instead.
 */

const PINATA_API_URL = 'https://api.pinata.cloud'
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs'
const PUBLIC_GATEWAY = 'https://ipfs.io/ipfs'

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

// ─── Server-side Upload ────────────────────────────────────────────────────────

/**
 * Upload a file to IPFS via Pinata (server-side only)
 * Use this in API routes with PINATA_JWT env var (server-only)
 */
export async function uploadToIPFSServer(fileBuffer: ArrayBuffer, filename: string): Promise<UploadResult> {
  const pinataJWT = process.env.PINATA_JWT

  if (!pinataJWT) {
    throw new Error('PINATA_JWT not configured on server')
  }

  const formData = new FormData()
  const blob = new Blob([fileBuffer])
  formData.append('file', blob, filename)

  const metadata = JSON.stringify({
    name: filename,
    keyvalues: {
      uploadedAt: new Date().toISOString(),
      encrypted: 'true'
    }
  })
  formData.append('pinataMetadata', metadata)

  const options = JSON.stringify({ cidVersion: 1 })
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

// ─── Client-side Upload ────────────────────────────────────────────────────────

/**
 * Upload a file to IPFS via API route (client-side safe)
 * The API route uses server-side Pinata JWT
 */
export async function uploadToIPFSViaAPI(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('IPFS upload error:', error)
    throw error
  }
}

/**
 * Upload file - chooses the right method based on context
 * In browser: uses API route
 * In server: uses server-side direct upload
 */
export async function uploadToIPFS(file: File): Promise<UploadResult> {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    return uploadToIPFSViaAPI(file)
  }
  // Server-side would need buffer conversion
  throw new Error('Use uploadToIPFSServer with file buffer for server-side')
}

// ─── Encrypted File Upload ──────────────────────────────────────────────────────

/**
 * Encrypt and upload a file (client-side)
 *
 * Flow:
 * 1. Generate AES-256 key
 * 2. Encrypt file content with AES
 * 3. Upload encrypted blob to IPFS
 * 4. Return hash + encryption key (key should be shared securely)
 */
export async function encryptAndUpload(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ ipfsHash: string; key: string; iv: string; size: number }> {
  onProgress?.(10)

  // Generate encryption key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12))

  onProgress?.(20)

  // Read file
  const fileBuffer = await file.arrayBuffer()

  onProgress?.(40)

  // Export key for storage/transmission
  const exportedKey = await crypto.subtle.exportKey('raw', key)
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)))

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileBuffer
  )

  onProgress?.(70)

  // Create encrypted blob
  const encryptedBlob = new Blob([encrypted], { type: 'application/octet-stream' })

  // Upload encrypted file to IPFS via API
  const result = await uploadToIPFSServer(encrypted, `encrypted_${file.name}`)

  onProgress?.(100)

  return {
    ipfsHash: result.hash,
    key: keyBase64,
    iv: btoa(String.fromCharCode(...iv)),
    size: result.size
  }
}

/**
 * Download and decrypt a file (client-side)
 */
export async function downloadAndDecrypt(
  ipfsHash: string,
  keyBase64: string,
  ivBase64: string,
  filename: string
): Promise<void> {
  // Fetch from IPFS
  const response = await fetch(`${PINATA_GATEWAY}/${ipfsHash}`)
  const encrypted = await response.arrayBuffer()

  // Import key
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  // Import IV
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0))

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  )

  // Download
  const blob = new Blob([decrypted])
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Standard IPFS Operations ─────────────────────────────────────────────────

/**
 * Get a file from IPFS
 */
export async function getFromIPFS(hash: string): Promise<Blob> {
  const gateways = [
    `${PINATA_GATEWAY}/${hash}`,
    `${PUBLIC_GATEWAY}/${hash}`,
    `https://cloudflare-ipfs.com/ipfs/${hash}`
  ]

  for (const gateway of gateways) {
    try {
      const response = await fetch(gateway)
      if (response.ok) {
        return await response.blob()
      }
    } catch {
      continue
    }
  }

  throw new Error('Failed to fetch from IPFS')
}

/**
 * Get the public gateway URL for an IPFS hash
 */
export function getIPFSUrl(hash: string): string {
  return `${PINATA_GATEWAY}/${hash}`
}

/**
 * Download a file from IPFS (unencrypted)
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
 * Pin an IPFS hash (server-side only)
 */
export async function pinHash(hash: string): Promise<boolean> {
  const pinataJWT = process.env.PINATA_JWT

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
        hostNodes: [{ host: "pinata", port: 443, protocol: "https" }]
      })
    })

    return response.ok
  } catch (error) {
    console.error('Pin error:', error)
    return false
  }
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

// ─── Encryption Utilities ───────────────────────────────────────────────────────

/**
 * Encrypt file content (client-side, standalone)
 * Uses Web Crypto API for AES-256-GCM encryption
 */
export async function encryptFile(
  file: File,
  keyBase64: string
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const fileBuffer = await file.arrayBuffer()

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileBuffer
  )

  return { encrypted, iv }
}

/**
 * Decrypt file content (client-side, standalone)
 */
export async function decryptFile(
  encrypted: ArrayBuffer,
  keyBase64: string,
  ivBase64: string
): Promise<ArrayBuffer> {
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0))

  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  )
}

/**
 * Generate a random encryption key (Base64 encoded)
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...key))
}

/**
 * Generate a random IV (Base64 encoded)
 */
export function generateIV(): string {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  return btoa(String.fromCharCode(...iv))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
