/**
 * IPFS Upload API Route
 *
 * This is a server-side route that handles IPFS uploads securely.
 * The Pinata JWT is kept server-side only (PINATA_JWT env var).
 *
 * POST /api/ipfs/upload
 * Content-Type: multipart/form-data
 * Body: file (File)
 *
 * Returns: { hash: string, size: number, timestamp: string }
 */

import { NextRequest, NextResponse } from 'next/server'

const PINATA_API_URL = 'https://api.pinata.cloud'

interface PinataResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Get JWT from server-side env (NOT exposed to client!)
    const pinataJWT = process.env.PINATA_JWT

    if (!pinataJWT) {
      // Fallback for development without Pinata
      // In production, this should always be configured
      console.warn('PINATA_JWT not configured, using mock response')

      // Generate a realistic mock IPFS hash
      const mockHash = 'Qm' + Array.from({ length: 44 }, () =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
          [Math.floor(Math.random() * 64)]
      ).join('')

      return NextResponse.json({
        hash: mockHash,
        size: file.size,
        timestamp: new Date().toISOString()
      })
    }

    // Create form data for Pinata
    const pinataFormData = new FormData()
    pinataFormData.append('file', file)

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
      headers: {
        'Authorization': `Bearer ${pinataJWT}`
      },
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
    console.error('IPFS upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Disable caching for this route
export const dynamic = 'force-dynamic'
