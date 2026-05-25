import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'
import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress, isHex, recoverMessageAddress } from 'viem'
import {
  UPLOAD_AUTH_CHAIN_ID,
  buildUploadAuthorizationMessage,
  isUploadAuthorizationFresh,
  type UploadAuthorization,
} from '@/lib/upload-auth'
import { sepolia } from '@/lib/sepolia'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PINATA_API_URL = 'https://api.pinata.cloud'
const ROOT_DIR = process.env.RESUMABLE_UPLOAD_DIR ? path.resolve(process.env.RESUMABLE_UPLOAD_DIR) : ''
const MAX_CHUNKS = 512
const MAX_TOTAL_SIZE = 250 * 1024 * 1024
const MAX_CHUNK_SIZE = 4 * 1024 * 1024
const MAX_CHUNK_MULTIPART_BODY_SIZE = MAX_CHUNK_SIZE + 64 * 1024
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface UploadManifest {
  uploadId: string
  fileName: string
  mimeType: string
  totalSize: number
  totalChunks: number
  createdAt: string
  authorization: UploadAuthorization
}

interface PinataResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

type StreamingRequestInit = RequestInit & { duplex: 'half' }

class UploadRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

function requireUploadId(uploadId: string) {
  if (!UUID_PATTERN.test(uploadId)) {
    throw new UploadRequestError('Invalid upload id')
  }
  return uploadId
}

function requireResumableStorage() {
  if (!ROOT_DIR) {
    throw new UploadRequestError('Durable resumable upload storage is not configured', 501)
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

function assertMultipartChunkContentLength(request: NextRequest) {
  const contentLengthHeader = request.headers.get('content-length')
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : Number.NaN

  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new UploadRequestError('Chunk uploads must include a valid Content-Length header', 411)
  }
  if (contentLength > MAX_CHUNK_MULTIPART_BODY_SIZE) {
    throw new UploadRequestError('Chunk request is too large', 413)
  }
}

function uploadDir(uploadId: string) {
  requireResumableStorage()
  const safeId = requireUploadId(uploadId)
  const root = path.resolve(ROOT_DIR)
  const resolved = path.resolve(root, safeId)
  const relative = path.relative(root, resolved)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new UploadRequestError('Invalid upload path')
  }

  return resolved
}

function chunkPath(uploadId: string, index: number) {
  return path.join(uploadDir(uploadId), `${index}.part`)
}

async function readManifest(uploadId: string): Promise<UploadManifest> {
  const manifestPath = path.join(uploadDir(uploadId), 'manifest.json')
  return JSON.parse(await readFile(manifestPath, 'utf8')) as UploadManifest
}

async function writeManifest(manifest: UploadManifest) {
  const dir = uploadDir(manifest.uploadId)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest), 'utf8')
}

async function verifyUploadAuthorization(fileName: string, fileSize: number, authorization: UploadAuthorization) {
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
  if (!contractAddress) {
    throw new UploadRequestError('Contract address is not configured', 503)
  }

  if (
    !isAddress(authorization.owner) ||
    !isHex(authorization.signature, { strict: true }) ||
    !isHex(authorization.contentHash, { strict: true }) ||
    authorization.contentHash.length !== 66
  ) {
    throw new UploadRequestError('Invalid upload authorization')
  }

  if (authorization.chainId !== UPLOAD_AUTH_CHAIN_ID.toString() || sepolia.id !== UPLOAD_AUTH_CHAIN_ID) {
    throw new UploadRequestError('Invalid upload chain')
  }

  if (!isUploadAuthorizationFresh(authorization.timestamp)) {
    throw new UploadRequestError('Upload authorization expired', 401)
  }

  const normalizedOwner = getAddress(authorization.owner)
  const recovered = await recoverMessageAddress({
    message: buildUploadAuthorizationMessage({
      owner: normalizedOwner,
      contractAddress,
      chainId: authorization.chainId,
      fileName,
      fileSize,
      contentHash: authorization.contentHash,
      timestamp: authorization.timestamp,
    }),
    signature: authorization.signature,
  })

  if (getAddress(recovered) !== normalizedOwner) {
    throw new UploadRequestError('Invalid upload signature', 401)
  }
}

async function receivedChunks(uploadId: string) {
  const files = await readdir(uploadDir(uploadId))
  return files.filter((file) => file.endsWith('.part')).length
}

async function receivedBytes(uploadId: string, excludeIndex?: number) {
  const files = await readdir(uploadDir(uploadId))
  let total = 0

  for (const file of files) {
    if (!file.endsWith('.part')) continue
    if (excludeIndex !== undefined && file === `${excludeIndex}.part`) continue
    total += (await stat(path.join(uploadDir(uploadId), file))).size
  }

  return total
}

function escapeMultipartHeader(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '%22').replace(/[\r\n]/g, '_')
}

async function validateChunkSet(manifest: UploadManifest) {
  const hash = createHash('sha256')
  let total = 0

  for (let i = 0; i < manifest.totalChunks; i++) {
    const partPath = chunkPath(manifest.uploadId, i)
    const partStat = await stat(partPath)
    total += partStat.size

    for await (const chunk of createReadStream(partPath)) {
      hash.update(chunk)
    }
  }

  return {
    size: total,
    contentHash: `0x${hash.digest('hex')}`,
  }
}

