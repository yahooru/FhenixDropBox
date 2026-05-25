import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { Agent } from 'undici'
import { createPublicClient, http } from 'viem'
import { FHENIX_DROPBOX_ABI } from '@/lib/fhenix'
import { sepolia } from '@/lib/sepolia'
import { WEBHOOK_EVENT_MASKS } from '@/lib/webhooks'
import { WebhookTargetError, endpointHash, validateWebhookEndpoint } from '@/lib/webhook-targets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_RPC = 'https://ethereum-sepolia.publicnode.com'
type FetchInitWithDispatcher = RequestInit & { dispatcher: Agent }

class WebhookRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

function hasValidDeliverySecret(request: NextRequest) {
  const expected = process.env.WEBHOOK_DELIVERY_SECRET
  if (!expected) return false

  const provided =
    request.headers.get('x-fhenixdropbox-webhook-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''

  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
}

export async function POST(request: NextRequest) {
  try {
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
    const rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC
    if (!contractAddress) {
      return NextResponse.json({ error: 'Contract address is not configured' }, { status: 503 })
    }
    if (!process.env.WEBHOOK_DELIVERY_SECRET) {
      return NextResponse.json({ error: 'Webhook delivery secret is not configured' }, { status: 503 })
    }
    if (!hasValidDeliverySecret(request)) {
      return NextResponse.json({ error: 'Unauthorized webhook delivery' }, { status: 401 })
    }

    const body = await request.json()
    const webhookId = BigInt(body.webhookId || 0)
    const endpoint = await validateWebhookEndpoint(String(body.endpoint || ''))
    const eventType = String(body.eventType || '')
    const eventMask = WEBHOOK_EVENT_MASKS[eventType as keyof typeof WEBHOOK_EVENT_MASKS]
    const payload = body.payload || {}

    if (webhookId <= 0n) {
      return NextResponse.json({ error: 'Invalid webhook delivery payload' }, { status: 400 })
    }
    if (!eventMask) {
      return NextResponse.json({ error: 'Unsupported webhook event type' }, { status: 400 })
    }

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
    const hook = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: 'webhooks',
      args: [webhookId],
    }) as readonly [bigint, `0x${string}`, `0x${string}`, string, number, boolean, bigint]

    if (!hook[5]) {
      return NextResponse.json({ error: 'Webhook is not active' }, { status: 409 })
    }

    if (hook[2].toLowerCase() !== endpointHash(endpoint.registeredEndpoint).toLowerCase()) {
      return NextResponse.json({ error: 'Endpoint hash does not match on-chain webhook' }, { status: 403 })
    }
    if ((Number(hook[4]) & eventMask) === 0) {
      return NextResponse.json({ error: 'Webhook is not subscribed to this event type' }, { status: 403 })
    }

    const dispatcher = new Agent({
      connect: {
        lookup(_hostname, _options, callback) {
          callback(null, endpoint.resolvedAddress, endpoint.resolvedFamily)
        },
      },
    })
    let response: Response
    try {
      response = await fetch(endpoint.deliveryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FhenixDropBox-Webhook': webhookId.toString(),
          'X-FhenixDropBox-Event': eventType,
        },
        redirect: 'manual',
        dispatcher,
        body: JSON.stringify({
          id: webhookId.toString(),
          event: eventType,
          contract: contractAddress,
          deliveredAt: new Date().toISOString(),
          payload,
        }),
      } as FetchInitWithDispatcher)
    } finally {
      await dispatcher.close()
    }

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    }, { status: response.ok ? 200 : 502 })
  } catch (error) {
    if (error instanceof WebhookRequestError || error instanceof WebhookTargetError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Webhook delivery error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook delivery failed' },
      { status: 500 },
    )
  }
}
