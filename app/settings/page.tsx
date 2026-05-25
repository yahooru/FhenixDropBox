"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAccount, useReadContract, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWalletClient, useWriteContract } from "wagmi"
import { sepolia } from "wagmi/chains"
import { getAddress, parseEventLogs, type Hex } from "viem"
import { useTheme } from "next-themes"
import {
  Shield,
  Key,
  Bell,
  Moon,
  Wallet,
  ExternalLink,
  Copy,
  CheckCircle2,
  Loader2,
  Lock,
  Save,
  ArrowLeft,
  Zap,
  Eye,
  EyeOff,
  BarChart3,
  Activity,
  UserRoundX,
} from "lucide-react"
import {
  CONTRACT_ADDRESS,
  FHENIX_DROPBOX_ABI,
  formatNativePrice,
  hashWebhookEndpoint,
  tupleToWebhookInfo,
  type WebhookInfo,
} from "@/lib/fhenix"
import { DEFAULT_PREFERENCES, getPreferences, savePreferences, type AppPreferences } from "@/lib/preferences"
import {
  WEBHOOK_ALL_EVENT_MASK,
  buildWebhookTargetRegistrationMessage,
  hashWebhookTargetEndpoint,
} from "@/lib/webhooks"
import { signWalletMessage } from "@/lib/wallet-signing"

interface SettingRowProps {
  title: string
  description: string
  enabled: boolean
  onToggle: () => void
  isLast?: boolean
}

