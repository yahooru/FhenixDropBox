"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAccount, useReadContract, useSignMessage, useSwitchChain, useWaitForTransactionReceipt, useWalletClient, useWriteContract } from "wagmi"
import { sepolia } from "wagmi/chains"
import { getAddress, keccak256, parseEventLogs, toBytes, type Hex } from "viem"
import { QRCodeSVG } from "qrcode.react"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Key,
  Link2,
  Loader2,
  Lock,
  Shield,
  Upload,
  X,
  Zap,
} from "lucide-react"
import {
  CONTRACT_ADDRESS,
  FHENIX_DROPBOX_ABI,
  ZERO_BYTES32,
  hashPassword,
  parseNativePrice,
  type ConfidentialRuleInput,
  type UploadInput,
} from "@/lib/fhenix"
import { encryptAccessRulesForUpload } from "@/lib/cofhe"
import { formatFileSize, generateEncryptionKey, generateIV, uploadToIPFSViaAPI } from "@/lib/ipfs"
import { getPreferences } from "@/lib/preferences"
import { MAX_RELAYER_INTENT_TTL_SECONDS, buildRelayerIntentHash, serializeRelayerInputs } from "@/lib/relayer"
import { buildShareUrl, saveLocalFileSecrets, type LocalFileSecret } from "@/lib/share-links"

const MAX_FILES = 10
const RESUMABLE_UPLOADS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_RESUMABLE_UPLOADS === "true"
const SINGLE_UPLOAD_MAX_FILE_SIZE = 8 * 1024 * 1024
const RESUMABLE_MAX_FILE_SIZE = 250 * 1024 * 1024
const AES_GCM_TAG_BYTES = 16

function getClientMaxFileSize(encryptContent: boolean) {
  if (!RESUMABLE_UPLOADS_ENABLED) return SINGLE_UPLOAD_MAX_FILE_SIZE
  return encryptContent ? RESUMABLE_MAX_FILE_SIZE - AES_GCM_TAG_BYTES : RESUMABLE_MAX_FILE_SIZE
}

interface FileItem {
  id: string
  file: File
  name: string
  mimeType: string
  sizeBytes: number
  sizeLabel: string
  ipfsHash: string | null
  previewHash: string | null
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
  enablePreview: boolean
  confidentialRules: boolean
}

function canPreview(file: File) {
  return file.type.startsWith("image/")
}

async function encryptFileForUpload(file: File, keyBase64: string, ivBase64: string) {
  const fileBuffer = await file.arrayBuffer()
  const keyData = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0))
  const ivData = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM", length: 256 }, false, ["encrypt"])
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivData }, cryptoKey, fileBuffer)
  return new File([new Blob([encrypted])], `encrypted_${file.name}`, { type: "application/octet-stream" })
}

async function createImagePreview(file: File) {
  const imageUrl = URL.createObjectURL(file)
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageUrl
  })

  const maxWidth = 900
  const scale = Math.min(1, maxWidth / image.width)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Preview canvas unavailable")
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(imageUrl)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error("Preview generation failed"))
    }, "image/jpeg", 0.82)
  })

  return new File([blob], `preview_${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" })
}

async function createPreviewFile(file: File) {
  if (file.type.startsWith("image/")) return createImagePreview(file)
  return null
}

function randomHex32(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`
}

