"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  EyeOff,
  ExternalLink,
  FileText,
  Folder,
  FolderPlus,
  Hash,
  Loader2,
  Lock,
  MoveRight,
  QrCode,
  Search,
  Shield,
  Upload,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import {
  CONTRACT_ADDRESS,
  FHENIX_DROPBOX_ABI,
  formatDate,
  formatNativePrice,
  getRemainingDownloads,
  tupleToFileInfo,
  tupleToFileMetadata,
  tupleToFilePrivacy,
  tupleToFolderInfo,
  type FilePrivacy,
  type FileInfo,
  type FileMetadata,
  type FolderInfo,
} from "@/lib/fhenix"
import { decryptFile, formatFileSize, getFromIPFS } from "@/lib/ipfs"
import { buildShareUrl, getAllLocalFileSecrets, type LocalFileSecret } from "@/lib/share-links"

interface FileRecord {
  id: string
  info?: FileInfo
  metadata?: FileMetadata
  privacy?: FilePrivacy
  secret?: LocalFileSecret
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

async function downloadRecord(record: FileRecord) {
  if (!record.info?.ipfsHash) throw new Error(`File ${record.id} is missing an IPFS hash`)

  const name = record.secret?.fileName || record.metadata?.fileName || `file_${record.id}`
  const type = record.secret?.mimeType || record.metadata?.mimeType || "application/octet-stream"
  const blob = await getFromIPFS(record.info.ipfsHash)

  if (record.info.contentEncrypted) {
    if (!record.secret?.encryptionKey || !record.secret.encryptionIv) {
      throw new Error(`${name} is encrypted and this browser does not have its key`)
    }
    const decrypted = await decryptFile(await blob.arrayBuffer(), record.secret.encryptionKey, record.secret.encryptionIv)
    downloadBlob(new Blob([decrypted], { type }), name)
    return
  }

  downloadBlob(blob, name)
}

export default function FilesPage() {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [baseUrl, setBaseUrl] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [activeFolder, setActiveFolder] = useState("all")
  const [folderName, setFolderName] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [qrModalFile, setQrModalFile] = useState<FileRecord | null>(null)
  const [pendingBatch, setPendingBatch] = useState<{ ids: string[]; hash: `0x${string}` } | null>(null)

  const { writeContract, writeContractAsync, data: txHash, isPending: isWriting } = useWriteContract()
  const { isLoading: isWaiting, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    setMounted(true)
    setBaseUrl(window.location.origin)
  }, [])