async function* chunkFileBody(manifest: UploadManifest) {
  for (let i = 0; i < manifest.totalChunks; i++) {
    for await (const chunk of createReadStream(chunkPath(manifest.uploadId, i))) {
      yield chunk
    }
  }
}

async function* multipartUploadBody(manifest: UploadManifest, boundary: string) {
  const metadata = JSON.stringify({
    name: manifest.fileName,
    keyvalues: {
      uploadedAt: new Date().toISOString(),
      platform: 'FhenixDropBox',
      resumable: 'true',
      encrypted: 'true',
    },
  })
  const content = JSON.stringify({ cidVersion: 1 })
  const fileName = escapeMultipartHeader(manifest.fileName)
  yield Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${manifest.mimeType}\r\n\r\n`,
  )
  yield* chunkFileBody(manifest)
  yield Buffer.from(
    `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="pinataMetadata"\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="pinataContent"\r\n\r\n${content}\r\n` +
      `--${boundary}--\r\n`,
  )
}

async function uploadAssembledFile(manifest: UploadManifest) {
  const authHeaders = getPinataAuthHeaders()
  if (!authHeaders) {
    throw new Error('Pinata credentials are not configured on the server')
  }

  const boundary = `----FhenixDropBox${randomUUID().replace(/-/g, '')}`
  const body = Readable.toWeb(Readable.from(multipartUploadBody(manifest, boundary))) as BodyInit

  const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
    duplex: 'half',
  } as StreamingRequestInit)

  if (!response.ok) {
    throw new Error('Failed to upload assembled file to IPFS')
  }

  const result: PinataResponse = await response.json()
  return {
    hash: result.IpfsHash,
    size: result.PinSize,
    timestamp: result.Timestamp,
  }
}

export async function POST(request: NextRequest) {
  try {
    requireResumableStorage()
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      assertMultipartChunkContentLength(request)
      const formData = await request.formData()
      const uploadId = requireUploadId(String(formData.get('uploadId') || ''))
      const index = Number(formData.get('index'))
      const chunk = formData.get('chunk') as File | null
      const manifest = await readManifest(uploadId)

      if (!chunk || !Number.isInteger(index) || index < 0 || index >= manifest.totalChunks) {
        return NextResponse.json({ error: 'Invalid chunk request' }, { status: 400 })
      }
      const bytesBeforeChunk = await receivedBytes(uploadId, index)
      if (chunk.size <= 0 || chunk.size > MAX_CHUNK_SIZE || bytesBeforeChunk + chunk.size > manifest.totalSize) {
        return NextResponse.json({ error: 'Invalid chunk size' }, { status: 400 })
      }

      await writeFile(chunkPath(uploadId, index), Buffer.from(await chunk.arrayBuffer()))
      return NextResponse.json({
        uploadId,
        receivedChunks: await receivedChunks(uploadId),
        totalChunks: manifest.totalChunks,
      })
    }

    const body = await request.json()

    if (body.action === 'init') {
      const totalSize = Number(body.totalSize)
      const totalChunks = Number(body.totalChunks)
      if (!body.fileName || !Number.isFinite(totalSize) || totalSize <= 0 || totalSize > MAX_TOTAL_SIZE) {
        return NextResponse.json({ error: 'Invalid file size' }, { status: 400 })
      }
      if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > MAX_CHUNKS) {
        return NextResponse.json({ error: 'Invalid chunk count' }, { status: 400 })
      }

      const authorization = body.authorization as UploadAuthorization | undefined
      if (!authorization) {
        return NextResponse.json({ error: 'Missing upload authorization' }, { status: 400 })
      }
      await verifyUploadAuthorization(String(body.fileName), totalSize, authorization)

      const uploadId = randomUUID()
      await writeManifest({
        uploadId,
        fileName: String(body.fileName),
        mimeType: String(body.mimeType || 'application/octet-stream'),
        totalSize,
        totalChunks,
        createdAt: new Date().toISOString(),
        authorization,
      })

      return NextResponse.json({ uploadId })
    }

    if (body.action === 'status') {
      const manifest = await readManifest(requireUploadId(String(body.uploadId || '')))
      return NextResponse.json({
        uploadId: manifest.uploadId,
        receivedChunks: await receivedChunks(manifest.uploadId),
        totalChunks: manifest.totalChunks,
      })
    }

    if (body.action === 'complete') {
      const manifest = await readManifest(requireUploadId(String(body.uploadId || '')))
      const assembled = await validateChunkSet(manifest)
      if (assembled.size !== manifest.totalSize) {
        throw new UploadRequestError('Assembled upload size mismatch')
      }
      if (assembled.contentHash.toLowerCase() !== manifest.authorization.contentHash.toLowerCase()) {
        throw new UploadRequestError('Upload content hash mismatch')
      }
      const result = await uploadAssembledFile(manifest)
      await rm(uploadDir(manifest.uploadId), { recursive: true, force: true })
      return NextResponse.json(result)
    }

    if (body.action === 'abort') {
      await rm(uploadDir(requireUploadId(String(body.uploadId || ''))), { recursive: true, force: true })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    if (error instanceof UploadRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Resumable upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
