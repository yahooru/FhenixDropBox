import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, getAddress, http, isAddress, isHex, recoverMessageAddress } from 'viem'
import { FHENIX_DROPBOX_ABI } from '@/lib/fhenix'
import { sepolia } from '@/lib/sepolia'
import {
  buildWebhookTargetRegistrationMessage,
  hashWebhookTargetEndpoint,
  isWebhookTargetAuthorizationFresh,
} from '@/lib/webhooks'
import { WebhookTargetError, upsertWebhookTargets, validateWebhookEndpoint } from '@/lib/webhook-targets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_RPC = 'https://ethereum-sepolia.publicnode.com'

function parseWebhookId(value: unknown) {
  try {
    const parsed = BigInt(String(value || 0))
    if (parsed <= 0n) throw new Error()
    return parsed
  } catch {
    throw new WebhookTargetError('Invalid webhook id')
  }
}

export async function POST(request: NextRequest) {
  try {
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
    const rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC
    if (!contractAddress) {
      return NextResponse.json({ error: 'Contract address is not configured' }, { status: 503 })
    }

    const body = await request.json()
    const owner = String(body.owner || '')
    const webhookId = parseWebhookId(body.webhookId)
    const endpoint = await validateWebhookEndpoint(String(body.endpoint || ''))
    const eventMask = Number(body.eventMask || 0)
    const label = body.label ? String(body.label) : undefined
    const signature = String(body.signature || '')
    const timestamp = String(body.timestamp || '')
    const endpointHash = hashWebhookTargetEndpoint(endpoint.registeredEndpoint)

    if (!isAddress(owner) || !isHex(signature, { strict: true })) {
      return NextResponse.json({ error: 'Invalid webhook target registration' }, { status: 400 })
    }
    if (!Number.isInteger(eventMask) || eventMask <= 0) {
      return NextResponse.json({ error: 'Invalid webhook event mask' }, { status: 400 })
    }
    if (!isWebhookTargetAuthorizationFresh(timestamp)) {
      return NextResponse.json({ error: 'Webhook target authorization expired' }, { status: 401 })
    }

    const normalizedOwner = getAddress(owner)
    const message = buildWebhookTargetRegistrationMessage({
      contractAddress,
      chainId: sepolia.id,
      owner: normalizedOwner,
      webhookId: webhookId.toString(),
      endpoint: endpoint.registeredEndpoint,
      endpointHash,
      eventMask,
      timestamp,
    })
    const recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    })

    if (getAddress(recovered) !== normalizedOwner) {
      return NextResponse.json({ error: 'Invalid webhook target owner signature' }, { status: 401 })
    }

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
    const hook = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: 'webhooks',
      args: [webhookId],
    }) as readonly [bigint, `0x${string}`, `0x${string}`, string, number, boolean, bigint]
    const chainMask = Number(hook[4])

    if (getAddress(hook[1]) !== normalizedOwner) {
      return NextResponse.json({ error: 'Webhook target owner does not match on-chain webhook owner' }, { status: 403 })
    }
    if (!hook[5]) {
      return NextResponse.json({ error: 'Webhook is not active' }, { status: 409 })
    }
    if (hook[2].toLowerCase() !== endpointHash.toLowerCase()) {
      return NextResponse.json({ error: 'Endpoint hash does not match on-chain webhook' }, { status: 403 })
    }
    if ((eventMask & chainMask) !== eventMask) {
      return NextResponse.json({ error: 'Webhook target includes events not enabled on-chain' }, { status: 403 })
    }

    const targets = await upsertWebhookTargets({
      webhookId,
      endpoint: endpoint.registeredEndpoint,
      owner: normalizedOwner,
      label,
      eventMask,
    })

    return NextResponse.json({
      ok: true,
      webhookId: webhookId.toString(),
      targets: targets.length,
    })
  } catch (error) {
    if (error instanceof WebhookTargetError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Webhook target registration error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook target registration failed' },
      { status: 500 },
    )
  }
}
