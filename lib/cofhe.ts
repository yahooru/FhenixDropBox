import { EncryptStep, Encryptable, assertCorrectEncryptedItemInput, type EncryptedItemInput } from '@cofhe/sdk'
import { chains } from '@cofhe/sdk/chains'
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/web'
import { createPublicClient, http, type WalletClient } from 'viem'
import { RPC_URLS, ZERO_BYTES32, type ConfidentialRuleInput } from '@/lib/fhenix'
import { sepolia } from '@/lib/sepolia'

export interface EncryptAccessRulesParams {
  account: `0x${string}`
  walletClient: WalletClient
  priceWei: bigint
  maxDownloads: bigint
  expiryDays: bigint
  accessCodeHash: `0x${string}`
  onStep?: (label: string) => void
}

function splitBytes32(value: `0x${string}`) {
  const normalized = value === ZERO_BYTES32 ? ''.padStart(64, '0') : value.slice(2).padStart(64, '0')
  return {
    high: BigInt(`0x${normalized.slice(0, 32)}`),
    low: BigInt(`0x${normalized.slice(32)}`),
  }
}

function expiryTimestampFromDays(expiryDays: bigint) {
  if (expiryDays === 0n) return 0n
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
  return nowSeconds + expiryDays * 24n * 60n * 60n
}

function stepLabel(step: EncryptStep) {
  return String(step).replace(/([a-z])([A-Z])/g, '$1 $2')
}

export async function encryptAccessRulesForUpload({
  account,
  walletClient,
  priceWei,
  maxDownloads,
  expiryDays,
  accessCodeHash,
  onStep,
}: EncryptAccessRulesParams): Promise<ConfidentialRuleInput> {
  if (typeof window === 'undefined') {
    throw new Error('CoFHE encryption must run in the browser wallet context')
  }

  if (!walletClient) {
    throw new Error('No connected wallet client found for CoFHE encryption')
  }

  if (walletClient.account?.address?.toLowerCase() !== account.toLowerCase()) {
    throw new Error('Connected wallet account changed before CoFHE encryption')
  }

  if (maxDownloads > 4_294_967_295n) {
    throw new Error('CoFHE max downloads must fit uint32')
  }

  const config = createCofheConfig({
    supportedChains: [chains.sepolia],
    useWorkers: true,
  })
  const cofheClient = createCofheClient(config)
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URLS.sepolia),
  })
  const splitHash = splitBytes32(accessCodeHash)

  await cofheClient.connect(publicClient as never, walletClient as never)

  const encrypted = await cofheClient
    .encryptInputs([
      Encryptable.uint128(priceWei),
      Encryptable.uint32(maxDownloads),
      Encryptable.uint64(expiryTimestampFromDays(expiryDays)),
      Encryptable.uint128(splitHash.high),
      Encryptable.uint128(splitHash.low),
    ])
    .setAccount(account)
    .setChainId(sepolia.id)
    .onStep((step, context) => {
      if (context?.isStart) onStep?.(stepLabel(step))
    })
    .execute()

  encrypted.forEach((item) => assertCorrectEncryptedItemInput(item as EncryptedItemInput))

  return {
    price: encrypted[0],
    maxDownloads: encrypted[1],
    expiresAt: encrypted[2],
    accessCodeHashHigh: encrypted[3],
    accessCodeHashLow: encrypted[4],
    enabled: true,
  }
}
