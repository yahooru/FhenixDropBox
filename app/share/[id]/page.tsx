"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAccount, useConnect, useReadContract, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { sepolia } from "wagmi/chains"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  FileText,
  Key,
  Loader2,
  Lock,
  Shield,
  Wallet,
  XCircle,
} from "lucide-react"
import {
  CONTRACT_ADDRESS,
  FHENIX_DROPBOX_ABI,
  ZERO_BYTES32,
  formatDate,
  formatNativePrice,
  getRemainingDownloads,
  hashPassword,
  isExpired,
  tupleToFileInfo,
  tupleToFileMetadata,
  tupleToFilePrivacy,
  tupleToSubscriptionPlanInfo,
  type FilePrivacy,
  type FileInfo,
  type FileMetadata,
  type SubscriptionPlanInfo,
} from "@/lib/fhenix"
import { decryptFile, formatFileSize, getFromIPFS, getIPFSUrl } from "@/lib/ipfs"
import { parseShareSecret, type ShareSecret } from "@/lib/share-links"

interface AccessInfo {
  isAuthorized: boolean
  hasDownloaded: boolean
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function PreviewPanel({ metadata }: { metadata?: FileMetadata }) {
  if (!metadata?.previewEnabled || !metadata.previewHash) {
    return (
      <div className="flex h-64 flex-col items-center justify-center bg-gradient-to-br from-[#f5f4f0] to-[#e8e6e0] text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <FileText className="h-10 w-10 text-black/35" />
        </div>
        <div className="text-sm font-medium text-black/65">No public preview</div>
        <div className="mt-1 text-xs text-black/40">Access is required before downloading.</div>
      </div>
    )
  }

  const previewUrl = getIPFSUrl(metadata.previewHash)
  const isImage = metadata.mimeType.startsWith("image/")

  return (
    <div className="bg-black/[0.03]">
      {isImage ? (
        <img src={previewUrl} alt={metadata.fileName || "File preview"} className="h-80 w-full object-contain" />
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-black/45">Preview available after access.</div>
      )}
    </div>
  )
}

function ShareContent({ fileId }: { fileId: number }) {
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()
  const [mounted, setMounted] = useState(false)
  const [accessCode, setAccessCode] = useState("")
  const [showAccessCode, setShowAccessCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [processedDownloadTxHash, setProcessedDownloadTxHash] = useState<`0x${string}` | null>(null)
  const [shareSecret, setShareSecret] = useState<ShareSecret>({})
  const [anonymousHint, setAnonymousHint] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMounted(true)
    setShareSecret(parseShareSecret(window.location.hash))
    setAnonymousHint(new URLSearchParams(window.location.search).get("anon") === "1")
  }, [])