  const { data: myFileIds, isLoading: filesLoading, refetch: refetchFiles } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getMyFiles",
    query: { enabled: mounted && isConnected && !!address },
  })

  const { data: myFolderIds, refetch: refetchFolders } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getMyFolders",
    query: { enabled: mounted && isConnected && !!address },
  })

  const { data: stats } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getStats",
    query: { enabled: mounted && isConnected },
  })

  const fileIds = useMemo(() => (Array.isArray(myFileIds) ? myFileIds.map((id) => id.toString()) : []), [myFileIds])
  const folderIds = useMemo(() => (Array.isArray(myFolderIds) ? myFolderIds.map((id) => id.toString()) : []), [myFolderIds])

  const fileContracts = useMemo(() => fileIds.flatMap((id) => [
    {
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "getFileInfo",
      args: [BigInt(id)],
    },
    {
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "getFileMetadata",
      args: [BigInt(id)],
    },
    {
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "getFilePrivacy",
      args: [BigInt(id)],
    },
  ]), [fileIds])

  const { data: fileReadResults, refetch: refetchFileReads } = useReadContracts({
    contracts: fileContracts,
    query: { enabled: mounted && fileContracts.length > 0 },
  })

  const folderContracts = useMemo(() => folderIds.map((id) => ({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "folders",
    args: [BigInt(id)],
  })), [folderIds])

  const { data: folderReadResults, refetch: refetchFolderReads } = useReadContracts({
    contracts: folderContracts,
    query: { enabled: mounted && folderContracts.length > 0 },
  })

  const localSecrets = useMemo(() => (address && mounted ? getAllLocalFileSecrets(address) : []), [address, mounted])

  const folders = useMemo(() => {
    const chainFolders = (folderReadResults || [])
      .map((result) => tupleToFolderInfo(result.result))
      .filter(Boolean) as FolderInfo[]

    return [
      { id: "0", name: "Root", color: "#111", fileCount: 0, isActive: true },
      ...chainFolders.map((folder) => ({
        id: folder.id.toString(),
        name: folder.name,
        color: folder.color || "#111",
        fileCount: Number(folder.fileCount),
        isActive: folder.isActive,
      })),
    ]
  }, [folderReadResults])

  const records = useMemo<FileRecord[]>(() => fileIds.map((id, index) => {
    const info = tupleToFileInfo(fileReadResults?.[index * 3]?.result)
    const metadata = tupleToFileMetadata(fileReadResults?.[index * 3 + 1]?.result)
    const privacy = tupleToFilePrivacy(fileReadResults?.[index * 3 + 2]?.result)
    const secret = localSecrets.find((item) => item.fileId === id)
    return { id, info, metadata, privacy, secret }
  }), [fileIds, fileReadResults, localSecrets])

  const filteredRecords = useMemo(() => records.filter((record) => {
    const name = record.secret?.fileName || record.metadata?.fileName || `File #${record.id}`
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.id.includes(searchQuery) ||
      record.info?.ipfsHash.toLowerCase().includes(searchQuery.toLowerCase())
    const folderId = record.metadata?.folderId?.toString() || "0"
    const matchesFolder = activeFolder === "all" || folderId === activeFolder
    return matchesSearch && matchesFolder
  }), [activeFolder, records, searchQuery])

  const statValues = Array.isArray(stats) ? stats : [0n, 0n, 0n, 0n]
  const totalFiles = Number(statValues[0] || 0n)
  const totalDownloads = Number(statValues[1] || 0n)
  const totalVolume = BigInt(statValues[2] || 0n)
  const myFileCount = Number(statValues[3] || 0n)

  useEffect(() => {
    if (!txSuccess) return
    void refetchFiles()
    void refetchFolders()
    void refetchFileReads()
    void refetchFolderReads()
  }, [refetchFileReads, refetchFiles, refetchFolderReads, refetchFolders, txSuccess])

  useEffect(() => {
    if (!txSuccess || !pendingBatch || txHash !== pendingBatch.hash) return

    const selected = records.filter((record) => pendingBatch.ids.includes(record.id))
    setPendingBatch(null)

    async function runDownloads() {
      try {
        for (const record of selected) {
          await downloadRecord(record)
        }
        setNotice(`Downloaded ${selected.length} file(s).`)
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Batch download failed")
      }
    }

    void runDownloads()
  }, [pendingBatch, records, txHash, txSuccess])

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
  }, [])

  const createFolder = () => {
    if (!folderName.trim()) return
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "createFolder",
      args: [folderName.trim(), "#111111"],
    })
    setFolderName("")
  }

  const moveFile = (fileId: string, folderId: string) => {
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "moveFileToFolder",
      args: [BigInt(fileId), BigInt(folderId)],
    })
  }

  const toggleAnonymous = (fileId: string, currentValue: boolean) => {
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "updateFilePrivacy",
      args: [BigInt(fileId), !currentValue],
    })
  }

  const runBatchDownload = async () => {
    const selected = records.filter((record) => selectedFiles.includes(record.id))
    const missingKey = selected.find((record) => record.info?.contentEncrypted && (!record.secret?.encryptionKey || !record.secret.encryptionIv))
    if (missingKey) {
      const name = missingKey.secret?.fileName || missingKey.metadata?.fileName || `File #${missingKey.id}`
      setNotice(`${name} is encrypted and this browser does not have its key.`)
      return
    }

    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: FHENIX_DROPBOX_ABI,
        functionName: "batchDownloadFiles",
        args: [selectedFiles.map((id) => BigInt(id))],
      })
      setPendingBatch({ ids: selectedFiles, hash })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Batch download transaction failed")
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedFiles((current) => (
      current.includes(id) ? current.filter((fileId) => fileId !== id) : [...current, id]
    ))
  }

  if (!mounted) {
    return (
      <div className="p-6">
        <div className="h-28 rounded-2xl bg-black/[0.05] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#111]">My Files</h1>
          <p className="mt-1 text-sm text-black/50">Organize, share, and batch download your on-chain files.</p>
        </div>
        <Link href="/upload" className="inline-flex items-center gap-2 rounded-xl bg-[#111] px-5 py-3 text-sm font-medium text-white hover:bg-[#222]">
          <Upload className="h-4 w-4" />
          Upload Files
        </Link>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4" />
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Folder} label="My Files" value={filesLoading ? "..." : myFileCount.toString()} tone="blue" />
        <StatCard icon={Download} label="Downloads" value={totalDownloads.toString()} tone="emerald" />
        <StatCard icon={Shield} label="Volume" value={`${formatNativePrice(totalVolume)} ETH`} tone="amber" />
        <StatCard icon={Hash} label="Platform Files" value={totalFiles.toString()} tone="purple" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-black/[0.07] bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-medium">
              <FolderPlus className="h-4 w-4" />
              Folders
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setActiveFolder("all")}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${activeFolder === "all" ? "bg-[#111] text-white" : "hover:bg-black/[0.04]"}`}
              >
                All files
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                    activeFolder === folder.id ? "bg-[#111] text-white" : "hover:bg-black/[0.04]"
                  }`}
                >
                  <span className="truncate">{folder.name}</span>
                  {folder.id !== "0" && <span className="text-xs opacity-60">{folder.fileCount}</span>}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="New folder"
                className="min-w-0 flex-1 rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-sm"
              />
              <button
                onClick={createFolder}
                disabled={isWriting || isWaiting}
                className="rounded-lg bg-[#111] px-3 text-white disabled:opacity-50"
              >
                {isWriting || isWaiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.07] bg-white p-4 text-xs text-black/45">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-black/70">
              <Shield className="h-4 w-4" />
              Wave 4 Tools
            </div>
            Folder moves and webhook endpoints are recorded on-chain. Secret file keys stay in this browser and in copied share links.
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.07] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search files, IDs, or IPFS hashes"
                className="w-full rounded-xl border border-black/[0.08] bg-black/[0.02] py-3 pl-10 pr-4 text-sm"
              />
            </div>
            <button
              onClick={runBatchDownload}
              disabled={selectedFiles.length === 0 || isWriting || isWaiting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {isWriting || isWaiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Batch Download ({selectedFiles.length})
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
            {filesLoading ? (
              <div className="p-20 text-center">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-black/30" />
                <div className="text-sm text-black/50">Loading from blockchain...</div>
              </div>
            ) : records.length === 0 ? (
              <div className="p-20 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-black/[0.04]">
                  <FileText className="h-10 w-10 text-black/25" />
                </div>
                <h3 className="mb-2 text-lg font-medium">No files uploaded yet</h3>
                <p className="mx-auto mb-6 max-w-sm text-sm text-black/45">Upload your first encrypted file and the on-chain metadata will show here.</p>
                <Link href="/upload" className="inline-flex items-center gap-2 rounded-xl bg-[#111] px-5 py-3 text-sm text-white">
                  <Upload className="h-4 w-4" />
                  Upload Your First File
                </Link>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-sm text-black/45">No files match this view.</div>
            ) : (
              <div className="divide-y divide-black/[0.05]">
                {filteredRecords.map((record) => {
                  const name = record.secret?.fileName || record.metadata?.fileName || `File #${record.id}`
                  const folderId = record.metadata?.folderId?.toString() || "0"
                  const shareUrl = buildShareUrl(baseUrl, record.id, {
                    fileName: name,
                    mimeType: record.secret?.mimeType || record.metadata?.mimeType || "",
                    ipfsHash: record.info?.ipfsHash || "",
                    encrypted: record.info?.contentEncrypted || false,
                    encryptionKey: record.secret?.encryptionKey,
                    encryptionIv: record.secret?.encryptionIv,
                    anonymousUpload: record.privacy?.anonymousUpload ?? record.secret?.anonymousUpload,
                  })
                  const remaining = record.info ? getRemainingDownloads(record.info.maxDownloads, record.info.downloadCount) : 0
                  const isAnonymous = record.privacy?.anonymousUpload ?? record.secret?.anonymousUpload ?? false

                  return (
                    <div key={record.id} className="p-5 hover:bg-black/[0.015]">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(record.id)}
                            onChange={() => toggleSelected(record.id)}
                            className="h-4 w-4"
                          />
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                            <FileText className="h-6 w-6 text-black/40" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate font-medium">{name}</h3>
                              {record.info?.contentEncrypted && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                                  <Lock className="h-3 w-3" />
                                  Encrypted
                                </span>
                              )}
                              {isAnonymous && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                                  <EyeOff className="h-3 w-3" />
                                  Anonymous
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/40">
                              <span>ID: {record.id}</span>
                              {record.metadata?.fileSize ? <span>{formatFileSize(Number(record.metadata.fileSize))}</span> : null}
                              <span>{remaining === Infinity ? "Unlimited" : `${remaining} left`}</span>
                              <span>{record.metadata?.expiresAt ? formatDate(record.metadata.expiresAt) : "No expiry"}</span>
                              {record.info?.price ? <span>{formatNativePrice(record.info.price)} ETH</span> : <span>Free</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                          <select
                            value={folderId}
                            onChange={(event) => moveFile(record.id, event.target.value)}
                            className="rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-xs"
                            title="Move to folder"
                          >
                            {folders.map((folder) => (
                              <option key={folder.id} value={folder.id}>{folder.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => toggleAnonymous(record.id, isAnonymous)}
                            className="rounded-lg border border-black/[0.08] p-2 hover:bg-black/[0.04]"
                            title={isAnonymous ? "Show owner in contract lookups" : "Hide owner in public contract lookups"}
                          >
                            <EyeOff className={`h-4 w-4 ${isAnonymous ? "text-violet-600" : "text-black/45"}`} />
                          </button>
                          <button
                            onClick={() => setQrModalFile(record)}
                            className="rounded-lg border border-black/[0.08] p-2 hover:bg-black/[0.04]"
                            title="QR code"
                          >
                            <QrCode className="h-4 w-4 text-black/55" />
                          </button>
                          <button
                            onClick={() => copyToClipboard(shareUrl, record.id)}
                            className="rounded-lg border border-black/[0.08] p-2 hover:bg-black/[0.04]"
                            title="Copy secret link"
                          >
                            {copiedId === record.id ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-black/55" />}
                          </button>
                          <Link href={`/share/${record.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#111] px-3 py-2 text-xs text-white">
                            <MoveRight className="h-3.5 w-3.5" />
                            Open
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex items-center justify-between text-xs text-black/40">
        <span className="inline-flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Protected by FhenixDropBox on Ethereum Sepolia
        </span>
        <a
          href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-black"
        >
          View Contract
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {qrModalFile && (
        <QRModal
          record={qrModalFile}
          url={buildShareUrl(baseUrl, qrModalFile.id, {
            fileName: qrModalFile.secret?.fileName || qrModalFile.metadata?.fileName || `File #${qrModalFile.id}`,
            mimeType: qrModalFile.secret?.mimeType || qrModalFile.metadata?.mimeType || "",
            ipfsHash: qrModalFile.info?.ipfsHash || "",
            encrypted: qrModalFile.info?.contentEncrypted || false,
            encryptionKey: qrModalFile.secret?.encryptionKey,
            encryptionIv: qrModalFile.secret?.encryptionIv,
            anonymousUpload: qrModalFile.privacy?.anonymousUpload ?? qrModalFile.secret?.anonymousUpload,
          })}
          onClose={() => setQrModalFile(null)}
        />
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "blue" | "emerald" | "amber" | "purple" }) {
  const tones = {
    blue: "from-blue-50 to-blue-100/50 border-blue-200/50 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200/50 text-emerald-700",
    amber: "from-amber-50 to-amber-100/50 border-amber-200/50 text-amber-700",
    purple: "from-purple-50 to-purple-100/50 border-purple-200/50 text-purple-700",
  }

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${tones[tone]}`}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/55">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs opacity-70">{label}</div>
    </div>
  )
}

function QRModal({ record, url, onClose }: { record: FileRecord; url: string; onClose: () => void }) {
  const name = record.secret?.fileName || record.metadata?.fileName || `File #${record.id}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.04]">
            <QrCode className="h-7 w-7 text-black/40" />
          </div>
          <h3 className="text-lg font-medium">Scan to Access</h3>
          <p className="mt-1 truncate text-sm text-black/50">{name}</p>
        </div>
        <div className="mb-5 flex items-center justify-center rounded-xl border border-black/[0.08] p-4">
          <QRCodeSVG value={url} size={180} level="H" />
        </div>
        <button onClick={onClose} className="w-full rounded-xl bg-[#111] py-3 text-sm text-white">
          Close
        </button>
      </div>
    </div>
  )
}
