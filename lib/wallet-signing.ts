import { getAddress, isHex, stringToHex, type Hex, type WalletClient } from "viem"

export type WalletSignableMessage = string | { raw: Hex }

interface RequestProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  selectedAddress?: string
  providers?: unknown[]
}

interface ProviderConnector {
  getProvider?: () => Promise<unknown> | unknown
}

interface SignWalletMessageParams {
  account: Hex
  message: WalletSignableMessage
  walletClient?: WalletClient | null
  connector?: ProviderConnector | null
}

function isRequestProvider(value: unknown): value is RequestProvider {
  return !!value && typeof value === "object" && typeof (value as RequestProvider).request === "function"
}

function selectProvider(value: unknown, account: Hex): RequestProvider | null {
  if (isRequestProvider(value)) {
    const providers = Array.isArray(value.providers) ? value.providers.filter(isRequestProvider) : []
    if (providers.length > 0) {
      const accountLower = account.toLowerCase()
      return (
        providers.find((provider) => provider.selectedAddress?.toLowerCase() === accountLower) ||
        providers[0]
      )
    }
    return value
  }

  return null
}

async function getConnectorProvider(connector: ProviderConnector | null | undefined, account: Hex) {
  try {
    if (!connector?.getProvider) return null
    return selectProvider(await connector.getProvider(), account)
  } catch {
    return null
  }
}

function getInjectedProvider(account: Hex) {
  if (typeof window === "undefined") return null
  return selectProvider((window as Window & { ethereum?: unknown }).ethereum, account)
}

function isUserRejectedError(error: unknown) {
  const record = error as { code?: unknown; message?: unknown; shortMessage?: unknown; cause?: { code?: unknown; message?: unknown } }
  const code = Number(record?.code ?? record?.cause?.code)
  const message = `${record?.shortMessage || ""} ${record?.message || ""} ${record?.cause?.message || ""}`.toLowerCase()

  return code === 4001 || message.includes("user rejected") || message.includes("user denied") || message.includes("rejected the request")
}

function messageToPersonalSignPayload(message: WalletSignableMessage) {
  return typeof message === "string" ? stringToHex(message) : message.raw
}

async function personalSign(provider: RequestProvider, account: Hex, message: WalletSignableMessage): Promise<Hex> {
  const payload = messageToPersonalSignPayload(message)

  try {
    const signature = await provider.request({
      method: "personal_sign",
      params: [payload, account],
    })
    if (typeof signature === "string" && isHex(signature, { strict: true })) return signature
    throw new Error("Wallet returned an invalid signature")
  } catch (error) {
    if (isUserRejectedError(error)) throw error

    const legacySignature = await provider.request({
      method: "personal_sign",
      params: [account, payload],
    })
    if (typeof legacySignature === "string" && isHex(legacySignature, { strict: true })) return legacySignature
    throw new Error("Wallet returned an invalid signature")
  }
}

export async function signWalletMessage({
  account,
  message,
  walletClient,
  connector,
}: SignWalletMessageParams): Promise<Hex> {
  const normalizedAccount = getAddress(account) as Hex
  let walletClientError: unknown

  if (walletClient) {
    try {
      return await walletClient.signMessage({
        account: normalizedAccount,
        message,
      })
    } catch (error) {
      if (isUserRejectedError(error)) throw error
      walletClientError = error
    }
  }

  const provider = (await getConnectorProvider(connector, normalizedAccount)) || getInjectedProvider(normalizedAccount)
  if (provider) {
    return personalSign(provider, normalizedAccount, message)
  }

  if (walletClientError instanceof Error) {
    throw new Error(`Wallet signature failed: ${walletClientError.message}`)
  }

  throw new Error("Wallet signer is not available. Reconnect your wallet and try again.")
}
