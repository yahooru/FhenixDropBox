"use client"

import { useState, useCallback } from "react"
import { useAccount } from "wagmi"
import { Upload, X, Lock, Key, Clock, Download, DollarSign, Users, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react"
import Link from "next/link"

interface FileData {
  file: File | null
  name: string
  size: string
  ipfsHash: string | null
  uploading: boolean
  uploaded: boolean
  error: string | null
}

interface AccessRules {
  price: string
  password: string
  maxDownloads: string
  expiryDays: string
  allowedAddresses: string[]
}

export default function UploadPage() {
  const { address, isConnected } = useAccount()
  const [dragActive, setDragActive] = useState(false)
  const [fileData, setFileData] = useState<FileData>({
    file: null,
    name: "",
    size: "",
    ipfsHash: null,
    uploading: false,
    uploaded: false,
    error: null,
  })
  const [accessRules, setAccessRules] = useState<AccessRules>({
    price: "0",
    password: "",
    maxDownloads: "100",
    expiryDays: "365",
    allowedAddresses: [],
  })
  const [showPassword, setShowPassword] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployed, setDeployed] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      handleFileSelect(file)
    }
  }, [])

  const handleFileSelect = (file: File) => {
    setFileData({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      ipfsHash: null,
      uploading: true,
      uploaded: false,
      error: null,
    })

    // Simulate IPFS upload
    setTimeout(() => {
      setFileData((prev) => ({
        ...prev,
        ipfsHash: "Qm" + Math.random().toString(36).substring(2, 15),
        uploading: false,
        uploaded: true,
      }))
    }, 2000)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const removeFile = () => {
    setFileData({
      file: null,
      name: "",
      size: "",
      ipfsHash: null,
      uploading: false,
      uploaded: false,
      error: null,
    })
  }

  const handleDeploy = async () => {
    if (!fileData.uploaded || !address) return

    setDeploying(true)

    // Simulate blockchain transaction
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Generate share link
    const linkId = Math.random().toString(36).substring(2, 10)
    setShareLink(`${window.location.origin}/share/${linkId}`)
    setDeployed(true)
    setDeploying(false)
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-[#111] flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-medium mb-3">Connect Your Wallet</h1>
        <p className="text-sm text-black/50">
          Connect your wallet to upload and share files privately.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium">Upload File</h1>
        <p className="text-sm text-black/50 mt-1">
          Upload a file and set private access rules. Everything will be encrypted.
        </p>
      </div>

      {/* File Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-12 transition-colors ${
          dragActive
            ? "border-[#111] bg-black/[0.02]"
            : "border-black/[0.15] hover:border-black/[0.25]"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={!!fileData.file}
        />

        {fileData.file ? (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-black/[0.04] flex items-center justify-center">
              <FileText className="w-7 h-7 text-black/40" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{fileData.name}</div>
              <div className="text-sm text-black/50">{fileData.size}</div>
            </div>
            {fileData.uploading && (
              <div className="flex items-center gap-2 text-sm text-black/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading to IPFS...
              </div>
            )}
            {fileData.uploaded && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                Uploaded
              </div>
            )}
            {!fileData.uploading && !fileData.uploaded && (
              <button
                onClick={removeFile}
                className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors"
              >
                <X className="w-5 h-5 text-black/40" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-black/[0.04] flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-black/40" />
            </div>
            <div className="font-medium mb-2">Drop your file here</div>
            <div className="text-sm text-black/50">
              or click to browse. Max file size: 100MB
            </div>
          </div>
        )}
      </div>

      {/* IPFS Hash */}
      {fileData.ipfsHash && (
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium">Stored on IPFS</span>
          </div>
          <div className="flex items-center gap-2 bg-black/[0.03] rounded-lg p-3">
            <code className="text-xs text-black/60 flex-1 break-all">{fileData.ipfsHash}</code>
            <button className="text-xs text-black/40 hover:text-black transition-colors">
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Access Rules */}
      {fileData.uploaded && !deployed && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium mb-1">Access Rules</h2>
            <p className="text-sm text-black/50">
              Set private access rules. All values are encrypted on-chain.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Price */}
            <div className="bg-white rounded-xl border border-black/[0.07] p-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                <DollarSign className="w-4 h-4 text-black/40" />
                Price (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={accessRules.price}
                  onChange={(e) =>
                    setAccessRules({ ...accessRules, price: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.2]"
                  placeholder="0"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/30">
                  USDC
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-emerald-600">
                <Lock className="w-3 h-3" />
                This price is hidden on-chain
              </div>
            </div>

            {/* Password */}
            <div className="bg-white rounded-xl border border-black/[0.07] p-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                <Key className="w-4 h-4 text-black/40" />
                Password (Optional)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={accessRules.password}
                  onChange={(e) =>
                    setAccessRules({ ...accessRules, password: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.2]"
                  placeholder="Set a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-emerald-600">
                <Lock className="w-3 h-3" />
                Password is encrypted
              </div>
            </div>

            {/* Max Downloads */}
            <div className="bg-white rounded-xl border border-black/[0.07] p-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                <Download className="w-4 h-4 text-black/40" />
                Max Downloads
              </label>
              <input
                type="number"
                value={accessRules.maxDownloads}
                onChange={(e) =>
                  setAccessRules({ ...accessRules, maxDownloads: e.target.value })
                }
                className="w-full px-4 py-2.5 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.2]"
                placeholder="100"
              />
              <div className="flex items-center gap-2 mt-2 text-xs text-emerald-600">
                <Lock className="w-3 h-3" />
                Hidden from others
              </div>
            </div>

            {/* Expiry */}
            <div className="bg-white rounded-xl border border-black/[0.07] p-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                <Clock className="w-4 h-4 text-black/40" />
                Expires In (Days)
              </label>
              <input
                type="number"
                value={accessRules.expiryDays}
                onChange={(e) =>
                  setAccessRules({ ...accessRules, expiryDays: e.target.value })
                }
                className="w-full px-4 py-2.5 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm focus:outline-none focus:border-black/[0.2]"
                placeholder="365"
              />
              <div className="flex items-center gap-2 mt-2 text-xs text-emerald-600">
                <Lock className="w-3 h-3" />
                Expiry is private
              </div>
            </div>
          </div>

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="w-full py-4 rounded-xl bg-[#111] text-white text-sm font-medium hover:bg-[#333] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deploying to Fhenix...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Deploy with Private Access Rules
              </>
            )}
          </button>
        </div>
      )}

      {/* Success */}
      {deployed && shareLink && (
        <div className="bg-white rounded-2xl border border-black/[0.07] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-medium mb-2">File Deployed!</h2>
          <p className="text-sm text-black/50 mb-6">
            Your file is now stored with encrypted access rules. Share the link below.
          </p>

          <div className="bg-black/[0.03] rounded-xl p-4 mb-6">
            <div className="text-xs text-black/40 mb-2">Share Link</div>
            <div className="flex items-center gap-2">
              <code className="text-sm flex-1 break-all">{shareLink}</code>
              <button className="px-3 py-1.5 rounded-lg bg-[#111] text-white text-xs">
                Copy
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 mb-6">
            <Lock className="w-3 h-3" />
            Access rules are encrypted on Fhenix
          </div>

          <div className="flex gap-3 justify-center">
            <Link
              href={shareLink}
              className="px-5 py-2.5 rounded-xl bg-[#111] text-white text-sm hover:bg-[#333] transition-colors"
            >
              Preview Page
            </Link>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl border border-black/[0.1] text-sm hover:bg-black/[0.02] transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
