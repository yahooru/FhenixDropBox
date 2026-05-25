/**
 * IPFS Upload API Route
 *
 * This is a server-side route that handles IPFS uploads securely.
 * Pinata credentials are kept server-side only.
 *
 * POST /api/ipfs/upload
 * Content-Type: multipart/form-data
 * Body: file (File)
 *
 * Returns: { hash: string, size: number, timestamp: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getAddress, isAddress, isHex, recoverMessageAddress } from 'viem'
import {
  UPLOAD_AUTH_CHAIN_ID,
  buildUploadAuthorizationMessage,
  isUploadAuthorizationFresh,
} from '@/lib/upload-auth'
import { sepolia } from '@/lib/sepolia'

const PINATA_API_URL = 'https://api.pinata.cloud'
const SINGLE_UPLOAD_MAX_FILE_SIZE = 8 * 1024 * 1024
const AES_GCM_TAG_BYTES = 16
const MAX_API_UPLOAD_FILE_SIZE = SINGLE_UPLOAD_MAX_FILE_SIZE + AES_GCM_TAG_BYTES
const MAX_MULTIPART_UPLOAD_BYTES = MAX_API_UPLOAD_FILE_SIZE + 1024 * 1024

interface PinataResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

class UploadRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

function getPinataAuthHeaders(): Record<string, string> | null {
  const apiKey = process.env.PINATA_API_KEY
  const apiSecret = process.env.PINATA_API_SECRET

  if (apiKey && apiSecret) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    }
  }

  const pinataJWT = process.env.PINATA_JWT
  if (pinataJWT) {
    return {
      Authorization: `Bearer ${pinataJWT}`,
    }
  }

  return null
}

function assertSafeUploadFile(file: File) {
  if (!file.name || file.name.length > 180 || /[\\/]/.test(file.name)) {
    throw new UploadRequestError('Invalid upload filename')
  }

  if (file.size <= 0) {
    throw new UploadRequestError('Upload file is empty')
  }

  if (file.size > MAX_API_UPLOAD_FILE_SIZE) {
    throw new UploadRequestError('Upload file is too large for the standard upload route', 413)
  }
}

async function verifyUploadAuthorization(file: File, formData: FormData, fileBytes: Buffer) {
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
  if (!contractAddress) {
    throw new UploadRequestError('Contract address is not configured', 503)
  }

  const owner = String(formData.get('owner') || '')
  const signature = String(formData.get('signature') || '')
  const contentHash = String(formData.get('contentHash') || '')
  const timestamp = String(formData.get('timestamp') || '')
  const chainId = String(formData.get('chainId') || '')
  const actualHash = `0x${createHash('sha256').update(fileBytes).digest('hex')}`

  if (!isAddress(owner) || !isHex(signature, { strict: true }) || !isHex(contentHash, { strict: true }) || contentHash.length !== 66) {
    throw new UploadRequestError('Invalid upload authorization')
  }

  if (chainId !== UPLOAD_AUTH_CHAIN_ID.toString() || sepolia.id !== UPLOAD_AUTH_CHAIN_ID) {
    throw new UploadRequestError('Invalid upload chain')
  }

  if (contentHash.toLowerCase() !== actualHash.toLowerCase()) {
    throw new UploadRequestError('Upload content hash mismatch')
  }

  if (!isUploadAuthorizationFresh(timestamp)) {
    throw new UploadRequestError('Upload authorization expired', 401)
  }

  const normalizedOwner = getAddress(owner)
  const recovered = await recoverMessageAddress({
    message: buildUploadAuthorizationMessage({
      owner: normalizedOwner,
      contractAddress,
      chainId,
      fileName: file.name,
      fileSize: file.size,
      contentHash,
      timestamp,
    }),
    signature: signature as `0x${string}`,
  })

  if (getAddress(recovered) !== normalizedOwner) {
    throw new UploadRequestError('Invalid upload signature', 401)
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_MULTIPART_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Upload request is too large for the standard upload route' },
        { status: 413 },
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    assertSafeUploadFile(file)
    const fileBytes = Buffer.from(await file.arrayBuffer())
    await verifyUploadAuthorization(file, formData, fileBytes)

    const authHeaders = getPinataAuthHeaders()

    if (!authHeaders) {
      return NextResponse.json(
        { error: 'Pinata credentials are not configured on the server' },
        { status: 500 }
      )
    }

    // Create form data for Pinata
    const pinataFormData = new FormData()
    pinataFormData.append('file', new File([fileBytes], file.name, { type: file.type }))

    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        platform: 'FhenixDropBox',
        encrypted: 'true'
      }
    })
    pinataFormData.append('pinataMetadata', metadata)

    const options = JSON.stringify({ cidVersion: 1 })
    pinataFormData.append('pinataContent', options)

    // Upload to Pinata
    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: authHeaders,
      body: pinataFormData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Pinata upload failed:', errorText)
      return NextResponse.json(
        { error: 'Failed to upload to IPFS' },
        { status: 500 }
      )
    }

    const result: PinataResponse = await response.json()

    return NextResponse.json({
      hash: result.IpfsHash,
      size: result.PinSize,
      timestamp: result.Timestamp
    })
  } catch (error) {
    if (error instanceof UploadRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    console.error('IPFS upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Disable caching for this route
export const dynamic = 'force-dynamic'
