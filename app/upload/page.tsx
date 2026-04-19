"use client"

import { useState, useCallback, useEffect } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { Upload, X, Lock, Key, Clock, Download, DollarSign, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, FileText, ArrowLeft, Plus, Files, EyeOff as BlurIcon, FolderPlus, Link2 } from "lucide-react"
import Link from "next/link"
import { FHENIX_DROPBOX_ABI, CONTRACT_ADDRESS, hashPassword } from "@/lib/fhenix"
import { uploadToIPFS } from "@/lib/ipfs"
import { sepolia } from "wagmi/chains"

// Coming soon tooltip component
function ComingSoon({ children, label }: { children: React.ReactNode; label: string }) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </div>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#111] text-white text-xs rounded-lg whitespace-nowrap z-50">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111]" />
        </div>
      )}
    </div>
  )
}

interface FileItem {
  id: string
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
  linkExpiryDays: string
  previewEnabled: boolean
}

export default function UploadPage() {
  const { address, isConnected, chain } = useAccount()
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [accessRules, setAccessRules] = useState<AccessRules>({
    price: "0",
    password: "",
    maxDownloads: "100",
    expiryDays: "365",
    linkExpiryDays: "0",
    previewEnabled: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployed, setDeployed] = useState(false)
  const [shareLinks, setShareLinks] = useState<{ id: string; link: string; name: string }[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)

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

    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).map((file, index) => ({
        id: `${Date.now()}-${index}`,
        file,
        name: file.name,
        size: formatFileSize(file.size),
        ipfsHash: null,
        uploading: true,
        uploaded: false,
        error: null,
      }))
      setFiles(prev => [...prev, ...newFiles])
    }
  }, [])

  const handleFileSelect = (selectedFiles: FileList) => {
    const newFiles = Array.from(selectedFiles).map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      ipfsHash: null,
      uploading: true,
      uploaded: false,
      error: null,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files)
    }
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  // Upload files to IPFS
  useEffect(() => {
    const uploadPendingFiles = files.filter(f => f.uploading && !f.ipfsHash && !f.error)
    if (uploadPendingFiles.length === 0) return

    const uploadFiles = async () => {
      for (const fileItem of uploadPendingFiles) {
        if (!fileItem.file) continue

        try {
          const result = await uploadToIPFS(fileItem.file)
          setFiles(prev => prev.map(f =>
            f.id === fileItem.id
              ? { ...f, ipfsHash: result.hash, uploading: false, uploaded: true }
              : f
          ))
        } catch (error) {
          setFiles(prev => prev.map(f =>
            f.id === fileItem.id
              ? { ...f, uploading: false, error: "Upload failed" }
              : f
          ))
        }
      }
    }

    uploadFiles()
  }, [files])

  // Calculate upload progress
  useEffect(() => {
    if (files.length === 0) {
      setUploadProgress(0)
      return
    }
    const uploaded = files.filter(f => f.uploaded).length
    setUploadProgress(Math.round((uploaded / files.length) * 100))
  }, [files])

  // Contract write
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract()

  const handleDeploy = async () => {
    const uploadedFiles = files.filter(f => f.uploaded && f.ipfsHash)
    if (uploadedFiles.length === 0 || !address) return

    setDeploying(true)

    try {
      const passwordHash = accessRules.password
        ? hashPassword(accessRules.password)
        : "0x0000000000000000000000000000000000000000"

      // Deploy first file (for demo)
      const firstFile = uploadedFiles[0]
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: FHENIX_DROPBOX_ABI,
        functionName: 'uploadFile',
        args: [
          firstFile.ipfsHash!,
          BigInt(parseFloat(accessRules.price) * 1e6),
          BigInt(accessRules.maxDownloads || "0"),
          BigInt(accessRules.expiryDays || "0"),
          passwordHash as `0x${string}`
        ],
        chainId: sepolia.id,
      })
    } catch (error) {
      console.error("Deploy error:", error)
      setDeploying(false)
    }
  }

  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (isSuccess && txHash) {
      const newLinks = files
        .filter(f => f.uploaded && f.ipfsHash)
        .map(f => ({
          id: f.id,
          name: f.name,
          link: `${window.location.origin}/share/${f.ipfsHash?.slice(-8) || Math.random().toString(36).slice(-8)}`
        }))
      setShareLinks(newLinks)
      setDeployed(true)
      setDeploying(false)
    }
  }, [isSuccess, txHash, files])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
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
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-medium">Upload Files</h1>
          <p className="text-sm text-black/50">
            Share files with encrypted access control
          </p>
        </div>
      </div>

      {/* Network Status */}
      <div className="bg-white rounded-xl border border-black/[0.07] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${chain?.id === sepolia.id ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-sm">{chain?.name || 'Unknown Network'}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-black/50">
          <span>{files.length} files selected</span>
          {files.length > 0 && (
            <span>{uploadProgress}% uploaded</span>
          )}
        </div>
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
          multiple
          disabled={deployed}
        />

        {files.length === 0 ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-black/[0.04] flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-black/40" />
            </div>
            <div className="font-medium mb-2">Drop files here</div>
            <div className="text-sm text-black/50">
              or click to browse. Multiple files supported.
            </div>
            <div className="text-xs text-black/30 mt-2">Max 50MB per file</div>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/[0.07]">
                <div className="w-12 h-12 rounded-xl bg-black/[0.04] flex items-center justify-center">
                  <FileText className="w-6 h-6 text-black/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-xs text-black/50">{file.size}</div>
                </div>
                {file.uploading && (
                  <Loader2 className="w-5 h-5 animate-spin text-black/30" />
                )}
                {file.uploaded && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
                {file.error && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                {!deployed && !file.uploading && (
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-2 rounded-lg hover:bg-black/[0.04]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Access Rules */}
      {!deployed && files.filter(f => f.uploaded).length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Access Rules</h2>
              <p className="text-sm text-black/50">All values are encrypted on-chain</p>
            </div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-black/50 hover:text-black"
            >
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Price */}
            <div className="bg-white rounded-xl border border-black/[0.07] p-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                <DollarSign className="w-4 h-4 text-black/40" />
                Price (USDC)
              </label>
              <input
                type="number"
                value={accessRules.price}
                onChange={(e) => setAccessRules({ ...accessRules, price: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm"
                placeholder="0"
              />
            </div>

            {/* Password */}
            <div className="bg-white rounded-xl border border-black/[0.07] p-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                <Key className="w-4 h-4 text-black/40" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={accessRules.password}
                  onChange={(e) => setAccessRules({ ...accessRules, password: e.target.value })}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm"
                  placeholder="Optional"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                onChange={(e) => setAccessRules({ ...accessRules, maxDownloads: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm"
                placeholder="100"
              />
            </div>

            {/* Expiry */}
            <div className="bg-white rounded-xl border border-black/[0.07] p-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                <Clock className="w-4 h-4 text-black/40" />
                Expires (Days)
              </label>
              <input
                type="number"
                value={accessRules.expiryDays}
                onChange={(e) => setAccessRules({ ...accessRules, expiryDays: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm"
                placeholder="365"
              />
            </div>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="bg-white rounded-xl border border-black/[0.07] p-4 space-y-4">
              <h3 className="font-medium">Advanced Options</h3>

              {/* Link Expiry */}
              <ComingSoon label="Coming in Wave 2">
                <div className="flex items-center justify-between p-4 bg-black/[0.02] rounded-lg opacity-50">
                  <div className="flex items-center gap-3">
                    <Link2 className="w-5 h-5 text-black/40" />
                    <div>
                      <div className="text-sm font-medium">Link Expiry</div>
                      <div className="text-xs text-black/50">24h / 7d / 30d</div>
                    </div>
                  </div>
                  <span className="text-xs bg-black/[0.1] px-2 py-1 rounded">Soon</span>
                </div>
              </ComingSoon>

              {/* File Preview */}
              <ComingSoon label="Coming in Wave 2">
                <div className="flex items-center justify-between p-4 bg-black/[0.02] rounded-lg opacity-50">
                  <div className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-black/40" />
                    <div>
                      <div className="text-sm font-medium">File Preview</div>
                      <div className="text-xs text-black/50">PDF & image thumbnails</div>
                    </div>
                  </div>
                  <span className="text-xs bg-black/[0.1] px-2 py-1 rounded">Soon</span>
                </div>
              </ComingSoon>

              {/* Folder Upload */}
              <ComingSoon label="Coming in Wave 2">
                <div className="flex items-center justify-between p-4 bg-black/[0.02] rounded-lg opacity-50">
                  <div className="flex items-center gap-3">
                    <FolderPlus className="w-5 h-5 text-black/40" />
                    <div>
                      <div className="text-sm font-medium">Folder Upload</div>
                      <div className="text-xs text-black/50">Upload multiple files</div>
                    </div>
                  </div>
                  <span className="text-xs bg-black/[0.1] px-2 py-1 rounded">Soon</span>
                </div>
              </ComingSoon>
            </div>
          )}

          {/* Error */}
          {writeError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
              {writeError.message || "Transaction failed"}
            </div>
          )}

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            disabled={deploying || isPending || isWaiting || files.filter(f => f.uploaded).length === 0}
            className="w-full py-4 rounded-xl bg-[#111] text-white text-sm font-medium hover:bg-[#333] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPending || isWaiting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isPending ? "Confirm in wallet..." : "Waiting..."}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Deploy {files.filter(f => f.uploaded).length} file(s) with Private Rules
              </>
            )}
          </button>
        </div>
      )}

      {/* Success */}
      {deployed && shareLinks.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/[0.07] p-8 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-medium mb-2">Files Deployed!</h2>
            <p className="text-sm text-black/50">
              Your files are now stored with encrypted access rules.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Share Links</h3>
            {shareLinks.map((link) => (
              <div key={link.id} className="flex items-center gap-2 p-3 bg-black/[0.02] rounded-lg">
                <FileText className="w-4 h-4 text-black/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{link.name}</div>
                  <div className="text-xs text-black/40 font-mono truncate">{link.link}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(link.link)}
                  className="px-3 py-1.5 bg-[#111] text-white text-xs rounded-lg shrink-0"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>

          {txHash && (
            <div className="p-3 bg-black/[0.02] rounded-lg">
              <div className="text-xs text-black/40 mb-1">Transaction</div>
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline font-mono"
              >
                {txHash}
              </a>
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="flex-1 py-3 text-center rounded-xl bg-[#111] text-white text-sm"
            >
              Dashboard
            </Link>
            <button
              onClick={() => {
                setFiles([])
                setShareLinks([])
                setDeployed(false)
              }}
              className="flex-1 py-3 text-center rounded-xl border border-black/[0.1] text-sm"
            >
              Upload More
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
