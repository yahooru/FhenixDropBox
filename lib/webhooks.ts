import { keccak256, toBytes, type Hex } from 'viem'

export const WEBHOOK_EVENT_MASKS = {
  'file.uploaded': 1,
  'file.accessed': 2,
  'file.downloaded': 4,
  'subscription.paid': 8,
} as const

export type WebhookEventType = keyof typeof WEBHOOK_EVENT_MASKS

export const WEBHOOK_EVENT_TYPES = Object.keys(WEBHOOK_EVENT_MASKS) as WebhookEventType[]
export const WEBHOOK_ALL_EVENT_MASK = WEBHOOK_EVENT_TYPES.reduce((mask, eventType) => mask | WEBHOOK_EVENT_MASKS[eventType], 0)
export const WEBHOOK_TARGET_AUTH_TTL_MS = 10 * 60 * 1000

export interface WebhookTargetRegistrationMessageInput {
  contractAddress: string
  chainId: string | number | bigint
  owner: string
  webhookId: string | number | bigint
  endpoint: string
  endpointHash: string
  eventMask: string | number | bigint
  timestamp: string | number | bigint
}

export function hashWebhookTargetEndpoint(endpoint: string): Hex {
  return keccak256(toBytes(endpoint.trim()))
}

export function eventTypesFromMask(mask: number): WebhookEventType[] {
  return WEBHOOK_EVENT_TYPES.filter((eventType) => (mask & WEBHOOK_EVENT_MASKS[eventType]) !== 0)
}

export function buildWebhookTargetRegistrationMessage(input: WebhookTargetRegistrationMessageInput) {
  return [
    'FhenixDropBox webhook target registration',
    `Contract: ${input.contractAddress}`,
    `Chain ID: ${input.chainId.toString()}`,
    `Owner: ${input.owner}`,
    `Webhook ID: ${input.webhookId.toString()}`,
    `Endpoint: ${input.endpoint.trim()}`,
    `Endpoint Hash: ${input.endpointHash}`,
    `Event Mask: ${input.eventMask.toString()}`,
    `Timestamp: ${input.timestamp.toString()}`,
  ].join('\n')
}

export function isWebhookTargetAuthorizationFresh(timestamp: string | number | bigint, now = Date.now()) {
  const value = Number(timestamp)
  return Number.isFinite(value) && Math.abs(now - value) <= WEBHOOK_TARGET_AUTH_TTL_MS
}
