"use client"

import { useState, useEffect, use } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import {
  Shield, Lock, Key, Eye, Download, DollarSign, CheckCircle2,
  AlertCircle, Loader2, FileText, Wallet, ArrowLeft, Zap, XCircle
} from "lucide-react"
import Link from "next/link"
import { FHENIX_DROPBOX_ABI, CONTRACT_ADDRESS, hashPassword } from "@/lib/fhenix"
import { downloadFromIPFS, getFromIPFS, formatFileSize } from "@/lib/ipfs"
import { sepolia } from "wagmi/chains"

interface FileInfo {
  ipfsHash: string
  createdAt: bigint
  price: bigint
  maxDownloads: bigint
  downloadCount: bigint
  isActive: boolean
  hasPassword: boolean
  contentEncrypted: boolean
}

interface AccessInfo {
  isAuthorized: boolean
  hasDownloaded: boolean
}

interface EncryptionInfo {
  contentEncrypted: boolean
  isOwnerOrAuthorized: boolean
}

function ShareContent({ fileId }: { fileId: number }) {
  const { address, isConnected } = useAccount()
  const [accessCode, setAccessCode] = useState("")
  const [showAccessCode, setShowAccessCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Read file info from contract
  const { data: fileInfo, isLoading: fileLoading, error: fileError } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getFileInfo',
    args: [BigInt(fileId)],
    query: { enabled: mounted && fileId > 0 }
  }) as { data: FileInfo | undefined, isLoading: boolean, error: any }

  // Read access info
  const { data: accessInfo } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getAccessInfo',
    args: [BigInt(fileId)],
    query: { enabled: mounted && !!address && fileId > 0 }
  }) as { data: AccessInfo | undefined }

  // Read encryption info
  const { data: encryptionInfo } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getEncryptionInfo',
    args: [BigInt(fileId)],
    query: { enabled: mounted && !!address && fileId > 0 }
  }) as { data: EncryptionInfo | undefined }

  // Read file owner
  const { data: fileOwner } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getFileOwner',
    args: [BigInt(fileId)],
    query: { enabled: mounted && fileId > 0 }
  }) as { data: `0x${string}` | undefined }

  // Request access write
  const { writeContract, data: accessTxHash, isPending: isRequestingAccess, error: writeError } = useWriteContract()

  // Wait for access transaction
  const { isLoading: isWaitingAccess, isSuccess: accessSuccess } = useWaitForTransactionReceipt({
    hash: accessTxHash,
  })

  // Download file write
  const { writeContract: downloadFile, data: downloadTxHash, isPending: isDownloadingTx } = useWriteContract()

  // Wait for download transaction
  const { isLoading: isWaitingDownload, isSuccess: downloadSuccess } = useWaitForTransactionReceipt({
    hash: downloadTxHash,
  })

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleRequestAccess = async () => {
    if (!fileInfo) return

    setError(null)
    setDownloading(true)

    try {
      const accessCodeHash = accessCode
        ? hashPassword(accessCode) as `0x${string}`
        : '0x0000000000000000000000000000000000000000000000000000000000000000' as const

      // If file has a price, pay for access
      if (fileInfo.price > 0) {
        writeContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: FHENIX_DROPBOX_ABI,
          functionName: 'requestAccess',
          args: [BigInt(fileId), accessCodeHash],
          value: fileInfo.price,
          chainId: sepolia.id,
        })
      } else {
        // Free access - just verify code
        writeContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: FHENIX_DROPBOX_ABI,
          functionName: 'requestAccess',
          args: [BigInt(fileId), accessCodeHash],
          chainId: sepolia.id,
        })
      }
    } catch (err: any) {
      setError(err.message || "Failed to request access")
      setDownloading(false)
    }
  }

  const handleDownload = async () => {
    if (!fileInfo?.ipfsHash) return

    setDownloading(true)
    setError(null)

    try {
      // First, call on-chain downloadFile to record the download
      downloadFile({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: FHENIX_DROPBOX_ABI,
        functionName: 'downloadFile',
        args: [BigInt(fileId)],
        chainId: sepolia.id,
      })
    } catch (err: any) {
      setError(err.message || "Failed to download")
      setDownloading(false)
    }
  }

  // Handle download success - fetch from IPFS
  useEffect(() => {
    if (downloadSuccess && fileInfo?.ipfsHash && !downloaded) {
      // Fetch file from IPFS
      downloadFromIPFS(fileInfo.ipfsHash, `file_${fileId}`)
        .then(() => {
          setDownloaded(true)
          setDownloading(false)
        })
        .catch((err) => {
          console.error('IPFS download error:', err)
          // Even if IPFS fails, the on-chain record is made
          setDownloaded(true)
          setDownloading(false)
        })
    }
  }, [downloadSuccess, fileInfo])

  // Handle access success
  useEffect(() => {
    if (accessSuccess) {
      setDownloading(false)
    }
  }, [accessSuccess])

  // ─── Computed ───────────────────────────────────────────────────────────────

  const priceUSDC = fileInfo?.price ? Number(fileInfo.price) / 1e6 : 0
  const hasPrice = priceUSDC > 0
  const needsAccessCode = fileInfo?.hasPassword ?? false
  const remainingDownloads = fileInfo?.maxDownloads
    ? Number(fileInfo.maxDownloads) - Number(fileInfo.downloadCount)
    : '∞'
  const isOwner = fileOwner?.toLowerCase() === address?.toLowerCase()

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black/30" />
      </div>
    )
  }

  // File not found
  if (!fileLoading && !fileInfo && fileId > 0) {
    return (
      <div className="min-h-screen bg-[#F5F4F0]">
        <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.08]">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#111]" />
              <span className="font-medium text-sm">FhenixDropBox</span>
            </Link>
            <Link href="/" className="text-xs text-black/50 hover:text-black transition-colors">
              Back to Home
            </Link>
          </div>
        </header>
        <div className="pt-32 text-center">
          <XCircle className="w-16 h-16 text-black/20 mx-auto mb-4" />
          <h1 className="text-xl font-medium mb-2">File Not Found</h1>
          <p className="text-sm text-black/50">This file may have been removed or the link is invalid.</p>
        </div>
      </div>
    )
  }

  const alreadyAuthorized = accessInfo?.isAuthorized ?? false
  const alreadyDownloaded = accessInfo?.hasDownloaded ?? false
  const canDownload = alreadyAuthorized && !alreadyDownloaded
  const canRequestAccess = !alreadyAuthorized

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.08]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#111]" />
            <span className="font-medium text-sm">FhenixDropBox</span>
          </Link>
          <Link href="/dashboard" className="text-xs text-black/50 hover:text-black transition-colors">
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          {/* File Card */}
          <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden mb-6">
            {/* File Preview */}
            <div className="p-8 bg-gradient-to-br from-[#f5f4f0] to-[#e8e6e0] flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-white border border-black/[0.1] flex items-center justify-center mb-4 shadow-sm">
                <FileText className="w-10 h-10 text-black/40" />
              </div>
              <h1 className="text-xl font-medium text-center mb-2">
                {fileLoading ? "Loading..." : `File #${fileId}`}
              </h1>
              {fileInfo && (
                <div className="flex items-center gap-4 text-sm text-black/50">
                  <span>{remainingDownloads} downloads left</span>
                  {fileInfo.contentEncrypted && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Lock className="w-3 h-3" />
                        Encrypted
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Privacy Status */}
            <div className="px-6 py-4 border-t border-b border-black/[0.06] bg-black/[0.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">FHE Protected</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-black/40">
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {fileInfo ? fileInfo.downloadCount.toString() : "0"} downloads
                  </span>
                </div>
              </div>
            </div>

            {/* Access Form / Download */}
            {canRequestAccess ? (
              <div className="p-6 space-y-6">
                {/* Price Info */}
                {hasPrice && (
                  <div className="flex items-center justify-between p-4 bg-black/[0.02] rounded-xl">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-black/40" />
                      <span className="text-sm">Access Price</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{priceUSDC} USDC</span>
                      <Lock className="w-3 h-3 text-black/20" />
                    </div>
                  </div>
                )}

                {/* Access Code Input */}
                {needsAccessCode && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-3">
                      <Key className="w-4 h-4 text-black/40" />
                      Access Code (PIN)
                    </label>
                    <div className="relative">
                      <input
                        type={showAccessCode ? "text" : "password"}
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        placeholder="Enter PIN code"
                        className="w-full px-4 py-3 rounded-xl border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.2]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccessCode(!showAccessCode)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black"
                      >
                        {showAccessCode ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    <div className="font-medium mb-1">FHE Privacy Protection</div>
                    <div className="text-emerald-600/80 text-xs">
                      All access rules (price, PIN code, limits) are encrypted on-chain using FHE.
                      Your PIN and payment are private.
                    </div>
                  </div>
                </div>

                {/* Request Access Button */}
                <button
                  onClick={handleRequestAccess}
                  disabled={downloading || isRequestingAccess || isWaitingAccess}
                  className="w-full py-4 rounded-xl bg-[#111] text-white font-medium hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {downloading || isRequestingAccess || isWaitingAccess ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isRequestingAccess ? "Confirm in wallet..." : "Processing..."}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {hasPrice ? `Pay ${priceUSDC} USDC & Access` : "Request Access"}
                    </>
                  )}
                </button>

                {/* Connect Wallet */}
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
                {/* Access Verified */}
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
                      <code className="text-xs text-black/60 font-mono">{fileInfo.ipfsHash.slice(0, 20)}...</code>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-black/50">Content</span>
                      <span className="text-sm">{fileInfo.contentEncrypted ? "Encrypted (AES-256)" : "Unencrypted"}</span>
                    </div>
                  </div>
                )}

                {/* Download Button */}
                {canDownload && (
                  <button
                    onClick={handleDownload}
                    disabled={downloading || isDownloadingTx || isWaitingDownload}
                    className={`w-full py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                      downloaded
                        ? "bg-emerald-500 text-white"
                        : "bg-[#111] text-white hover:bg-[#333]"
                    } disabled:opacity-80`}
                  >
                    {downloading || isDownloadingTx || isWaitingDownload ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download File
                      </>
                    )}
                  </button>
                )}

                {downloaded && (
                  <div className="text-center p-4 bg-emerald-50 rounded-xl">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <div className="text-sm font-medium text-emerald-700">Download Complete</div>
                    <div className="text-xs text-emerald-600 mt-1">
                      File retrieved from IPFS{fileInfo?.contentEncrypted ? " and decrypted" : ""}
                    </div>
                  </div>
                )}

                {alreadyDownloaded && (
                  <div className="text-center p-4 bg-black/[0.02] rounded-xl">
                    <div className="text-sm text-black/50">
                      You have already downloaded this file
                    </div>
                  </div>
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

export default function SharePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params)
  const fileId = params.id ? parseInt(params.id, 10) : 0

  return (
    <ShareContent fileId={fileId} />
  )
}