function SettingRow({ title, description, enabled, onToggle, isLast }: SettingRowProps) {
  return (
    <>
      <div
        className="flex items-center justify-between py-4 px-1"
      >
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{title}</span>
          </div>
          <div className="text-xs text-black/50">{description}</div>
        </div>
        <button
          onClick={onToggle}
          className={`w-12 h-7 rounded-full relative transition-all duration-200 flex-shrink-0 ${
            enabled ? "bg-[#111]" : "bg-black/[0.1]"
          }`}
        >
          <span
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
              enabled ? "left-[calc(100%-24px)]" : "left-1"
            }`}
          />
        </button>
      </div>
      {!isLast && <div className="h-px bg-black/[0.05]" />}
    </>
  )
}

interface ThemeOptionProps {
  theme: "light" | "dark" | "system"
  label: string
  gradient?: string
  active: boolean
  onClick: () => void
}

function ThemeOption({ theme, label, gradient, active, onClick }: ThemeOptionProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex-1 p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-3 ${
        active
          ? "border-[#111] bg-white shadow-sm"
          : hovered
          ? "border-black/20 bg-black/[0.02]"
          : "border-black/[0.08] bg-black/[0.01]"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          theme === "light"
            ? "bg-[#F5F4F0]"
            : theme === "dark"
            ? "bg-[#1a1a1a]"
            : gradient
        }`}
      >
        {theme === "light" ? (
          <Eye className="w-5 h-5 text-black/60" />
        ) : theme === "dark" ? (
          <EyeOff className="w-5 h-5 text-white/60" />
        ) : (
          <Moon className="w-5 h-5 text-white/60" />
        )}
      </div>
      <span className={`text-sm font-medium ${active ? "text-[#111]" : "text-black/70"}`}>
        {label}
      </span>
      {active && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#111] flex items-center justify-center">
          <CheckCircle2 className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { address, isConnected, chainId: walletChainId, connector } = useAccount()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const { theme, setTheme } = useTheme()
  const [copied, setCopied] = useState(false)
  const [copiedContract, setCopiedContract] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState("privacy")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [webhookLabel, setWebhookLabel] = useState("")
  const [webhookNotice, setWebhookNotice] = useState<string | null>(null)
  const [pendingWebhookTarget, setPendingWebhookTarget] = useState<{
    endpoint: string
    label: string
    eventMask: number
  } | null>(null)
  const [handledWebhookTargetTx, setHandledWebhookTargetTx] = useState<string | null>(null)
  const { writeContract, data: webhookTxHash, isPending: webhookPending, error: webhookWriteError } = useWriteContract()
  const { data: webhookReceipt, isLoading: webhookWaiting, isSuccess: webhookSuccess } = useWaitForTransactionReceipt({ hash: webhookTxHash })
  const wrongNetwork = isConnected && walletChainId !== sepolia.id

  const { data: webhookIds, refetch: refetchWebhookIds } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getMyWebhooks",
    query: { enabled: isConnected },
  })

  const webhookIdList = useMemo(() => (
    Array.isArray(webhookIds) ? webhookIds.map((id) => id.toString()) : []
  ), [webhookIds])

  const webhookContracts = useMemo(() => webhookIdList.map((id) => ({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "webhooks",
    args: [BigInt(id)],
  })), [webhookIdList])

  const { data: webhookReads, refetch: refetchWebhookReads } = useReadContracts({
    contracts: webhookContracts,
    query: { enabled: isConnected && webhookContracts.length > 0 },
  })

  const webhooks = useMemo(() => (
    (webhookReads || [])
      .map((result) => tupleToWebhookInfo(result.result))
      .filter(Boolean) as WebhookInfo[]
  ), [webhookReads])

  const [settings, setSettings] = useState<AppPreferences>(DEFAULT_PREFERENCES)

  const { data: stats } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getStats",
    query: { enabled: isConnected },
  })

  const statTuple = Array.isArray(stats) ? stats : [0n, 0n, 0n, 0n]
  const totalFiles = Number(statTuple[0] || 0n)
  const totalDownloads = Number(statTuple[1] || 0n)
  const totalVolume = BigInt(statTuple[2] || 0n)
  const myFileCount = Number(statTuple[3] || 0n)

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyContract = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS)
    setCopiedContract(true)
    setTimeout(() => setCopiedContract(false), 2000)
  }

  const handleSave = async () => {
    setSaving(true)
    savePreferences(address, settings)
    await new Promise((resolve) => setTimeout(resolve, 250))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateSetting = (key: keyof AppPreferences, value: boolean | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (!address) return
    setSettings(getPreferences(address))
  }, [address])

  useEffect(() => {
    if (!webhookWriteError) return
    setWebhookNotice(webhookWriteError.message.includes("does not match the target chain")
      ? `Switch your wallet to ${sepolia.name} before registering webhooks.`
      : webhookWriteError.message || "Webhook transaction was not submitted.")
    setPendingWebhookTarget(null)
  }, [webhookWriteError])

  const ensureSepolia = async () => {
    if (!wrongNetwork) return true
    setWebhookNotice(`Switching wallet to ${sepolia.name}...`)
    try {
      await switchChainAsync({ chainId: sepolia.id })
      setWebhookNotice(`Wallet switched to ${sepolia.name}. Click register again to submit on-chain.`)
    } catch (error) {
      setWebhookNotice(error instanceof Error ? error.message : `Please switch your wallet to ${sepolia.name}.`)
    }
    return false
  }

  useEffect(() => {
    if (!webhookSuccess || !webhookReceipt || !pendingWebhookTarget || !webhookTxHash || !address) return
    if (handledWebhookTargetTx === webhookTxHash) return

    setHandledWebhookTargetTx(webhookTxHash)

    const registerTarget = async () => {
      try {
        const endpointHash = hashWebhookTargetEndpoint(pendingWebhookTarget.endpoint)
        const registeredLogs = parseEventLogs({
          abi: FHENIX_DROPBOX_ABI,
          logs: webhookReceipt.logs,
          eventName: "WebhookRegistered",
        })
        const registeredLog = registeredLogs.find((log) => {
          const args = log.args as Record<string, unknown>
          return (
            String(args.owner || "").toLowerCase() === address.toLowerCase() &&
            String(args.endpointHash || "").toLowerCase() === endpointHash.toLowerCase()
          )
        })
        const webhookId = (registeredLog?.args as Record<string, unknown> | undefined)?.webhookId

        if (webhookId == null) {
          throw new Error("WebhookRegistered event was not found in the transaction receipt")
        }
        const webhookIdString = webhookId.toString()

        const timestamp = Date.now().toString()
        const normalizedOwner = getAddress(address)
        const message = buildWebhookTargetRegistrationMessage({
          contractAddress: CONTRACT_ADDRESS,
          chainId: sepolia.id,
          owner: normalizedOwner,
          webhookId: webhookIdString,
          endpoint: pendingWebhookTarget.endpoint,
          endpointHash,
          eventMask: pendingWebhookTarget.eventMask,
          timestamp,
        })
        const signature = await signWalletMessage({
          account: normalizedOwner as Hex,
          message,
          walletClient,
          connector,
        })
        const response = await fetch("/api/webhooks/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: normalizedOwner,
            webhookId: webhookIdString,
            endpoint: pendingWebhookTarget.endpoint,
            label: pendingWebhookTarget.label,
            eventMask: pendingWebhookTarget.eventMask,
            timestamp,
            signature,
          }),
        })
        const result = await response.json().catch(() => ({})) as { error?: string }

        if (!response.ok) {
          throw new Error(result.error || "Webhook target could not be saved for delivery")
        }

        setWebhookNotice("Webhook registered on-chain and saved for worker delivery.")
        setWebhookUrl("")
        setWebhookLabel("")
        setPendingWebhookTarget(null)
        void refetchWebhookIds()
        void refetchWebhookReads()
        setTimeout(() => setWebhookNotice(null), 2600)
      } catch (error) {
        setWebhookNotice(error instanceof Error ? error.message : "Webhook target registration failed.")
        setPendingWebhookTarget(null)
        void refetchWebhookIds()
        void refetchWebhookReads()
      }
    }

    void registerTarget()
  }, [
    address,
    handledWebhookTargetTx,
    pendingWebhookTarget,
    refetchWebhookIds,
    refetchWebhookReads,
    connector,
    walletClient,
    webhookReceipt,
    webhookSuccess,
    webhookTxHash,
  ])

  const handleRegisterWebhook = async () => {
    const endpoint = webhookUrl.trim()
    if (!endpoint) return
    if (!(await ensureSepolia())) return
    const label = webhookLabel.trim() || "Production webhook"
    const eventMask = WEBHOOK_ALL_EVENT_MASK

    setPendingWebhookTarget({ endpoint, label, eventMask })
    setHandledWebhookTargetTx(null)
    setWebhookNotice(null)

    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "registerWebhook",
      args: [
        hashWebhookEndpoint(endpoint),
        label,
        eventMask,
      ],
      chainId: sepolia.id,
    })
  }

  const tabs = [
    { id: "privacy", label: "Privacy", icon: Shield },
    { id: "defaults", label: "Defaults", icon: Key },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "webhooks", label: "Webhooks", icon: Zap },
    { id: "appearance", label: "Appearance", icon: Moon },
  ]

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-[#111] flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-medium mb-3">Connect Your Wallet</h1>
        <p className="text-sm text-black/50 mb-6">
          Connect your wallet to access settings.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2.5 rounded-xl bg-[#111] text-white text-sm font-medium hover:bg-[#333] transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-black/50 hover:text-black mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium">Settings</h1>
            <p className="text-sm text-black/50 mt-1">
              Manage your account, privacy & preferences
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 rounded-xl bg-[#111] text-white text-sm font-medium hover:bg-[#333] transition-colors flex items-center gap-2"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Wallet Card */}
      <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          <h2 className="font-medium">Connected Wallet</h2>
        </div>
        <div className="p-6 space-y-4">
          {/* Address Row */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-black/40 mb-2 font-medium uppercase tracking-wider">Your Address</div>
              <code className="text-xs text-black/70 bg-black/[0.03] px-2 py-1 rounded font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-black/[0.04] transition-colors border border-black/[0.06]"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors border border-black/[0.06]"
                title="View on Etherscan"
              >
                <ExternalLink className="w-3.5 h-3.5 text-black/40" />
              </a>
            </div>
          </div>

          <div className="h-px bg-black/[0.05]" />

          {/* Contract Row */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-black/40 mb-2 font-medium uppercase tracking-wider">Contract Address</div>
              <code className="text-xs text-black/70 bg-black/[0.03] px-2 py-1 rounded font-mono">
                {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyContract}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-black/[0.04] transition-colors border border-black/[0.06]"
              >
                {copiedContract ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors border border-black/[0.06]"
                title="View Contract on Etherscan"
              >
                <ExternalLink className="w-3.5 h-3.5 text-black/40" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-black/[0.03] p-1.5 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-white text-[#111] font-medium shadow-sm"
                : "text-black/40 hover:text-black/70"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Privacy Tab */}
      {activeTab === "privacy" && (
        <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <h2 className="font-medium">Privacy & Security</h2>
            </div>
            <p className="text-xs text-black/40 mt-1">Control who can see your data</p>
          </div>
          <div className="px-6 py-2">
            <SettingRow
              title="Hide My Files"
              description="Prevent others from discovering your file list"
              enabled={settings.hideFiles}
              onToggle={() => updateSetting("hideFiles", !settings.hideFiles)}
            />
            <SettingRow
              title="Private Analytics"
              description="Show local-only analytics from contract reads without adding external trackers"
              enabled={settings.privateAnalytics}
              onToggle={() => updateSetting("privateAnalytics", !settings.privateAnalytics)}
            />
            <SettingRow
              title="Anonymous Uploads"
              description="New uploads hide the public owner lookup and generate anonymous share links"
              enabled={settings.anonymousUploads}
              onToggle={() => updateSetting("anonymousUploads", !settings.anonymousUploads)}
              isLast  
            />
          </div>
          {settings.privateAnalytics && (
            <div className="mx-6 mb-5 grid gap-3 rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 sm:grid-cols-4">
              <div className="rounded-xl bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-black/40">
                  <BarChart3 className="h-3.5 w-3.5" />
                  My Files
                </div>
                <div className="text-2xl font-semibold">{myFileCount}</div>
              </div>
              <div className="rounded-xl bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-black/40">
                  <Activity className="h-3.5 w-3.5" />
                  Downloads
                </div>
                <div className="text-2xl font-semibold">{totalDownloads}</div>
              </div>
              <div className="rounded-xl bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-black/40">
                  <Shield className="h-3.5 w-3.5" />
                  Volume
                </div>
                <div className="text-2xl font-semibold">{formatNativePrice(totalVolume)} ETH</div>
              </div>
              <div className="rounded-xl bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-black/40">
                  <Lock className="h-3.5 w-3.5" />
                  Platform Files
                </div>
                <div className="text-2xl font-semibold">{totalFiles}</div>
              </div>
              <div className="sm:col-span-4 flex items-start gap-2 rounded-xl bg-white px-4 py-3 text-xs text-black/45">
                <UserRoundX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/35" />
                Analytics are rendered in this browser from Sepolia reads. Anonymous mode hides owner lookup results from the app contract API, while the originating network transaction remains visible on public explorers.
              </div>
            </div>
          )}
          <div className="px-6 py-3 bg-emerald-50/60 border-t border-emerald-100/50 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs text-emerald-700">Wave 3 privacy controls are active. Save settings to apply defaults to new uploads.</span>
          </div>
        </div>
      )}

      {/* Defaults Tab */}
      {activeTab === "defaults" && (
        <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              <h2 className="font-medium">Default Access Rules</h2>
            </div>
            <p className="text-xs text-black/40 mt-1">Applied automatically to new uploads</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Default Price</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.defaultPrice}
                  onChange={(e) => updateSetting("defaultPrice", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.25] transition-colors pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-black/40 font-medium">
                  ETH
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Default Max Downloads</label>
              <input
                type="number"
                min="1"
                value={settings.defaultDownloads}
                onChange={(e) => updateSetting("defaultDownloads", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.25] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Default Expiry (Days)</label>
              <div className="flex gap-2">
                {["1", "7", "30", "0"].map((days) => (
                  <button
                    key={days}
                    onClick={() => updateSetting("defaultExpiry", days)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      settings.defaultExpiry === days
                        ? "bg-[#111] text-white border-[#111]"
                        : "bg-black/[0.02] text-black/60 border-black/[0.08] hover:border-black/[0.15]"
                    }`}
                  >
                    {days === "1" ? "24h" : days === "7" ? "7d" : days === "30" ? "30d" : "Never"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-black/40 mt-2">
                Links expire after{" "}
                <span className="font-medium text-black/60">
                  {settings.defaultExpiry === "0" ? "no fixed period" : `${settings.defaultExpiry} day(s)`}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50/60 rounded-xl px-4 py-3 border border-emerald-100/50">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Defaults apply to on-chain access rules for price, access code hash, expiry, and limits</span>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <h2 className="font-medium">Notifications</h2>
            </div>
            <p className="text-xs text-black/40 mt-1">Stay updated on your file activity</p>
          </div>
          <div className="px-6 py-2">
            <SettingRow
              title="Download Alerts"
              description="Keep browser preferences ready for webhook-backed download alerts"
              enabled={settings.downloadAlerts}
              onToggle={() => updateSetting("downloadAlerts", !settings.downloadAlerts)}
            />
            <SettingRow
              title="New Purchase Alerts"
              description="Track paid access events through your registered webhook endpoint"
              enabled={settings.purchaseAlerts}
              onToggle={() => updateSetting("purchaseAlerts", !settings.purchaseAlerts)}
            />
            <SettingRow
              title="Weekly Summary"
              description="Save a local summary preference for analytics exports"
              enabled={settings.weeklySummary}
              onToggle={() => updateSetting("weeklySummary", !settings.weeklySummary)}
              isLast
            />
          </div>
          <div className="px-6 py-3 bg-emerald-50/60 border-t border-emerald-100/50 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs text-emerald-700">
              Notification preferences are saved locally. Register a webhook for production event delivery.
            </span>
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === "webhooks" && (
        <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <h2 className="font-medium">Developer Webhooks</h2>
            </div>
            <p className="text-xs text-black/40 mt-1">
              Register hashed endpoints on-chain for upload, access, and download event consumers.
            </p>
          </div>
          <div className="p-6 space-y-5">
            {webhookNotice && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {webhookNotice}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={webhookLabel}
                onChange={(event) => setWebhookLabel(event.target.value)}
                placeholder="Webhook label"
                className="rounded-xl border border-black/[0.1] bg-black/[0.02] px-4 py-3 text-sm"
              />
              <input
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder="https://example.com/fhenixdropbox"
                className="rounded-xl border border-black/[0.1] bg-black/[0.02] px-4 py-3 text-sm"
              />
              <button
                onClick={handleRegisterWebhook}
                disabled={!webhookUrl.trim() || webhookPending || webhookWaiting || isSwitchingChain || !!pendingWebhookTarget}
                className="rounded-xl bg-[#111] px-5 py-3 text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {webhookPending || webhookWaiting || isSwitchingChain || pendingWebhookTarget ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Register
              </button>
            </div>

            <div className="rounded-xl bg-black/[0.02] border border-black/[0.05] p-4 text-xs text-black/45">
              Raw endpoint URLs are not stored on-chain. The contract stores a `bytes32` hash plus an event mask so external indexers can match and deliver events.
            </div>

            <div className="space-y-2">
              {webhooks.length === 0 ? (
                <div className="rounded-xl border border-black/[0.06] p-5 text-center text-sm text-black/40">
                  No webhooks registered yet.
                </div>
              ) : (
                webhooks.map((hook) => (
                  <div key={hook.id.toString()} className="rounded-xl border border-black/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{hook.label || `Webhook #${hook.id.toString()}`}</div>
                        <div className="text-xs text-black/40 font-mono mt-1">
                          {hook.endpointHash.slice(0, 12)}...{hook.endpointHash.slice(-8)}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${hook.isActive ? "bg-emerald-50 text-emerald-700" : "bg-black/[0.05] text-black/40"}`}>
                        {hook.isActive ? "Active" : "Paused"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === "appearance" && (
        <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4" />
              <h2 className="font-medium">Appearance</h2>
            </div>
            <p className="text-xs text-black/40 mt-1">Customize how FhenixDropBox looks</p>
          </div>
          <div className="p-6">
            <div className="text-sm font-medium mb-3">Theme</div>
            <div className="flex gap-3">
              <ThemeOption
                theme="light"
                label="Light"
                active={theme === "light"}
                onClick={() => setTheme("light")}
              />
              <ThemeOption
                theme="dark"
                label="Dark"
                active={theme === "dark"}
                onClick={() => setTheme("dark")}
              />
              <ThemeOption
                theme="system"
                label="System"
                gradient="bg-gradient-to-br from-[#F5F4F0] to-[#1a1a1a]"
                active={theme === "system"}
                onClick={() => setTheme("system")}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-black/40 mt-4 bg-black/[0.02] rounded-xl px-4 py-3 border border-black/[0.05]">
              <Zap className="w-3.5 h-3.5 text-black/30" />
              <span>Theme preference is saved automatically and persists across sessions</span>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-[#111] text-white text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Settings saved successfully!
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Settings
          </>
        )}
      </button>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50/50">
          <h2 className="font-medium text-red-700">Danger Zone</h2>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Delete Account</div>
            <div className="text-xs text-black/50 mt-0.5">Permanently delete your account and all associated data</div>
          </div>
          <button className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2">
            <Lock className="w-3 h-3" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-black/30 pb-4">
        FhenixDropBox Settings &middot; Encrypted IPFS delivery and Sepolia access control
      </div>
    </div>
  )
}
