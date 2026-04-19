"use client"

import { useState, useEffect, Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { Shield, Lock, Key, Eye, EyeOff, Download, DollarSign, CheckCircle2, AlertCircle, Loader2, FileText, User, Wallet } from "lucide-react"

// Mock file data
const mockFileData = {
  id: "abc123",
  name: "Q4 Financial Report 2024.pdf",
  size: "2.4 MB",
  type: "pdf",
  owner: "0x742d35Cc6634C0532925a3b844Bc9e7595f8bCd1",
  ipfsHash: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  price: "5 USDC",
  hasPassword: true,
  downloadCount: 12,
  viewCount: 34,
  createdAt: "2 days ago",
  isExpired: false,
}

function ShareContent() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black/30" />
      </div>
    )
  }

  const handleVerify = async () => {
    setVerifying(true)
    setError(null)

    // Simulate FHE verification
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate password check
    if (password === "demo123") {
      setVerified(true)
    } else if (password === "") {
      setVerified(true) // No password required
    } else {
      setError("Invalid password. Please try again.")
    }

    setVerifying(false)
  }

  const handleDownload = async () => {
    setDownloading(true)

    // Simulate download from IPFS
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setDownloading(false)
    setDownloaded(true)
  }

  const isOwner = address?.toLowerCase() === mockFileData.owner.toLowerCase()

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.08]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#111]" />
            <span className="font-medium text-sm">FhenixDropBox</span>
          </div>
          {isOwner && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs">
              <CheckCircle2 className="w-3 h-3" />
              You are the owner
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          {/* File Card */}
          <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden mb-6">
            {/* File Preview Area */}
            <div className="p-8 bg-gradient-to-br from-[#f5f4f0] to-[#e8e6e0] flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-white border border-black/[0.1] flex items-center justify-center mb-4 shadow-sm">
                <FileText className="w-10 h-10 text-black/40" />
              </div>
              <h1 className="text-xl font-medium text-center mb-2">{mockFileData.name}</h1>
              <div className="flex items-center gap-4 text-sm text-black/50">
                <span>{mockFileData.size}</span>
                <span>•</span>
                <span>{mockFileData.type.toUpperCase()}</span>
              </div>
            </div>

            {/* Privacy Status */}
            <div className="px-6 py-4 border-t border-b border-black/[0.06] bg-black/[0.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">Privacy Protected</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-black/40">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {mockFileData.viewCount} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {mockFileData.downloadCount} downloads
                  </span>
                </div>
              </div>
            </div>

            {/* Access Form */}
            {!verified ? (
              <div className="p-6 space-y-6">
                {/* Price Info */}
                <div className="flex items-center justify-between p-4 bg-black/[0.02] rounded-xl">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-black/40" />
                    <span className="text-sm">Access Price</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{mockFileData.price}</span>
                    <Lock className="w-3 h-3 text-black/20" />
                  </div>
                </div>

                {/* Password Input */}
                {mockFileData.hasPassword && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-3">
                      <Key className="w-4 h-4 text-black/40" />
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password to access"
                        className="w-full px-4 py-3 rounded-xl border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.2]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {/* Privacy Notice */}
                <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl">
                  <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-emerald-700">
                    <div className="font-medium mb-1">Your privacy is protected</div>
                    <div className="text-emerald-600/80">
                      All access conditions are encrypted on Fhenix. The file owner cannot see your password or payment details.
                    </div>
                  </div>
                </div>

                {/* Verify Button */}
                <button
                  onClick={handleVerify}
                  disabled={verifying || (mockFileData.hasPassword && !password)}
                  className="w-full py-4 rounded-xl bg-[#111] text-white font-medium hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying Access...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {mockFileData.hasPassword ? "Verify & Unlock" : "Access File"}
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Download Section */
              <div className="p-6 space-y-6">
                {/* Success */}
                <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium text-emerald-700">Access Verified</div>
                    <div className="text-xs text-emerald-600">Your access has been confirmed privately</div>
                  </div>
                </div>

                {/* File Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-black/50">IPFS Hash</span>
                    <code className="text-xs text-black/60">{mockFileData.ipfsHash}</code>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-black/50">File Size</span>
                    <span className="text-sm">{mockFileData.size}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-black/50">Uploaded</span>
                    <span className="text-sm">{mockFileData.createdAt}</span>
                  </div>
                </div>

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  disabled={downloading || downloaded}
                  className={`w-full py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                    downloaded
                      ? "bg-emerald-500 text-white"
                      : "bg-[#111] text-white hover:bg-[#333]"
                  } disabled:opacity-80`}
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Downloading from IPFS...
                    </>
                  ) : downloaded ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Downloaded Successfully
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download File
                    </>
                  )}
                </button>

                {downloaded && (
                  <p className="text-center text-xs text-black/40">
                    File decrypted and downloaded to your device
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Owner Actions */}
          {isOwner && (
            <div className="bg-white rounded-2xl border border-black/[0.07] p-6">
              <h3 className="font-medium mb-4">Owner Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-4 rounded-xl border border-black/[0.07] hover:bg-black/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-black/40" />
                    <span className="text-sm">View Access Logs</span>
                  </div>
                  <span className="text-xs text-black/40">Private</span>
                </button>
                <button className="w-full flex items-center justify-between p-4 rounded-xl border border-black/[0.07] hover:bg-black/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-black/40" />
                    <span className="text-sm">Withdraw Earnings</span>
                  </div>
                  <span className="text-sm font-medium">{mockFileData.downloadCount * 5} USDC</span>
                </button>
                <button className="w-full flex items-center justify-between p-4 rounded-xl border border-black/[0.07] hover:bg-black/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-black/40" />
                    <span className="text-sm">Update Access Rules</span>
                  </div>
                  <span className="text-xs text-black/40">Encrypted</span>
                </button>
              </div>
            </div>
          )}

          {/* Connect Wallet Prompt */}
          {!isConnected && !verified && (
            <div className="mt-6 p-6 bg-white rounded-2xl border border-black/[0.07] text-center">
              <Wallet className="w-8 h-8 text-black/30 mx-auto mb-3" />
              <div className="text-sm font-medium mb-2">Connect Your Wallet</div>
              <div className="text-xs text-black/50 mb-4">
                Connect your wallet to verify access and download the file.
              </div>
            </div>
          )}

          {/* Privacy Footer */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.03] text-xs text-black/40">
              <Lock className="w-3 h-3" />
              Powered by Fhenix FHE Encryption
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-black/30 mx-auto mb-4" />
          <div className="text-sm text-black/50">Loading...</div>
        </div>
      </div>
    }>
      <ShareContent />
    </Suspense>
  )
}
