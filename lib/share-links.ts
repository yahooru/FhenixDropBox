import { CONTRACT_ADDRESS, hashPassword } from '@/lib/fhenix'

export interface LocalFileSecret {
  fileId: string
  fileName: string
  mimeType: string
  fileSize: number
  ipfsHash: string
  encrypted: boolean
  encryptionKey?: string
  encryptionIv?: string
  previewHash?: string
  folderId?: string
  anonymousUpload?: boolean
  createdAt: number
}

export interface ShareSecret {
  key?: string
  iv?: string
  name?: string
  type?: string
  anonymous?: boolean
}

function storageKey(owner: string) {
  return `fdb:file-secrets:${CONTRACT_ADDRESS.toLowerCase()}:${owner.toLowerCase()}`
}

export function generateShareCode(fileId: string, ipfsHash = ''): string {
  return hashPassword(`${fileId}:${ipfsHash}`).slice(2, 10).toUpperCase()
}

export function buildShareUrl(baseUrl: string, fileId: string, file?: Partial<LocalFileSecret>) {
  const code = generateShareCode(fileId, file?.ipfsHash || '')
  const url = new URL(`/share/${fileId}`, baseUrl)
  url.searchParams.set('h', code)
  if (file?.anonymousUpload) url.searchParams.set('anon', '1')

  if (file?.encrypted && file.encryptionKey && file.encryptionIv) {
    const secret = new URLSearchParams()
    secret.set('k', file.encryptionKey)
    secret.set('iv', file.encryptionIv)
    if (file.fileName) secret.set('n', file.fileName)
    if (file.mimeType) secret.set('t', file.mimeType)
    if (file.anonymousUpload) secret.set('a', '1')
    return `${url.toString()}#${secret.toString()}`
  }

  return url.toString()
}

export function parseShareSecret(hash: string): ShareSecret {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(cleaned)
  return {
    key: params.get('k') || undefined,
    iv: params.get('iv') || undefined,
    name: params.get('n') || undefined,
    type: params.get('t') || undefined,
    anonymous: params.get('a') === '1',
  }
}

export function saveLocalFileSecrets(owner: string, files: LocalFileSecret[]) {
  if (typeof window === 'undefined' || !owner) return

  const existing = getAllLocalFileSecrets(owner)
  const merged = new Map(existing.map((file) => [file.fileId, file]))
  files.forEach((file) => merged.set(file.fileId, file))
  window.localStorage.setItem(storageKey(owner), JSON.stringify(Array.from(merged.values())))
}

export function getAllLocalFileSecrets(owner: string): LocalFileSecret[] {
  if (typeof window === 'undefined' || !owner) return []

  try {
    const raw = window.localStorage.getItem(storageKey(owner))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getLocalFileSecret(owner: string | undefined, fileId: string): LocalFileSecret | undefined {
  if (!owner) return undefined
  return getAllLocalFileSecrets(owner).find((file) => file.fileId === fileId)
}
