export const UPLOAD_AUTH_TTL_MS = 10 * 60 * 1000
export const UPLOAD_AUTH_CHAIN_ID = 11155111

export interface UploadAuthorization {
  owner: `0x${string}`
  signature: `0x${string}`
  contentHash: `0x${string}`
  timestamp: string
  chainId: string
}

export interface UploadAuthorizationMessageInput {
  owner: string
  contractAddress: string
  chainId: string | number | bigint
  fileName: string
  fileSize: string | number | bigint
  contentHash: string
  timestamp: string | number | bigint
}

export function buildUploadAuthorizationMessage(input: UploadAuthorizationMessageInput) {
  return [
    'FhenixDropBox IPFS upload authorization',
    `Contract: ${input.contractAddress}`,
    `Chain ID: ${input.chainId.toString()}`,
    `Owner: ${input.owner}`,
    `File: ${input.fileName}`,
    `Size: ${input.fileSize.toString()}`,
    `SHA-256: ${input.contentHash}`,
    `Timestamp: ${input.timestamp.toString()}`,
  ].join('\n')
}

export function isUploadAuthorizationFresh(timestamp: string | number | bigint, now = Date.now()) {
  const value = Number(timestamp)
  return Number.isFinite(value) && Math.abs(now - value) <= UPLOAD_AUTH_TTL_MS
}
