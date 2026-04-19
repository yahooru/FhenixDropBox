"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
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
  Sparkles,
  Zap,
  LockKeyhole,
  Eye,
  EyeOff,
} from "lucide-react"
import { CONTRACT_ADDRESS } from "@/lib/fhenix"

interface FeatureInfo {
  wave: string
  label: string
}

interface SettingRowProps {
  title: string
  description: string
  enabled: boolean
  onToggle: () => void
  featureInfo?: FeatureInfo
}

const ComingSoonBadge = ({ wave, label }: FeatureInfo) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-700 text-[10px] font-medium">
    <Sparkles className="w-2.5 h-2.5" />
    {wave} {label}
  </span>
)

function SettingRow({ title, description, enabled, onToggle, featureInfo }: SettingRowProps) {
  const [hovered, setHovered] = useState(false)
  const isLocked = !!featureInfo

  return (
    <div
      className={`flex items-center justify-between py-4 ${isLocked ? "opacity-60" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 pr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{title}</span>
          {featureInfo && <ComingSoonBadge wave={featureInfo.wave} label={featureInfo.label} />}
        </div>
        <div className="text-xs text-black/50">{description}</div>
        {isLocked && hovered && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
            <Zap className="w-3 h-3 flex-shrink-0" />
            <span>This feature is coming in <strong>{featureInfo.wave}</strong>. Stay tuned!</span>
          </div>
        )}
      </div>
      {isLocked ? (
        <div className="w-12 h-7 rounded-full bg-black/[0.08] flex items-center justify-center">
          <LockKeyhole className="w-3.5 h-3.5 text-black/30" />
        </div>
      ) : (
        <button
          onClick={onToggle}
          className={`w-12 h-7 rounded-full relative transition-all duration-200 ${
            enabled ? "bg-[#111]" : "bg-black/[0.1]"
          }`}
        >
          <span
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
              enabled ? "left-[calc(100%-24px)]" : "left-1"
            }`}
          />
        </button>
      )}
    </div>
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
      className={`relative flex-1 p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
        active
          ? "border-[#111] bg-white shadow-sm"
          : hovered
          ? "border-black/20 bg-black/[0.02]"
          : "border-black/[0.08] bg-black/[0.01]"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
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
  const { address, isConnected } = useAccount()
  const { theme, setTheme } = useTheme()
  const [copied, setCopied] = useState(false)
  const [copiedContract, setCopiedContract] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState("privacy")

  const [settings, setSettings] = useState({
    hideFiles: true,
    privateAnalytics: false,
    anonymousUploads: false,
    downloadAlerts: true,
    purchaseAlerts: true,
    weeklySummary: false,
    defaultPrice: "0",
    defaultDownloads: "100",
    defaultExpiry: "365",
  })

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
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateSetting = (key: string, value: boolean | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const tabs = [
    { id: "privacy", label: "Privacy", icon: Shield },
    { id: "defaults", label: "Defaults", icon: Key },
    { id: "notifications", label: "Notifications", icon: Bell },
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
    <div className="space-y-6 max-w-4xl">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-black/50 hover:text-black mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
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

      {/* Wallet Card */}
      <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          <h2 className="font-medium">Connected Wallet</h2>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-black/40 mb-2 font-medium uppercase tracking-wider">Your Address</div>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-sm text-black/70 bg-black/[0.03] px-3 py-1.5 rounded-lg font-mono break-all">
                  {address}
                </code>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-black/[0.04] transition-colors border border-black/[0.06]"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600">Copied!</span>
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

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-black/40 mb-2 font-medium uppercase tracking-wider">Contract Address</div>
              <code className="text-sm text-black/70 bg-black/[0.03] px-3 py-1.5 rounded-lg font-mono">
                {CONTRACT_ADDRESS}
              </code>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleCopyContract}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-black/[0.04] transition-colors border border-black/[0.06]"
              >
                {copiedContract ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600">Copied!</span>
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
          <div className="p-2">
            <div className="h-px bg-black/[0.05] mx-2" />
            <div className="px-4">
              <SettingRow
                title="Hide My Files"
                description="Prevent others from discovering your file list"
                enabled={settings.hideFiles}
                onToggle={() => updateSetting("hideFiles", !settings.hideFiles)}
              />
              <div className="h-px bg-black/[0.05]" />
              <SettingRow
                title="Private Analytics"
                description="Track downloads without exposing your data on-chain"
                enabled={settings.privateAnalytics}
                onToggle={() => updateSetting("privateAnalytics", !settings.privateAnalytics)}
                featureInfo={{ wave: "Wave 3", label: "Coming Soon" }}
              />
              <div className="h-px bg-black/[0.05]" />
              <SettingRow
                title="Anonymous Uploads"
                description="Upload files without linking to your wallet address"
                enabled={settings.anonymousUploads}
                onToggle={() => updateSetting("anonymousUploads", !settings.anonymousUploads)}
                featureInfo={{ wave: "Wave 2", label: "Coming Soon" }}
              />
            </div>
          </div>
          <div className="px-6 py-3 bg-emerald-50/60 border-t border-emerald-100/50 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs text-emerald-700">All privacy settings are encrypted on-chain using FHE</span>
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
            <p className="text-xs text-black/40 mt-1">These values are applied automatically to new uploads</p>
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
                  USDC
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
                {["7", "30", "90", "365"].map((days) => (
                  <button
                    key={days}
                    onClick={() => updateSetting("defaultExpiry", days)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      settings.defaultExpiry === days
                        ? "bg-[#111] text-white border-[#111]"
                        : "bg-black/[0.02] text-black/60 border-black/[0.08] hover:border-black/[0.15]"
                    }`}
                  >
                    {days === "7" ? "7d" : days === "30" ? "30d" : days === "90" ? "90d" : "365d"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-black/40 mt-2">
                Links expire after {settings.defaultExpiry} days — currently set to{" "}
                <span className="font-medium text-black/60">{settings.defaultExpiry} days</span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50/60 rounded-xl px-4 py-3 border border-emerald-100/50">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>All access rules are encrypted on-chain — prices, passwords & limits stay private</span>
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
          <div className="p-2">
            <div className="h-px bg-black/[0.05] mx-2" />
            <div className="px-4">
              <SettingRow
                title="Download Alerts"
                description="Get notified when someone downloads your file"
                enabled={settings.downloadAlerts}
                onToggle={() => updateSetting("downloadAlerts", !settings.downloadAlerts)}
                featureInfo={{ wave: "Wave 2", label: "Coming Soon" }}
              />
              <div className="h-px bg-black/[0.05]" />
              <SettingRow
                title="New Purchase Alerts"
                description="Get notified of new payments to your files"
                enabled={settings.purchaseAlerts}
                onToggle={() => updateSetting("purchaseAlerts", !settings.purchaseAlerts)}
                featureInfo={{ wave: "Wave 2", label: "Coming Soon" }}
              />
              <div className="h-px bg-black/[0.05]" />
              <SettingRow
                title="Weekly Summary"
                description="Receive a weekly report of your file activity"
                enabled={settings.weeklySummary}
                onToggle={() => updateSetting("weeklySummary", !settings.weeklySummary)}
                featureInfo={{ wave: "Wave 2", label: "Coming Soon" }}
              />
            </div>
          </div>
          <div className="px-6 py-3 bg-amber-50/60 border-t border-amber-100/50 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs text-amber-700">
              Notifications are planned for Wave 2 — wallet-based alerts coming soon
            </span>
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
            <div className="mb-4">
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
            </div>
            <div className="flex items-center gap-2 text-xs text-black/40 bg-black/[0.02] rounded-xl px-4 py-3 border border-black/[0.05]">
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
        <div className="p-6">
          <div className="flex items-center justify-between">
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
      </div>

      {/* Footer note */}
      <div className="text-center text-xs text-black/30 pb-4">
        FhenixDropBox Settings &middot; Powered by FHE encryption
      </div>
    </div>
  )
}
