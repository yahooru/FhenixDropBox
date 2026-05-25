import { getAddress, keccak256, toBytes, type Hex } from 'viem'
import type { UploadInput } from '@/lib/fhenix'
import { sepolia } from '@/lib/sepolia'

export const RELAYER_INTENT_VERSION = 'FhenixDropBox relayed upload v1'
export const MAX_RELAYER_INPUTS = 10
export const MAX_RELAYER_INTENT_TTL_SECONDS = 10 * 60

export type SerializedRelayerUploadInput = {
  ipfsHash: string
  fileName: string
  mimeType: string
  fileSize: string
  price: string
  maxDownloads: string
  expiryDays: string
  accessCodeHash: Hex
  contentEncrypted: boolean
  encryptionKeyHash: Hex
  folderId: string
  previewEnabled: boolean
  previewHash: string
  anonymousUpload: boolean
}

export type RelayerIntentPayload = {
  inputs: SerializedRelayerUploadInput[]
  owner: Hex
  ownerCommitment: Hex
  nonce: bigint | string | number
  expiresAt: bigint | string | number
  contractAddress: Hex
}

export function serializeRelayerInputs(inputs: UploadInput[]): SerializedRelayerUploadInput[] {
  return inputs.map((input) => ({
    ipfsHash: input.ipfsHash,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize.toString(),
    price: input.price.toString(),
    maxDownloads: input.maxDownloads.toString(),
    expiryDays: input.expiryDays.toString(),
    accessCodeHash: input.accessCodeHash,
    contentEncrypted: input.contentEncrypted,
    encryptionKeyHash: input.encryptionKeyHash,
    folderId: input.folderId.toString(),
    previewEnabled: input.previewEnabled,
    previewHash: input.previewHash,
    anonymousUpload: input.anonymousUpload,
  }))
}

export function buildRelayerIntentHash({
  inputs,
  owner,
  ownerCommitment,
  nonce,
  expiresAt,
  contractAddress,
}: RelayerIntentPayload) {
  return keccak256(toBytes(JSON.stringify({
    version: RELAYER_INTENT_VERSION,
    chainId: sepolia.id,
    contractAddress: getAddress(contractAddress),
    owner: getAddress(owner),
    ownerCommitment,
    nonce: nonce.toString(),
    expiresAt: expiresAt.toString(),
    inputs,
  })))
}