  const { data: rawFileInfo, isLoading: fileLoading, isError: fileError } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getFileInfo",
    args: [BigInt(fileId)],
    query: { enabled: mounted && fileId >= 0 },
  })

  const { data: rawMetadata } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getFileMetadata",
    args: [BigInt(fileId)],
    query: { enabled: mounted && fileId >= 0 },
  })

  const { data: rawAccessInfo, refetch: refetchAccess } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getAccessInfo",
    args: [BigInt(fileId)],
    query: { enabled: mounted && !!address && fileId >= 0 },
  }) as { data: readonly [boolean, boolean] | AccessInfo | undefined; refetch: () => Promise<unknown> }

  const { data: fileOwner } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getFileOwner",
    args: [BigInt(fileId)],
    query: { enabled: mounted && fileId >= 0 },
  }) as { data: `0x${string}` | undefined }

  const { data: rawPrivacy } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getFilePrivacy",
    args: [BigInt(fileId)],
    query: { enabled: mounted && fileId >= 0 },
  })

  const { data: rawPlanIds } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getFileSubscriptionPlans",
    args: [BigInt(fileId)],
    query: { enabled: mounted && fileId >= 0 },
  })

  const planIds = useMemo(() => (Array.isArray(rawPlanIds) ? rawPlanIds.map((id) => id.toString()) : []), [rawPlanIds])
  const planContracts = useMemo(() => planIds.map((id) => ({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "subscriptionPlans",
    args: [BigInt(id)],
  })), [planIds])
  const { data: rawPlans } = useReadContracts({
    contracts: planContracts,
    query: { enabled: mounted && planContracts.length > 0 },
  })

  const { writeContract: requestAccess, data: accessTxHash, isPending: isRequestingAccess, error: accessWriteError } = useWriteContract()
  const { isLoading: isWaitingAccess, isSuccess: accessSuccess } = useWaitForTransactionReceipt({ hash: accessTxHash })

  const { writeContract: subscribe, data: subscribeTxHash, isPending: isSubscribing, error: subscribeWriteError } = useWriteContract()
  const { isLoading: isWaitingSubscribe, isSuccess: subscribeSuccess } = useWaitForTransactionReceipt({ hash: subscribeTxHash })

  const { writeContract: recordDownload, data: downloadTxHash, isPending: isDownloadingTx, error: downloadWriteError } = useWriteContract()
  const { isLoading: isWaitingDownload, isSuccess: downloadSuccess } = useWaitForTransactionReceipt({ hash: downloadTxHash })

  const fileInfo = useMemo<FileInfo | undefined>(() => tupleToFileInfo(rawFileInfo), [rawFileInfo])
  const metadata = useMemo<FileMetadata | undefined>(() => tupleToFileMetadata(rawMetadata), [rawMetadata])
  const filePrivacy = useMemo<FilePrivacy | undefined>(() => tupleToFilePrivacy(rawPrivacy), [rawPrivacy])
  const accessInfo = useMemo<AccessInfo | undefined>(() => {
    if (!rawAccessInfo) return undefined
    if (Array.isArray(rawAccessInfo)) {
      return { isAuthorized: Boolean(rawAccessInfo[0]), hasDownloaded: Boolean(rawAccessInfo[1]) }
    }
    return rawAccessInfo as AccessInfo
  }, [rawAccessInfo])
  const subscriptionPlans = useMemo(() => (
    (rawPlans || [])
      .map((result) => tupleToSubscriptionPlanInfo(result.result))
      .filter((plan): plan is SubscriptionPlanInfo => !!plan && plan.isActive)
  ), [rawPlans])
  const primarySubscriptionPlan = subscriptionPlans[0]

  const fileName = shareSecret.name || metadata?.fileName || `file_${fileId}`
  const mimeType = shareSecret.type || metadata?.mimeType || "application/octet-stream"
  const remainingDownloads = fileInfo ? getRemainingDownloads(fileInfo.maxDownloads, fileInfo.downloadCount) : 0
  const isOwner = !!fileOwner && !!address && fileOwner.toLowerCase() === address.toLowerCase()
  const alreadyAuthorized = isOwner || (accessInfo?.isAuthorized ?? false)
  const alreadyDownloaded = accessInfo?.hasDownloaded ?? false
  const expired = metadata ? isExpired(metadata.expiresAt) : false
  const canRequestAccess = !!fileInfo && !alreadyAuthorized && !expired
  const canDownload = alreadyAuthorized && !alreadyDownloaded && !expired
  const canRenewSubscription = !!primarySubscriptionPlan && alreadyAuthorized && alreadyDownloaded && !isOwner && !expired
  const hasSecret = !fileInfo?.contentEncrypted || (!!shareSecret.key && !!shareSecret.iv)
  const isAnonymousShare = filePrivacy?.anonymousUpload || shareSecret.anonymous || anonymousHint
  const accessCodeRequired = !!fileInfo?.hasPassword
  const accessCodeMissing = accessCodeRequired && accessCode.trim().length === 0
  const wrongNetwork = isConnected && walletChainId !== sepolia.id
  const accessSubmitDisabled = isRequestingAccess || isWaitingAccess || isSwitchingChain || accessCodeMissing
  const subscriptionSubmitDisabled = !isConnected || isSubscribing || isWaitingSubscribe || isSwitchingChain || accessCodeMissing

  useEffect(() => {
    if (accessSuccess || subscribeSuccess) {
      setError(null)
      if (subscribeSuccess) {
        setDownloaded(false)
      }
      void refetchAccess()
    }
  }, [accessSuccess, refetchAccess, subscribeSuccess])

  useEffect(() => {
    const writeError = accessWriteError || subscribeWriteError || downloadWriteError
    if (!writeError) return
    setError(writeError.message.includes("does not match the target chain")
      ? `Switch your wallet to ${sepolia.name} before submitting this transaction.`
      : writeError.message || "Transaction was not submitted.")
    setDownloading(false)
  }, [accessWriteError, downloadWriteError, subscribeWriteError])

  const ensureSepolia = async () => {
    if (!wrongNetwork) return true
    setError(`Switching wallet to ${sepolia.name}...`)
    try {
      await switchChainAsync({ chainId: sepolia.id })
      setError(`Wallet switched to ${sepolia.name}. Click the action again to submit on-chain.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : `Please switch your wallet to ${sepolia.name}.`)
    }
    setDownloading(false)
    return false
  }

  useEffect(() => {
    if (!downloadSuccess || !downloadTxHash || !fileInfo?.ipfsHash || processedDownloadTxHash === downloadTxHash) return
    const currentFile = fileInfo
    const currentDownloadTxHash = downloadTxHash

    async function fetchAndDownload() {
      try {
        const blob = await getFromIPFS(currentFile.ipfsHash)

        if (currentFile.contentEncrypted) {
          if (!shareSecret.key || !shareSecret.iv) {
            throw new Error("This encrypted file needs the full secret link with key and IV.")
          }
          const decrypted = await decryptFile(await blob.arrayBuffer(), shareSecret.key, shareSecret.iv)
          downloadBlob(new Blob([decrypted], { type: mimeType }), fileName)
        } else {
          downloadBlob(blob, fileName)
        }

        setDownloaded(true)
        setProcessedDownloadTxHash(currentDownloadTxHash)
        setError(null)
        void refetchAccess()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Download failed")
      } finally {
        setDownloading(false)
      }
    }

    void fetchAndDownload()
  }, [downloadSuccess, downloadTxHash, fileInfo, fileName, mimeType, processedDownloadTxHash, refetchAccess, shareSecret.iv, shareSecret.key])

  const handleRequestAccess = async () => {
    if (!fileInfo || !isConnected) return

    setError(null)
    if (fileInfo.hasPassword && accessCode.trim().length === 0) {
      setError("Enter the access code before submitting this transaction.")
      return
    }
    if (!(await ensureSepolia())) return
    const accessCodeHash = accessCode ? hashPassword(accessCode) : ZERO_BYTES32

    requestAccess({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "requestAccess",
      args: [BigInt(fileId), accessCodeHash],
      value: fileInfo.price,
      chainId: sepolia.id,
    })
  }

  const handleSubscribe = async () => {
    if (!primarySubscriptionPlan || !isConnected) return
    setError(null)
    if (fileInfo?.hasPassword && accessCode.trim().length === 0) {
      setError("Enter the access code before subscribing.")
      return
    }
    if (!(await ensureSepolia())) return
    subscribe({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "subscribeToPlan",
      args: [primarySubscriptionPlan.id, 1n, accessCode ? hashPassword(accessCode) : ZERO_BYTES32],
      value: primarySubscriptionPlan.pricePerPeriod,
      chainId: sepolia.id,
    })
  }

  const handleDownload = async () => {
    if (!fileInfo?.ipfsHash) return
    if (!hasSecret) {
      setError("Missing decryption key. Ask the sender for the full secret link.")
      return
    }
    if (!(await ensureSepolia())) return

    setDownloading(true)
    setError(null)
    recordDownload({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "downloadFile",
      args: [BigInt(fileId)],
      chainId: sepolia.id,
    })
  }

  const copyCurrentLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F4F0]">
        <Loader2 className="h-8 w-8 animate-spin text-black/30" />
      </div>
    )
  }

  if ((!fileLoading && !fileInfo && fileId >= 0) || fileError) {
    return (
      <div className="min-h-screen bg-[#F5F4F0]">
        <ShareHeader />
        <main className="px-6 pt-32 text-center">
          <XCircle className="mx-auto mb-4 h-16 w-16 text-black/20" />
          <h1 className="mb-2 text-xl font-medium">File Not Found</h1>
          <p className="text-sm text-black/50">This file may have been removed or the link is invalid.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <ShareHeader />
      <main className="px-6 pb-16 pt-24">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
          <section className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
            <PreviewPanel metadata={metadata} />
            <div className="border-t border-black/[0.06] p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-xl font-medium">{fileLoading ? "Loading..." : fileName}</h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-black/45">
                    <span>ID #{fileId}</span>
                    {metadata?.fileSize ? <span>{formatFileSize(Number(metadata.fileSize))}</span> : null}
                    {metadata?.expiresAt ? <span>Expires {formatDate(metadata.expiresAt)}</span> : <span>No expiry</span>}
                    {isAnonymousShare && <span>Anonymous sender</span>}
                  </div>
                </div>
                <button
                  onClick={copyCurrentLink}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2 text-xs hover:bg-black/[0.03]"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>

            <div className="border-t border-black/[0.06] bg-black/[0.02] px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Shield className="h-4 w-4" />
                  Protected access, on-chain audit trail
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-black/45">
                  <span>{remainingDownloads === Infinity ? "Unlimited downloads" : `${remainingDownloads} downloads left`}</span>
                  {fileInfo?.contentEncrypted && <span>AES-256 encrypted</span>}
                  {metadata?.previewEnabled && <span>Preview enabled</span>}
                  {isAnonymousShare && <span>Owner hidden</span>}
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-black/[0.07] bg-white p-5">
              {!fileInfo ? (
                <div className="rounded-xl bg-black/[0.02] p-4 text-sm text-black/50">
                  <div className="mb-1 flex items-center gap-2 font-medium text-black/65">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading access details
                  </div>
                  Reading this file from the Sepolia contract.
                </div>
              ) : expired ? (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Link expired
                  </div>
                  This file is no longer available.
                </div>
              ) : canRequestAccess ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-medium">Request Access</h2>
                    <p className="mt-1 text-xs text-black/45">Payment and access checks are handled on Sepolia.</p>
                  </div>

                  {fileInfo && fileInfo.price > 0n && (
                    <div className="flex items-center justify-between rounded-xl bg-black/[0.02] p-4">
                      <span className="flex items-center gap-2 text-sm text-black/55">
                        <DollarSign className="h-4 w-4" />
                        Access price
                      </span>
                      <span className="font-medium">{formatNativePrice(fileInfo.price)} ETH</span>
                    </div>
                  )}

                  {fileInfo?.hasPassword && (
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Key className="h-4 w-4 text-black/40" />
                        Access Code
                      </label>
                      <div className="relative">
                        <input
                          type={showAccessCode ? "text" : "password"}
                          value={accessCode}
                          onChange={(event) => setAccessCode(event.target.value)}
                          placeholder="Enter PIN"
                          className="w-full rounded-xl border border-black/[0.1] bg-black/[0.02] px-4 py-3 pr-11 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAccessCode((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-black/35 hover:text-black"
                        >
                          {showAccessCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {primarySubscriptionPlan && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-medium text-blue-800">
                          <CreditCard className="h-4 w-4" />
                          Subscription
                        </span>
                        <span className="text-sm font-medium text-blue-800">
                          {formatNativePrice(primarySubscriptionPlan.pricePerPeriod)} ETH
                        </span>
                      </div>
                      <button
                        onClick={handleSubscribe}
                        disabled={subscriptionSubmitDisabled}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {isSubscribing || isWaitingSubscribe ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        Subscribe for access
                      </button>
                    </div>
                  )}

                  {!isConnected ? (
                    <button
                      onClick={() => connect({ connector: connectors[0] })}
                      disabled={isConnecting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111] py-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                      Connect Wallet
                    </button>
                  ) : (
                    <button
                      onClick={handleRequestAccess}
                      disabled={accessSubmitDisabled}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111] py-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {isRequestingAccess || isWaitingAccess ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {isRequestingAccess ? "Confirm in wallet..." : "Confirming..."}
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          {fileInfo && fileInfo.price > 0n ? "Pay and unlock" : "Unlock file"}
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-50 p-4 text-emerald-700">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-5 w-5" />
                      Access verified
                    </div>
                    <p className="mt-1 text-xs text-emerald-700/75">Your wallet is authorized for this file.</p>
                  </div>

                  {!hasSecret && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                      Missing the secret fragment. Ask the sender for the full link to decrypt this file.
                    </div>
                  )}

                  {canDownload && (
                    <button
                      onClick={handleDownload}
                      disabled={downloading || isDownloadingTx || isWaitingDownload || isSwitchingChain}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111] py-4 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {downloading || isDownloadingTx || isWaitingDownload || isSwitchingChain ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Download file
                        </>
                      )}
                    </button>
                  )}

                  {(downloaded || alreadyDownloaded) && (
                    <div className="rounded-xl bg-black/[0.02] p-4 text-center text-sm text-black/50">
                      <CheckCircle className="mx-auto mb-2 h-6 w-6 text-black/30" />
                      {downloaded ? "Download complete" : "This wallet already downloaded the file"}
                    </div>
                  )}

                  {canRenewSubscription && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-medium text-blue-800">
                          <CreditCard className="h-4 w-4" />
                          Renew subscription
                        </span>
                        <span className="text-sm font-medium text-blue-800">
                          {formatNativePrice(primarySubscriptionPlan.pricePerPeriod)} ETH
                        </span>
                      </div>

                      {fileInfo?.hasPassword && (
                        <div className="mb-3">
                          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-900">
                            <Key className="h-4 w-4 text-blue-800/60" />
                            Access Code
                          </label>
                          <div className="relative">
                            <input
                              type={showAccessCode ? "text" : "password"}
                              value={accessCode}
                              onChange={(event) => setAccessCode(event.target.value)}
                              placeholder="Enter PIN"
                              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 pr-11 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAccessCode((value) => !value)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-blue-800/50 hover:text-blue-900"
                            >
                              {showAccessCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleSubscribe}
                        disabled={subscriptionSubmitDisabled}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {isSubscribing || isWaitingSubscribe ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        Renew download access
                      </button>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-black/[0.07] bg-white p-5 text-xs text-black/45">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-black/70">
                <Shield className="h-4 w-4" />
                Privacy Notes
              </div>
              {isAnonymousShare
                ? "This share is in anonymous mode: public owner lookups return a zero address. File keys stay off-chain in the URL fragment while access and download accounting remain on Sepolia."
                : "File content keys are kept off-chain in the URL fragment. Access grants, expiry, folders, and download accounting are recorded on-chain."}
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

function ShareHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.08] bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#111]" />
          <span className="text-sm font-medium">FhenixDropBox</span>
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 text-xs text-black/50 hover:text-black">
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
      </div>
    </header>
  )
}

export default function SharePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params)
  const fileIdFromParams = Number.parseInt(params.id, 10)
  const fileId = Number.isNaN(fileIdFromParams) || fileIdFromParams < 0 ? -1 : fileIdFromParams

  if (fileId < 0) {
    return (
      <div className="min-h-screen bg-[#F5F4F0]">
        <ShareHeader />
        <main className="px-6 pt-32 text-center">
          <XCircle className="mx-auto mb-4 h-16 w-16 text-black/20" />
          <h1 className="mb-2 text-xl font-medium">Invalid Link</h1>
          <p className="text-sm text-black/50">This share link is not valid.</p>
        </main>
      </div>
    )
  }

  return <ShareContent fileId={fileId} />
}
