import { lookup } from 'dns/promises'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { isIP } from 'net'
import path from 'path'
import { eventTypesFromMask, hashWebhookTargetEndpoint, WEBHOOK_EVENT_TYPES, type WebhookEventType } from './webhooks'

export interface DeliveryTarget {
  id: string
  endpoint: string
  eventType?: WebhookEventType
  owner?: string
  label?: string
  updatedAt?: string
}

export interface ValidatedWebhookEndpoint {
  deliveryUrl: string
  registeredEndpoint: string
  resolvedAddress: string
  resolvedFamily: number
}

export class WebhookTargetError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

export function endpointHash(endpoint: string) {
  return hashWebhookTargetEndpoint(endpoint)
}

const BLOCKED_IPV4_CIDRS: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]

function ipv4ToInt(address: string) {
  const parts = address.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0
}

function isIpv4InCidr(address: string, base: string, bits: number) {
  const ip = ipv4ToInt(address)
  const baseIp = ipv4ToInt(base)
  if (ip === null || baseIp === null) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ip & mask) === (baseIp & mask)
}

function firstIpv6Hextets(address: string) {
  const [first = '0', second = '0'] = address.split(':')
  return [Number.parseInt(first || '0', 16), Number.parseInt(second || '0', 16)]
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')

  if (isIP(normalized) === 4) {
    return BLOCKED_IPV4_CIDRS.some(([base, bits]) => isIpv4InCidr(normalized, base, bits))
  }

  if (isIP(normalized) !== 6) return false

  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return true

  const [first, second] = firstIpv6Hextets(normalized)
  return (
    first === 0 ||
    normalized.startsWith('64:ff9b:') ||
    first === 0x100 ||
    first === 0x2002 ||
    (first >= 0x3ff0 && first <= 0x3fff) ||
    (first >= 0xfc00 && first <= 0xfdff) ||
    (first >= 0xfe80 && first <= 0xfebf) ||
    (first >= 0xff00 && first <= 0xffff) ||
    (first === 0x2001 && second <= 0x01ff) ||
    (first === 0x2001 && second >= 0x0db8 && second <= 0x0db8)
  )
}

export async function validateWebhookEndpoint(endpoint: string): Promise<ValidatedWebhookEndpoint> {
  const registeredEndpoint = endpoint.trim()
  let url: URL
  try {
    url = new URL(registeredEndpoint)
  } catch {
    throw new WebhookTargetError('Invalid webhook endpoint')
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new WebhookTargetError('Webhook endpoint must be a public HTTPS URL')
  }

  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateAddress(hostname)) {
    throw new WebhookTargetError('Webhook endpoint cannot target a private host')
  }

  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new WebhookTargetError('Webhook endpoint host cannot be resolved')
  }
  if (addresses.some((record) => isPrivateAddress(record.address.toLowerCase()))) {
    throw new WebhookTargetError('Webhook endpoint cannot resolve to a private network')
  }
  const resolved = addresses[0]

  return {
    deliveryUrl: url.toString(),
    registeredEndpoint,
    resolvedAddress: resolved.address,
    resolvedFamily: resolved.family,
  }
}

function webhookTargetsFilePath() {
  return path.resolve(process.env.WEBHOOK_TARGETS_FILE || '.webhook-targets.json')
}

function normalizeTarget(value: unknown): DeliveryTarget | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = String(record.id || '')
  const endpoint = String(record.endpoint || '')
  const eventType = record.eventType ? String(record.eventType) : undefined

  if (!id || !endpoint) return null
  if (eventType && !WEBHOOK_EVENT_TYPES.includes(eventType as WebhookEventType)) return null

  return {
    id,
    endpoint,
    eventType: eventType as WebhookEventType | undefined,
    owner: record.owner ? String(record.owner) : undefined,
    label: record.label ? String(record.label) : undefined,
    updatedAt: record.updatedAt ? String(record.updatedAt) : undefined,
  }
}

export async function readWebhookTargetRegistry(): Promise<DeliveryTarget[]> {
  try {
    const raw = await readFile(webhookTargetsFilePath(), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(normalizeTarget).filter((target): target is DeliveryTarget => !!target) : []
  } catch {
    return []
  }
}

async function writeWebhookTargetRegistry(targets: DeliveryTarget[]) {
  const filePath = webhookTargetsFilePath()
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(targets, null, 2)}\n`, 'utf8')
}

export async function upsertWebhookTargets({
  webhookId,
  endpoint,
  owner,
  label,
  eventMask,
}: {
  webhookId: string | number | bigint
  endpoint: string
  owner: string
  label?: string
  eventMask: number
}) {
  const id = BigInt(webhookId).toString()
  const eventTypes = eventTypesFromMask(eventMask)
  if (eventTypes.length === 0) {
    throw new WebhookTargetError('Webhook event mask does not include any supported events')
  }

  const existing = await readWebhookTargetRegistry()
  const retained = existing.filter((target) => target.id !== id)
  const updatedAt = new Date().toISOString()
  const nextTargets = [
    ...retained,
    ...eventTypes.map((eventType) => ({
      id,
      endpoint,
      eventType,
      owner,
      label,
      updatedAt,
    })),
  ]

  await writeWebhookTargetRegistry(nextTargets)
  return nextTargets.filter((target) => target.id === id)
}
