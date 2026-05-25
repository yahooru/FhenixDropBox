import { NextResponse } from 'next/server'
import { createPublicClient, getContract, http } from 'viem'
import { FHENIX_DROPBOX_ABI } from '@/lib/fhenix'
import { sepolia } from '@/lib/sepolia'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_RPC = 'https://ethereum-sepolia.publicnode.com'
const DEFAULT_BLOCK_WINDOW = 25_000

export async function GET() {
  try {
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
    const rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC
    if (!contractAddress) {
      return NextResponse.json({ error: 'Contract address is not configured' }, { status: 503 })
    }

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
    const contract = getContract({
      address: contractAddress as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      client: publicClient,
    })
    const [latestBlock, stats] = await Promise.all([
      publicClient.getBlockNumber(),
      contract.read.getProductionStats(),
    ])
    const statTuple = stats as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint]
    const fromBlock = latestBlock > BigInt(process.env.ANALYTICS_BLOCK_WINDOW || DEFAULT_BLOCK_WINDOW)
      ? latestBlock - BigInt(process.env.ANALYTICS_BLOCK_WINDOW || DEFAULT_BLOCK_WINDOW)
      : 0n

    const [uploads, access, downloads, subscriptions] = await Promise.all([
      publicClient.getContractEvents({ address: contractAddress as `0x${string}`, abi: FHENIX_DROPBOX_ABI, eventName: 'FileUploaded', fromBlock, toBlock: latestBlock }),
      publicClient.getContractEvents({ address: contractAddress as `0x${string}`, abi: FHENIX_DROPBOX_ABI, eventName: 'FileAccessed', fromBlock, toBlock: latestBlock }),
      publicClient.getContractEvents({ address: contractAddress as `0x${string}`, abi: FHENIX_DROPBOX_ABI, eventName: 'FileDownloaded', fromBlock, toBlock: latestBlock }),
      publicClient.getContractEvents({ address: contractAddress as `0x${string}`, abi: FHENIX_DROPBOX_ABI, eventName: 'SubscriptionPaid', fromBlock, toBlock: latestBlock }),
    ])

    return NextResponse.json({
      contract: contractAddress,
      network: 'sepolia',
      latestBlock: latestBlock.toString(),
      fromBlock: fromBlock.toString(),
      totals: {
        files: statTuple[0].toString(),
        downloads: statTuple[1].toString(),
        volumeWei: statTuple[2].toString(),
        folders: statTuple[3].toString(),
        webhooks: statTuple[4].toString(),
        teams: statTuple[5].toString(),
        subscriptionPlans: statTuple[6].toString(),
      },
      window: {
        uploads: uploads.length,
        accessGrants: access.length,
        downloads: downloads.length,
        subscriptionPayments: subscriptions.length,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analytics indexer error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analytics indexer failed' },
      { status: 500 },
    )
  }
}
