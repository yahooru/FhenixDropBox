// Fhenix/FHE client utilities
// Provides FHE-style encrypted value handling for the app

export interface EncryptedValue {
  ciphertext: string
  signature?: string
}

/**
 * Generate a random encryption key for file contents
 */
export function generateFileKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Encrypt a numeric value (simulates FHE encryption for demo)
 * In production, this would use cofhejs to encrypt with the Fhenix network
 */
export async function encryptValue(value: bigint, publicKey?: string): Promise<EncryptedValue> {
  // For now, return a "mock encrypted" format
  // Real FHE would use cofhejs.encrypt(publicKey, value)
  const mockCiphertext = '0x' + value.toString(16).padStart(64, '0')
  return {
    ciphertext: mockCiphertext,
    signature: Date.now().toString(36)
  }
}

/**
 * Decrypt a numeric value (simulates FHE decryption)
 * In production, this would use cofhejs.decrypt() after permit is granted
 */
export async function decryptValue(encrypted: EncryptedValue): Promise<bigint> {
  // For demo, parse from mock format
  // Real FHE would use cofhejs.decrypt()
  return BigInt(parseInt(encrypted.ciphertext.slice(2), 16))
}

/**
 * Hash a password/access code to a fixed-length value for storage
 * Similar to how FHE handles secret comparisons on-chain
 */
export function hashAccessCode(code: string): `0x${string}` {
  // Simple hash for demo - in real FHE, this would be done confidentially
  const { keccak256 } = require('viem')
  return keccak256(new TextEncoder().encode(code)) as `0x${string}`
}

/**
 * Generate a numeric access PIN from a password
 * FHE works best with numeric values, not strings
 */
export function passwordToPin(password: string): bigint {
  // Convert password to a numeric PIN
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return BigInt(Math.abs(hash))
}

/**
 * Client-side file encryption using Web Crypto API
 * AES-256-GCM for file contents
 */
export async function encryptFileContent(
  fileData: ArrayBuffer,
  key: string
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array; salt: Uint8Array }> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  const cryptoKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    fileData
  )

  return { encrypted, iv, salt }
}

/**
 * Client-side file decryption
 */
export async function decryptFileContent(
  encryptedData: ArrayBuffer,
  key: string,
  iv: Uint8Array,
  salt: Uint8Array
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  const cryptoKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encryptedData
  )
}

/**
 * Generate a random access code
 */
export function generateAccessCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Validate access code format
 */
export function isValidAccessCode(code: string): boolean {
  return /^[A-Z0-9]{6,16}$/i.test(code)
}
