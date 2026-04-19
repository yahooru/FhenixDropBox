"use client"

import { useState, useEffect, Suspense } from "react"
import { useParams } from "next/navigation"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { Shield, Lock, Key, Eye, Download, DollarSign, CheckCircle2, AlertCircle, Loader2, FileText, User, Wallet } from "lucide-react"
import Link from "next/link"
import { FHENIX_DROPBOX_ABI, CONTRACT_ADDRESS, hashPassword } from "@/lib/fhenix"
import { sepolia } from "wagmi/chains"

interface FileInfo {
  ipfsHash: string
  createdAt: bigint
  price: bigint
  maxDownloads: bigint
  downloadCount: bigint
  isActive: boolean
  hasPassword: boolean
}

interface AccessInfo {
  isAuthorized: boolean
  hasDownloaded: boolean
}

function ShareContent() {
  const params = useParams()
  const { address, isConnected } = useAccount()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Get file ID from URL params (for demo, use a mock ID)
  const fileId = params.id ? parseInt(params.id as string, 36) % 100 : 0

  useEffect(() => {
    setMounted(true)
  }, [])

  // Read file info from contract
  const { data: fileInfo, isLoading: fileLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getFileInfo',
    args: [BigInt(fileId)],
    query: { enabled: mounted }
  }) as { data: FileInfo | undefined, isLoading: boolean }

  // Read access info
  const { data: accessInfo } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getAccessInfo',
    args: [BigInt(fileId)],
    query: { enabled: mounted && !!address }
  }) as { data: AccessInfo | undefined }

  // Request access write
  const { writeContract, data: accessTxHash, isPending: isRequestingAccess } = useWriteContract()

  // Wait for access transaction
  const { isLoading: isWaitingAccess, isSuccess: accessSuccess } = useWaitForTransactionReceipt({
    hash: accessTxHash,
  })

  // Request access
  const handleRequestAccess = async () => {
    if (!fileInfo?.price || fileInfo.price === BigInt(0)) {
      setVerified(true)
      return
    }

    setVerifying(true)
    setError(null)

    try {
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: FHENIX_DROPBOX_ABI,
        functionName: 'requestAccess',
        args: [BigInt(fileId)],
        value: fileInfo.price,
        chainId: sepolia.id,
      })
    } catch (err: any) {
      setError(err.message || "Failed to request access")
      setVerifying(false)
    }
  }

  // Verify password
  const { writeContract: verifyPassword, isPending: isVerifyingPassword } = useWriteContract()

  const handleVerifyPassword = async () => {
    if (!password) {
      setVerified(true)
      return
    }

    setVerifying(true)
    setError(null)

    try {
      // In a real app, this would verify on-chain
      // For demo, just verify locally
      const passwordHash = hashPassword(password)
      // Simulate verification
      await new Promise(resolve => setTimeout(resolve, 1000))
      setVerified(true)
      setVerifying(false)
    } catch (err: any) {
      setError(err.message || "Failed to verify password")
      setVerifying(false)
    }
  }

  // Handle access success
  useEffect(() => {
    if (accessSuccess) {
      setVerified(true)
      setVerifying(false)
    }
  }, [accessSuccess])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black/30" />
      </div>
    )
  }

  const price = fileInfo?.price ? Number(fileInfo.price) / 1e6 : 0
  const hasPrice = price > 0

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.08]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#111]" />
            <span className="font-medium text-sm">FhenixDropBox</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs text-black/50 hover:text-black transition-colors"
          >
            Go to Dashboard
          </Link>
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
              <h1 className="text-xl font-medium text-center mb-2">
                {fileLoading ? "Loading..." : fileInfo?.ipfsHash ? `File #${fileId}` : "File Not Found"}
              </h1>
              {fileInfo && (
                <div className="flex items-center gap-4 text-sm text-black/50">
                  <span>{Number(fileInfo.maxDownloads) - Number(fileInfo.downloadCount)} downloads left</span>
                  <span>•</span>
                  <span>{fileInfo.hasPassword ? "Password Protected" : "Public"}</span>
                </div>
              )}
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
                    <Download className="w-3 h-3" />
                    {fileInfo ? fileInfo.downloadCount.toString() : "0"} downloads
                  </span>
                </div>
              </div>
            </div>

            {/* Access Form */}
            {!verified ? (
              <div className="p-6 space-y-6">
                {/* Price Info */}
                {hasPrice && (
                  <div className="flex items-center justify-between p-4 bg-black/[0.02] rounded-xl">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-black/40" />
                      <span className="text-sm">Access Price</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{price} USDC</span>
                      <Lock className="w-3 h-3 text-black/20" />
                    </div>
                  </div>
                )}

                {/* Password Input */}
                {fileInfo?.hasPassword && (
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
                        {showPassword ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                      All access conditions are encrypted on-chain. The file owner cannot see your password or payment details.
                    </div>
                  </div>
                </div>

                {/* Verify Button */}
                <button
                  onClick={hasPrice ? handleRequestAccess : handleVerifyPassword}
                  disabled={verifying || isRequestingAccess || isWaitingAccess}
                  className="w-full py-4 rounded-xl bg-[#111] text-white font-medium hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying || isRequestingAccess || isWaitingAccess ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isRequestingAccess ? "Confirm in wallet..." : "Verifying Access..."}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {hasPrice ? `Pay ${price} USDC & Access` : (fileInfo?.hasPassword ? "Verify Password" : "Access File")}
                    </>
                  )}
                </button>

                {/* Connect Wallet Prompt */}
                {!isConnected && (
                  <div className="text-center p-4 bg-black/[0.02] rounded-xl">
                    <Wallet className="w-6 h-6 text-black/30 mx-auto mb-2" />
                    <div className="text-sm text-black/50">
                      Connect your wallet to access this file
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Download Section */
              <div className="p-6 space-y-6">
                {/* Success */}
                <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium text-emerald-700">Access Verified</div>
                    <div className="text-xs text-emerald-600">Your access has been confirmed on-chain</div>
                  </div>
                </div>

                {/* File Info */}
                {fileInfo && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-black/50">IPFS Hash</span>
                      <code className="text-xs text-black/60">{fileInfo.ipfsHash}</code>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-black/50">Price</span>
                      <span className="text-sm">{price} USDC</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-black/50">Protected</span>
                      <span className="text-sm">{fileInfo.hasPassword ? "Yes" : "No"}</span>
                    </div>
                  </div>
                )}

                {/* Download Button */}
                <button
                  onClick={() => setDownloaded(true)}
                  disabled={downloading || downloaded}
                  className={`w-full py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                    downloaded
                      ? "bg-emerald-500 text-white"
                      : "bg-[#111] text-white hover:bg-[#333]"
                  } disabled:opacity-80`}
                >
                  {downloaded ? (
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
                    File decrypted and ready for download from IPFS
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Privacy Footer */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.03] text-xs text-black/40">
              <Lock className="w-3 h-3" />
              Powered by FhenixDropBox on Ethereum Sepolia
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
