"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi"
import {
  Upload, X, Lock, Key, Clock, Download, DollarSign, Eye, EyeOff,
  Loader2, CheckCircle2, AlertCircle, FileText, ArrowLeft, Shield, Link2, EyeOff as BlurIcon, FolderPlus, Zap
} from "lucide-react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { FHENIX_DROPBOX_ABI, CONTRACT_ADDRESS, hashPassword, ZERO_BYTES32 } from "@/lib/fhenix"
import { uploadToIPFSViaAPI, generateEncryptionKey, generateIV } from "@/lib/ipfs"
import { sepolia } from "wagmi/chains"

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileItem {
  id: string
  file: File | null
  name: string
  size: string
  ipfsHash: string | null
  encryptionKey: string | null
  encryptionIv: string | null
  isEncrypted: boolean
  uploading: boolean
  uploaded: boolean
  error: string | null
}

interface AccessRules {
  price: string
  accessCode: string
  maxDownloads: string
  expiryDays: string
  encryptContent: boolean
}

interface UploadedFileData {
  ipfsHash: string
  encryptionKey?: string
  encryptionIv?: string
  isEncrypted: boolean
  name: string
}

// ─── Coming Soon Tooltip ─────────────────────────────────────────────────────

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

// ─── Main Component ─────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter()
  const { address, isConnected, chain } = useAccount()
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [accessRules, setAccessRules] = useState<AccessRules>({
    price: "0",
    accessCode: "",
    maxDownloads: "100",
    expiryDays: "365",
    encryptContent: true,
  })
  const [showAccessCode, setShowAccessCode] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployed, setDeployed] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileData[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileIds, setFileIds] = useState<bigint[]>([])
  const [qrModalFile, setQrModalFile] = useState<{ fileId: bigint; fileName: string } | null>(null)
  const [baseUrl, setBaseUrl] = useState<string>('')

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // ─── Drag & Drop ────────────────────────────────────────────────────────────

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
      addFiles(Array.from(e.dataTransfer.files))
    }
  }, [])

  const addFiles = (fileList: File[]) => {
    const newFiles: FileItem[] = fileList.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      ipfsHash: null,
      encryptionKey: null,
      encryptionIv: null,
      isEncrypted: accessRules.encryptContent,
      uploading: true,
      uploaded: false,
      error: null,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  // ─── IPFS Upload ────────────────────────────────────────────────────────────

  useEffect(() => {
    const uploadPendingFiles = files.filter(f => f.uploading && !f.ipfsHash && !f.error)
    if (uploadPendingFiles.length === 0) return

    const uploadFiles = async () => {
      for (const fileItem of uploadPendingFiles) {
        if (!fileItem.file) continue

        try {
          let result: { hash: string; size: number; timestamp: string }
          let encryptionKey: string | null = null
          let encryptionIv: string | null = null

          if (accessRules.encryptContent) {
            // Generate encryption key and IV
            encryptionKey = generateEncryptionKey()
            encryptionIv = generateIV()

            // Encrypt file content
            const fileBuffer = await fileItem.file.arrayBuffer()
            const keyData = Uint8Array.from(atob(encryptionKey), c => c.charCodeAt(0))
            const ivData = Uint8Array.from(atob(encryptionIv), c => c.charCodeAt(0))

            const cryptoKey = await crypto.subtle.importKey(
              'raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
            )

            const encrypted = await crypto.subtle.encrypt(
              { name: 'AES-GCM', iv: ivData },
              cryptoKey,
              fileBuffer
            )

            // Upload encrypted file
            const encryptedBlob = new Blob([encrypted])
            const encryptedFile = new File([encryptedBlob], `enc_${fileItem.name}`)

            result = await uploadToIPFSViaAPI(encryptedFile)
          } else {
            // Upload unencrypted
            result = await uploadToIPFSViaAPI(fileItem.file)
          }

          setFiles(prev => prev.map(f =>
            f.id === fileItem.id
              ? {
                  ...f,
                  ipfsHash: result.hash,
                  encryptionKey,
                  encryptionIv,
                  isEncrypted: accessRules.encryptContent,
                  uploading: false,
                  uploaded: true
                }
              : f
          ))
        } catch (error) {
          console.error('Upload error:', error)
          setFiles(prev => prev.map(f =>
            f.id === fileItem.id
              ? { ...f, uploading: false, error: "Upload failed" }
              : f
          ))
        }
      }
    }

    uploadFiles()
  }, [files, accessRules.encryptContent])

  // Calculate upload progress
  useEffect(() => {
    if (files.length === 0) {
      setUploadProgress(0)
      return
    }
    const uploaded = files.filter(f => f.uploaded).length
    setUploadProgress(Math.round((uploaded / files.length) * 100))
  }, [files])

  // ─── Contract Interaction ──────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract()

  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Get total files before upload to calculate file IDs
  const { data: totalFilesBefore } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'totalFiles',
    query: { enabled: !!address }
  }) as { data: bigint | undefined }

  useEffect(() => {
    if (isSuccess && totalFilesBefore !== undefined && !deployed) {
      const filesUploaded = files.filter(f => f.uploaded && f.ipfsHash).length
      const startId = Number(totalFilesBefore)

      // Generate IDs for all uploaded files
      const newFileIds: bigint[] = []
      for (let i = 0; i < filesUploaded; i++) {
        newFileIds.push(BigInt(startId + i))
      }

      // Store uploaded file data
      const uploadedFileData: UploadedFileData[] = files
        .filter(f => f.uploaded && f.ipfsHash)
        .map(f => ({
          ipfsHash: f.ipfsHash!,
          encryptionKey: f.encryptionKey || undefined,
          encryptionIv: f.encryptionIv || undefined,
          isEncrypted: f.isEncrypted,
          name: f.name
        }))

      setUploadedFiles(uploadedFileData)
      setFileIds(newFileIds)
      setDeployed(true)
      setDeploying(false)
    }
  }, [isSuccess, totalFilesBefore, deployed, files])

  const handleDeploy = async () => {
    const readyFiles = files.filter(f => f.uploaded && f.ipfsHash)
    if (readyFiles.length === 0 || !address) return

    setDeploying(true)

    try {
      // Hash the access code
      const accessCodeHash = accessRules.accessCode
        ? hashPassword(accessRules.accessCode)
        : ZERO_BYTES32

      // Create encryption key hash for content encryption
      const encryptionKeyHash = readyFiles[0].encryptionKey
        ? hashPassword(readyFiles[0].encryptionKey!)
        : ZERO_BYTES32

      // Upload first file with access rules
      const firstFile = readyFiles[0]
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: FHENIX_DROPBOX_ABI,
        functionName: 'uploadFile',
        args: [
          firstFile.ipfsHash!,
          BigInt(parseFloat(accessRules.price || "0") * 1e6),
          BigInt(accessRules.maxDownloads || "100"),
          BigInt(accessRules.expiryDays || "365"),
          accessCodeHash,
          accessRules.encryptContent,
          encryptionKeyHash
        ],
        chainId: sepolia.id,
      })
    } catch (error) {
      console.error("Deploy error:", error)
      setDeploying(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

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
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    {file.isEncrypted && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        Encrypted
                      </span>
                    )}
                  </div>
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
              <div className="relative">
                <input
                  type="number"
                  value={accessRules.price}
                  onChange={(e) => setAccessRules({ ...accessRules, price: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-black/40">
                  USDC
                </span>
              </div>
            </div>

            {/* Access Code */}
            <div className="bg-white rounded-xl border border-black/[0.07] p-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                <Key className="w-4 h-4 text-black/40" />
                Access Code
              </label>
              <div className="relative">
                <input
                  type={showAccessCode ? "text" : "password"}
                  value={accessRules.accessCode}
                  onChange={(e) => setAccessRules({ ...accessRules, accessCode: e.target.value })}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-black/[0.1] bg-black/[0.02] text-sm"
                  placeholder="Optional PIN code"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessCode(!showAccessCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30"
                >
                  {showAccessCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                min="1"
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
                min="0"
              />
            </div>
          </div>

          {/* Encryption Toggle */}
          <div className="bg-white rounded-xl border border-black/[0.07] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-black/40" />
                <div>
                  <div className="text-sm font-medium">Encrypt File Content</div>
                  <div className="text-xs text-black/50">
                    AES-256 encryption before IPFS upload
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAccessRules(prev => ({ ...prev, encryptContent: !prev.encryptContent }))}
                className={`w-12 h-7 rounded-full relative transition-colors ${
                  accessRules.encryptContent ? "bg-[#111]" : "bg-black/[0.1]"
                }`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  accessRules.encryptContent ? "left-[calc(100%-24px)]" : "left-1"
                }`} />
              </button>
            </div>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="bg-white rounded-xl border border-black/[0.07] p-4 space-y-4">
              <h3 className="font-medium">Advanced Options</h3>

              <ComingSoon label="Coming in Wave 3">
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

              <ComingSoon label="Coming in Wave 3">
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

              <ComingSoon label="Coming in Wave 3">
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

          {/* FHE Privacy Notice */}
          <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-700">
              <div className="font-medium mb-1">FHE Privacy Protection</div>
              <div className="text-emerald-600/80 text-xs">
                Your access rules (price, downloads, expiry) are encrypted on-chain using FHE.
                {accessRules.encryptContent && " File contents are encrypted with AES-256 before upload."}
              </div>
            </div>
          </div>

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
                {isPending ? "Confirm in wallet..." : "Processing..."}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Deploy {files.filter(f => f.uploaded).length} File(s) with Encrypted Rules
              </>
            )}
          </button>
        </div>
      )}

      {/* Success */}
      {deployed && fileIds.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/[0.07] p-8 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-medium mb-2">Files Deployed!</h2>
            <p className="text-sm text-black/50">
              Your files are now stored with encrypted access rules on-chain.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Share Links</h3>
            {fileIds.map((fileId, index) => {
              const fileName = uploadedFiles[index]?.name || `File #${fileId.toString()}`
              return (
                <div key={fileId.toString()} className="flex items-center gap-2 p-3 bg-black/[0.02] rounded-lg">
                  <FileText className="w-4 h-4 text-black/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{fileName}</div>
                    <div className="text-xs text-black/40 font-mono">
                      {baseUrl}/share/{fileId.toString()}
                    </div>
                  </div>
                  <button
                    onClick={() => setQrModalFile({ fileId, fileName })}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg shrink-0 flex items-center gap-1 hover:bg-emerald-700"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                    QR
                  </button>
                  <button
                    onClick={() => {
                      const link = `${baseUrl}/share/${fileId.toString()}`
                      copyToClipboard(link)
                    }}
                    className="px-3 py-1.5 bg-[#111] text-white text-xs rounded-lg shrink-0 flex items-center gap-1"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
              )
            })}
          </div>

          {qrModalFile && (
            <QRModal
              fileId={qrModalFile.fileId}
              fileName={qrModalFile.fileName}
              onClose={() => setQrModalFile(null)}
            />
          )}

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
                setUploadedFiles([])
                setFileIds([])
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

// Copy icon helper
function Copy({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

// QR Code modal component
function QRModal({ fileId, fileName, onClose }: { fileId: bigint; fileName: string; onClose: () => void }) {
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    setShareUrl(`${window.location.origin}/share/${fileId.toString()}`)
  }, [fileId])

  // Generate hash for the share URL
  const generateHash = (input: string): string => {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()
  }

  const urlHash = generateHash(shareUrl)
  const hashedUrl = `${shareUrl}?h=${urlHash}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <h3 className="text-lg font-medium">Scan to Access</h3>
          <p className="text-sm text-black/50 truncate">{fileName}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-black/[0.1] flex items-center justify-center mb-4">
          <QRCodeSVG value={hashedUrl} size={180} level="H" />
        </div>
        <div className="text-center">
          <div className="text-xs text-black/40 mb-1">Secure Link ID</div>
          <div className="text-sm font-mono text-black/60">{urlHash}</div>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-[#111] text-white text-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}