export default function UploadPage() {
  const { address, isConnected, chain } = useAccount()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const { signMessageAsync } = useSignMessage()
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id })
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract()
  const { data: receipt, isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [accessRules, setAccessRules] = useState<AccessRules>({
    price: "0",
    accessCode: "",
    maxDownloads: "100",
    expiryDays: "7",
    encryptContent: true,
    enablePreview: true,
    confidentialRules: false,
  })
  const maxFileSize = getClientMaxFileSize(accessRules.encryptContent)
  const maxFileSizeLabel = formatFileSize(maxFileSize)
  const [anonymousMode, setAnonymousMode] = useState(false)
  const [showAccessCode, setShowAccessCode] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployed, setDeployed] = useState(false)
  const [fileIds, setFileIds] = useState<bigint[]>([])
  const [baseUrl, setBaseUrl] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [cofheStep, setCofheStep] = useState<string | null>(null)
  const [qrModalFile, setQrModalFile] = useState<{ fileId: bigint; file: FileItem } | null>(null)

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  useEffect(() => {
    if (!address || !walletClient) return
    setAccessRules((current) => current.confidentialRules ? current : { ...current, confidentialRules: true })
  }, [address, walletClient])

  useEffect(() => {
    if (!address) return
    const preferences = getPreferences(address)
    setAnonymousMode(preferences.anonymousUploads)
    setAccessRules((current) => ({
      ...current,
      price: preferences.defaultPrice,
      maxDownloads: preferences.defaultDownloads,
      expiryDays: preferences.defaultExpiry,
    }))
  }, [address])

  useEffect(() => {
    if (!writeError) return
    setNotice(writeError.message || "Transaction was not submitted")
    setDeploying(false)
    setCofheStep(null)
  }, [writeError])

  const { data: totalFilesBefore } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "totalFiles",
    query: { enabled: !!address },
  }) as { data: bigint | undefined }

  const readyFiles = useMemo(() => files.filter((file) => file.uploaded && file.ipfsHash), [files])
  const uploadProgress = files.length === 0 ? 0 : Math.round((readyFiles.length / files.length) * 100)
  const wrongNetwork = !!chain && chain.id !== sepolia.id

  const updateFile = useCallback((id: string, patch: Partial<FileItem>) => {
    setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, ...patch } : file)))
  }, [])

  const uploadFileItem = useCallback(async (item: FileItem, rules: AccessRules) => {
    try {
      if (!address) throw new Error("Connect your wallet before uploading")

      const uploadAuth = {
        owner: address as `0x${string}`,
        signMessage: (message: string) => signMessageAsync({ message }),
      }
      let fileToUpload = item.file
      let encryptionKey: string | null = null
      let encryptionIv: string | null = null
      let previewHash: string | null = null

      if (rules.enablePreview && canPreview(item.file)) {
        const previewFile = await createPreviewFile(item.file)
        if (previewFile) {
          const preview = await uploadToIPFSViaAPI(previewFile, undefined, uploadAuth)
          previewHash = preview.hash
        }
      }

      if (rules.encryptContent) {
        encryptionKey = generateEncryptionKey()
        encryptionIv = generateIV()
        fileToUpload = await encryptFileForUpload(item.file, encryptionKey, encryptionIv)
      }

      const result = await uploadToIPFSViaAPI(fileToUpload, undefined, uploadAuth)
      updateFile(item.id, {
        ipfsHash: result.hash,
        previewHash,
        encryptionKey,
        encryptionIv,
        isEncrypted: rules.encryptContent,
        uploading: false,
        uploaded: true,
      })
    } catch (error) {
      console.error("Upload error:", error)
      updateFile(item.id, {
        uploading: false,
        uploaded: false,
        error: error instanceof Error ? error.message : "Upload failed",
      })
    }
  }, [address, signMessageAsync, updateFile])

  const addFiles = useCallback((fileList: File[]) => {
    setNotice(null)

    const availableSlots = MAX_FILES - files.length
    if (availableSlots <= 0) {
      setNotice(`You can upload up to ${MAX_FILES} files per batch.`)
      return
    }

    const selected = fileList.slice(0, availableSlots)
    if (fileList.length > availableSlots) {
      setNotice(`Only ${availableSlots} more file(s) were added because this batch is capped at ${MAX_FILES}.`)
    }

    const accepted = selected.filter((file) => {
      if (file.size <= maxFileSize) return true
      setNotice(`${file.name} is larger than ${maxFileSizeLabel} and was skipped.`)
      return false
    })

    const newFiles: FileItem[] = accepted.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      sizeLabel: formatFileSize(file.size),
      ipfsHash: null,
      previewHash: null,
      encryptionKey: null,
      encryptionIv: null,
      isEncrypted: accessRules.encryptContent,
      uploading: true,
      uploaded: false,
      error: null,
    }))

    setFiles((prev) => [...prev, ...newFiles])
    newFiles.forEach((file) => void uploadFileItem(file, accessRules))
  }, [accessRules, files.length, maxFileSize, maxFileSizeLabel, uploadFileItem])

  const handleDrag = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(event.type === "dragenter" || event.type === "dragover")
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    addFiles(Array.from(event.dataTransfer.files || []))
  }, [addFiles])

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id))
  }

  const finalizeDeployedBatch = useCallback((newFileIds: bigint[]) => {
    if (address) {
      const secrets: LocalFileSecret[] = readyFiles.map((file, index) => ({
        fileId: newFileIds[index].toString(),
        fileName: file.name,
        mimeType: file.mimeType,
        fileSize: file.sizeBytes,
        ipfsHash: file.ipfsHash || "",
        encrypted: file.isEncrypted,
        encryptionKey: file.encryptionKey || undefined,
        encryptionIv: file.encryptionIv || undefined,
        previewHash: file.previewHash || undefined,
        anonymousUpload: anonymousMode,
        createdAt: Date.now(),
      }))
      saveLocalFileSecrets(address, secrets)
    }

    setFileIds(newFileIds)
    setDeploying(false)
    setDeployed(true)
  }, [address, anonymousMode, readyFiles])

  useEffect(() => {
    if (!isSuccess || deployed || !receipt) return

    const uploadLogs = parseEventLogs({
      abi: FHENIX_DROPBOX_ABI,
      logs: receipt.logs,
      eventName: "FileUploaded",
    })
    const loggedFileIds = uploadLogs
      .map((log) => {
        const args = log.args as Record<string, unknown>
        return args.fileId == null ? undefined : BigInt(args.fileId.toString())
      })
      .filter((fileId): fileId is bigint => fileId !== undefined)

    if (loggedFileIds.length === readyFiles.length) {
      finalizeDeployedBatch(loggedFileIds)
      return
    }

    if (totalFilesBefore === undefined) return
    const startId = Number(totalFilesBefore)
    finalizeDeployedBatch(readyFiles.map((_, index) => BigInt(startId + index)))
  }, [deployed, finalizeDeployedBatch, isSuccess, readyFiles, receipt, totalFilesBefore])

  const submitRelayedUpload = useCallback(async (inputs: UploadInput[]) => {
    if (!address) throw new Error("Connect your wallet before submitting an anonymous upload")

    const owner = getAddress(address as Hex)
    const nonce = BigInt(randomHex32())
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + MAX_RELAYER_INTENT_TTL_SECONDS)
    const ownerCommitment = keccak256(toBytes(JSON.stringify({
      owner,
      nonce: nonce.toString(),
      salt: randomHex32(),
    })))
    const serializedInputs = serializeRelayerInputs(inputs.map((input) => ({
      ...input,
      anonymousUpload: true,
    })))
    const intentHash = buildRelayerIntentHash({
      inputs: serializedInputs,
      owner,
      ownerCommitment,
      nonce,
      expiresAt,
      contractAddress: CONTRACT_ADDRESS as Hex,
    })
    const signature = await signMessageAsync({ message: { raw: intentHash } })
    const response = await fetch("/api/relayer/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner,
        ownerCommitment,
        nonce: nonce.toString(),
        expiresAt: expiresAt.toString(),
        inputs: serializedInputs,
        signature,
      }),
    })
    const result = await response.json().catch(() => ({})) as {
      error?: string
      transactionHash?: string
      fileIds?: string[]
    }

    if (!response.ok) {
      throw new Error(result.error || "Relayed upload failed")
    }

    const relayedFileIds = Array.isArray(result.fileIds) ? result.fileIds.map((fileId) => BigInt(fileId)) : []
    if (relayedFileIds.length !== readyFiles.length) {
      throw new Error("Relayer transaction completed but did not return the expected file ids")
    }

    finalizeDeployedBatch(relayedFileIds)
    if (result.transactionHash) {
      setNotice(`Anonymous upload relayed on-chain: ${result.transactionHash.slice(0, 10)}...${result.transactionHash.slice(-8)}`)
    }
  }, [address, finalizeDeployedBatch, readyFiles.length, signMessageAsync])

  const handleDeploy = async () => {
    if (!address || readyFiles.length === 0) return
    if (wrongNetwork) {
      switchChain({ chainId: sepolia.id })
      return
    }

    setDeploying(true)
    setNotice(null)

    try {
      const price = parseNativePrice(accessRules.price || "0")
      const accessCodeHash = accessRules.accessCode ? hashPassword(accessRules.accessCode) : ZERO_BYTES32

      const inputs: UploadInput[] = readyFiles.map((file) => ({
        ipfsHash: file.ipfsHash || "",
        fileName: file.name,
        mimeType: file.mimeType,
        fileSize: BigInt(file.sizeBytes),
        price,
        maxDownloads: BigInt(accessRules.maxDownloads || "0"),
        expiryDays: BigInt(accessRules.expiryDays || "0"),
        accessCodeHash,
        contentEncrypted: file.isEncrypted,
        encryptionKeyHash: file.encryptionKey ? hashPassword(file.encryptionKey) : ZERO_BYTES32,
        folderId: 0n,
        previewEnabled: !!file.previewHash,
        previewHash: file.previewHash || "",
        anonymousUpload: anonymousMode,
      }))

      if (anonymousMode) {
        if (accessRules.confidentialRules) {
          setCofheStep(null)
          setNotice("Anonymous uploads are submitted through the trusted relayer and registered on-chain with public access-rule fields.")
        }
        await submitRelayedUpload(inputs)
        return
      }

      if (accessRules.confidentialRules) {
        if (!walletClient) {
          throw new Error("CoFHE rule encryption requires the connected wallet client")
        }
        setCofheStep("Preparing CoFHE inputs")
        const encryptedRules = await encryptAccessRulesForUpload({
          account: address as `0x${string}`,
          walletClient,
          priceWei: price,
          maxDownloads: BigInt(accessRules.maxDownloads || "0"),
          expiryDays: BigInt(accessRules.expiryDays || "0"),
          accessCodeHash,
          onStep: setCofheStep,
        })
        const rulesBatch: ConfidentialRuleInput[] = readyFiles.map(() => encryptedRules)

        writeContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: FHENIX_DROPBOX_ABI,
          functionName: "uploadFilesBatchWithConfidentialRules",
          args: [inputs, rulesBatch],
          chainId: sepolia.id,
        })
        setCofheStep(null)
        return
      }

      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: FHENIX_DROPBOX_ABI,
        functionName: "uploadFilesBatch",
        args: [inputs],
        chainId: sepolia.id,
      })
    } catch (error) {
      console.error("Deploy error:", error)
      setNotice(error instanceof Error ? error.message : "Failed to submit transaction")
      setDeploying(false)
      setCofheStep(null)
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setNotice("Share link copied.")
    setTimeout(() => setNotice(null), 1600)
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
        <p className="text-sm text-black/50">Connect your wallet to upload and share files privately.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-medium">Upload Wave 5 Batch</h1>
            <p className="text-sm text-black/50">
              Encrypt locally, pin to IPFS, and register up to 10 files on-chain in one transaction.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-black/[0.07] bg-white px-4 py-3 text-xs text-black/55">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${wrongNetwork ? "bg-amber-500" : "bg-emerald-500"}`} />
            {chain?.name || "Unknown network"}
          </div>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <AlertCircle className="h-4 w-4" />
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div
            className={`relative rounded-2xl border-2 border-dashed bg-white p-8 transition-colors ${
              dragActive ? "border-[#111] bg-black/[0.02]" : "border-black/[0.12] hover:border-black/[0.22]"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              disabled={deployed || files.length >= MAX_FILES}
              onChange={(event) => {
                addFiles(Array.from(event.target.files || []))
                event.currentTarget.value = ""
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <div className="pointer-events-none text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/[0.04]">
                <Upload className="h-8 w-8 text-black/40" />
              </div>
              <div className="font-medium">Drop files here</div>
              <div className="mt-1 text-sm text-black/50">
                {files.length}/{MAX_FILES} selected, {maxFileSizeLabel} max per file{RESUMABLE_UPLOADS_ENABLED ? " with resumable upload" : ""}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.07] bg-white">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
              <div>
                <h2 className="font-medium">Files</h2>
                <p className="text-xs text-black/45">{uploadProgress}% uploaded to IPFS</p>
              </div>
              {files.length > 0 && !deployed && (
                <button onClick={() => setFiles([])} className="text-xs text-black/45 hover:text-black">
                  Clear
                </button>
              )}
            </div>
            {files.length === 0 ? (
              <div className="p-12 text-center text-sm text-black/40">Selected files will appear here.</div>
            ) : (
              <div className="divide-y divide-black/[0.05]">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                      <FileText className="h-6 w-6 text-black/40" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{file.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/45">
                        <span>{file.sizeLabel}</span>
                        {file.isEncrypted && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">AES-256</span>}
                        {file.previewHash && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">Preview</span>}
                      </div>
                    </div>
                    {file.uploading && <Loader2 className="h-5 w-5 animate-spin text-black/35" />}
                    {file.uploaded && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                    {file.error && <AlertCircle className="h-5 w-5 text-red-500" />}
                    {!deployed && (
                      <button onClick={() => removeFile(file.id)} className="rounded-lg p-2 hover:bg-black/[0.04]">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-black/[0.07] bg-white p-5">
            <h2 className="font-medium">Access Rules</h2>
            <p className="mt-1 text-xs text-black/45">Applied to every file in this batch.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-black/40" />
                  Price
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={accessRules.price}
                    onChange={(event) => setAccessRules({ ...accessRules, price: event.target.value })}
                    className="w-full rounded-xl border border-black/[0.1] bg-black/[0.02] px-4 py-3 pr-14 text-sm"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-black/40">ETH</span>
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Key className="h-4 w-4 text-black/40" />
                  Access Code
                </label>
                <div className="relative">
                  <input
                    type={showAccessCode ? "text" : "password"}
                    value={accessRules.accessCode}
                    onChange={(event) => setAccessRules({ ...accessRules, accessCode: event.target.value })}
                    placeholder="Optional PIN"
                    className="w-full rounded-xl border border-black/[0.1] bg-black/[0.02] px-4 py-3 pr-11 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessCode((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-black/35 hover:text-black"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Download className="h-4 w-4 text-black/40" />
                    Downloads
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={accessRules.maxDownloads}
                    onChange={(event) => setAccessRules({ ...accessRules, maxDownloads: event.target.value })}
                    className="w-full rounded-xl border border-black/[0.1] bg-black/[0.02] px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-black/40" />
                    Expiry
                  </label>
                  <select
                    value={accessRules.expiryDays}
                    onChange={(event) => setAccessRules({ ...accessRules, expiryDays: event.target.value })}
                    className="w-full rounded-xl border border-black/[0.1] bg-black/[0.02] px-4 py-3 text-sm"
                  >
                    <option value="1">24h</option>
                    <option value="7">7d</option>
                    <option value="30">30d</option>
                    <option value="0">Never</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-black/[0.07] bg-black/[0.02] p-4">
                <span>
                  <span className="block text-sm font-medium">Encrypt file contents</span>
                  <span className="text-xs text-black/45">Keys stay in the share link fragment, not on-chain.</span>
                </span>
                <input
                  type="checkbox"
                  checked={accessRules.encryptContent}
                  disabled={files.length > 0}
                  onChange={(event) => setAccessRules({ ...accessRules, encryptContent: event.target.checked })}
                  className="h-5 w-5"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-black/[0.07] bg-black/[0.02] p-4">
                <span>
                  <span className="block text-sm font-medium">Public image preview</span>
                  <span className="text-xs text-black/45">Preview files are visible before access.</span>
                </span>
                <input
                  type="checkbox"
                  checked={accessRules.enablePreview}
                  disabled={files.length > 0}
                  onChange={(event) => setAccessRules({ ...accessRules, enablePreview: event.target.checked })}
                  className="h-5 w-5"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-black/[0.07] bg-black/[0.02] p-4">
                <span>
                  <span className="block text-sm font-medium">CoFHE encrypted rule mirror</span>
                  <span className="text-xs text-black/45">
                    {anonymousMode
                      ? "Available for direct wallet uploads."
                      : "Price, limits, expiry, and PIN commitment are stored as Fhenix encrypted handles."}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={!anonymousMode && accessRules.confidentialRules}
                  disabled={deployed || !walletClient || anonymousMode}
                  onChange={(event) => setAccessRules({ ...accessRules, confidentialRules: event.target.checked })}
                  className="h-5 w-5"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-black/[0.07] bg-black/[0.02] p-4">
                <span>
                  <span className="block text-sm font-medium">Anonymous share mode</span>
                  <span className="text-xs text-black/45">A trusted relayer submits the on-chain upload and public owner lookups return zero.</span>
                </span>
                <input
                  type="checkbox"
                  checked={anonymousMode}
                  disabled={deployed}
                  onChange={(event) => setAnonymousMode(event.target.checked)}
                  className="h-5 w-5"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <Shield className="h-4 w-4" />
              Wave 5 Ready
            </div>
            <p className="text-xs text-emerald-700/80">
              Batch upload, CoFHE rule handles, expiry, previews, folders, webhooks, subscriptions, and batch download accounting are supported on-chain.
              {anonymousMode ? " Anonymous share mode is enabled for this batch." : ""}
            </p>
          </div>

          {cofheStep && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Encrypting access rules
              </div>
              <p className="text-xs text-blue-700/80">{cofheStep}</p>
            </div>
          )}

          {writeError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                Transaction failed
              </div>
              <p className="break-words text-xs text-red-600/85">{writeError.message}</p>
            </div>
          )}

          <button
            onClick={handleDeploy}
            disabled={deploying || isPending || isWaiting || readyFiles.length === 0 || readyFiles.length !== files.length}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111] px-5 py-4 text-sm font-medium text-white transition-colors hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {wrongNetwork ? (
              isSwitchingChain ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Switching...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Switch to Sepolia
                </>
              )
            ) : isPending || isWaiting || deploying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isPending ? "Confirm in wallet..." : "Writing on-chain..."}
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Register {readyFiles.length || files.length} file(s)
              </>
            )}
          </button>
        </aside>
      </div>

      {deployed && fileIds.length > 0 && (
        <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Batch registered on-chain</h2>
              <p className="text-sm text-black/50">Copy the secret links now. Encrypted file keys are included only in the URL fragment.</p>
            </div>
          </div>

          <div className="space-y-3">
            {fileIds.map((fileId, index) => {
              const file = readyFiles[index]
              const shareUrl = buildShareUrl(baseUrl, fileId.toString(), {
                fileName: file.name,
                mimeType: file.mimeType,
                ipfsHash: file.ipfsHash || "",
                encrypted: file.isEncrypted,
                encryptionKey: file.encryptionKey || undefined,
                encryptionIv: file.encryptionIv || undefined,
                anonymousUpload: anonymousMode,
              })

              return (
                <div key={fileId.toString()} className="flex flex-col gap-3 rounded-xl bg-black/[0.02] p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="truncate font-mono text-xs text-black/40">{shareUrl}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQrModalFile({ fileId, file })}
                      className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-3 py-2 text-xs hover:bg-white"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      QR
                    </button>
                    <button
                      onClick={() => copyToClipboard(shareUrl)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#111] px-3 py-2 text-xs text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {receipt && (
            <a
              href={`https://sepolia.etherscan.io/tx/${receipt.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex text-xs text-blue-600 hover:underline"
            >
              View transaction on Etherscan
            </a>
          )}
        </div>
      )}

      {qrModalFile && (
        <QRModal
          url={buildShareUrl(baseUrl, qrModalFile.fileId.toString(), {
            fileName: qrModalFile.file.name,
            mimeType: qrModalFile.file.mimeType,
            ipfsHash: qrModalFile.file.ipfsHash || "",
            encrypted: qrModalFile.file.isEncrypted,
            encryptionKey: qrModalFile.file.encryptionKey || undefined,
            encryptionIv: qrModalFile.file.encryptionIv || undefined,
            anonymousUpload: anonymousMode,
          })}
          fileName={qrModalFile.file.name}
          onClose={() => setQrModalFile(null)}
        />
      )}
    </div>
  )
}

function QRModal({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 text-center">
          <h3 className="text-lg font-medium">Scan to Access</h3>
          <p className="truncate text-sm text-black/50">{fileName}</p>
        </div>
        <div className="mb-4 flex items-center justify-center rounded-xl border border-black/[0.08] bg-white p-4">
          <QRCodeSVG value={url} size={190} level="H" />
        </div>
        <button onClick={onClose} className="w-full rounded-xl bg-[#111] py-3 text-sm text-white">
          Close
        </button>
      </div>
    </div>
  )
}
