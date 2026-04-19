"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { Shield, Key, Bell, Moon, Globe, Wallet, ExternalLink, Copy, CheckCircle2, Loader2, Lock } from "lucide-react"

export default function SettingsPage() {
  const { address, isConnected } = useAccount()
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium">Settings</h1>
        <p className="text-sm text-black/50 mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Wallet Connection */}
      <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06]">
          <h2 className="font-medium flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Wallet
          </h2>
        </div>
        <div className="p-6">
          {isConnected && address ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium mb-1">Connected Wallet</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-black/50 bg-black/[0.03] px-2 py-1 rounded">
                    {address}
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAddress}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:bg-black/[0.04] transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
                <a
                  href={`https://sepolia.arbiscan.io/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-black/40" />
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-black/50">Wallet not connected</div>
            </div>
          )}
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06]">
          <h2 className="font-medium flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Privacy Settings
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Hide My Files</div>
              <div className="text-xs text-black/50">Prevent others from seeing your file list</div>
            </div>
            <button className="w-12 h-7 rounded-full bg-[#111] relative transition-colors">
              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white shadow transition-transform translate-x-5" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Private Analytics</div>
              <div className="text-xs text-black/50">Track downloads without revealing data</div>
            </div>
            <button className="w-12 h-7 rounded-full bg-[#111] relative transition-colors">
              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white shadow transition-transform translate-x-5" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Anonymous Uploads</div>
              <div className="text-xs text-black/50">Upload files without linking to your wallet</div>
            </div>
            <button className="w-12 h-7 rounded-full bg-black/[0.1] relative transition-colors">
              <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Default Access Rules */}
      <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06]">
          <h2 className="font-medium flex items-center gap-2">
            <Key className="w-4 h-4" />
            Default Access Rules
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Default Price (USDC)</label>
            <input
              type="number"
              defaultValue="0"
              className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.2]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Default Max Downloads</label>
            <input
              type="number"
              defaultValue="100"
              className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.2]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Default Expiry (Days)</label>
            <input
              type="number"
              defaultValue="365"
              className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.2]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <Lock className="w-3 h-3" />
              All rules are encrypted
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06]">
          <h2 className="font-medium flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Download Alerts</div>
              <div className="text-xs text-black/50">Get notified when someone downloads your file</div>
            </div>
            <button className="w-12 h-7 rounded-full bg-[#111] relative transition-colors">
              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white shadow transition-transform translate-x-5" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">New Purchase Alerts</div>
              <div className="text-xs text-black/50">Get notified of new payments</div>
            </div>
            <button className="w-12 h-7 rounded-full bg-[#111] relative transition-colors">
              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white shadow transition-transform translate-x-5" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Weekly Summary</div>
              <div className="text-xs text-black/50">Receive weekly activity reports</div>
            </div>
            <button className="w-12 h-7 rounded-full bg-black/[0.1] relative transition-colors">
              <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06]">
          <h2 className="font-medium flex items-center gap-2">
            <Moon className="w-4 h-4" />
            Appearance
          </h2>
        </div>
        <div className="p-6">
          <div className="flex gap-3">
            <button className="flex-1 p-4 rounded-xl border-2 border-[#111] bg-white">
              <div className="w-8 h-8 rounded-lg bg-[#F5F4F0] mb-2" />
              <div className="text-sm font-medium">Light</div>
            </button>
            <button className="flex-1 p-4 rounded-xl border border-black/[0.1] hover:border-black/[0.2] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] mb-2" />
              <div className="text-sm">Dark</div>
            </button>
            <button className="flex-1 p-4 rounded-xl border border-black/[0.1] hover:border-black/[0.2] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F5F4F0] to-[#1a1a1a] mb-2" />
              <div className="text-sm">System</div>
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-[#111] text-white text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Saved!
          </>
        ) : (
          "Save Settings"
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
              <div className="text-xs text-black/50">Permanently delete your account and all data</div>
            </div>
            <button className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
