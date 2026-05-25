"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAccount, useConnect, useReadContract, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { sepolia } from "wagmi/chains"
import {
  AlertCircle,
  ArrowLeft,
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
  Wallet,
  Users,
  CreditCard,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import {
  CONTRACT_ADDRESS,
  FHENIX_DROPBOX_ABI,
  TEAM_ROLES,
  formatDate,
  formatNativePrice,
  getRemainingDownloads,
  parseNativePrice,
  tupleToConfidentialRuleHandles,
  tupleToFileInfo,
  tupleToFileMetadata,
  tupleToFilePrivacy,
  tupleToFolderInfo,
  tupleToTeamInfo,
  type ConfidentialRuleHandles,
  type FilePrivacy,
  type FileInfo,
  type FileMetadata,
  type FolderInfo,
  type TeamInfo,
} from "@/lib/fhenix"
import { decryptFile, formatFileSize, getFromIPFS } from "@/lib/ipfs"
import { copyTextToClipboard } from "@/lib/clipboard"
import { buildShareUrl, getAllLocalFileSecrets, type LocalFileSecret } from "@/lib/share-links"

interface FileRecord {
  id: string
  owned: boolean
  info?: FileInfo
  metadata?: FileMetadata
  privacy?: FilePrivacy
  confidential?: ConfidentialRuleHandles
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

function hasUsableShareLink(record: FileRecord) {
  return !record.info?.contentEncrypted || !!(record.secret?.encryptionKey && record.secret.encryptionIv)
}

export default function FilesPage() {
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()
  const [mounted, setMounted] = useState(false)
  const [baseUrl, setBaseUrl] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [activeFolder, setActiveFolder] = useState("all")
  const [folderName, setFolderName] = useState("")
  const [teamName, setTeamName] = useState("")
  const [teamMember, setTeamMember] = useState("")
  const [teamShareId, setTeamShareId] = useState("")
  const [planDrafts, setPlanDrafts] = useState<Record<string, { price: string; periodDays: string }>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [qrModalFile, setQrModalFile] = useState<FileRecord | null>(null)
  const [pendingBatch, setPendingBatch] = useState<{ ids: string[]; hash: `0x${string}` } | null>(null)

  const { writeContract, writeContractAsync, data: txHash, isPending: isWriting, error: writeError } = useWriteContract()
  const { isLoading: isWaiting, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash, chainId: sepolia.id })
  const wrongNetwork = isConnected && walletChainId !== sepolia.id

  useEffect(() => {
    setMounted(true)
    setBaseUrl(window.location.origin)
  }, [])

  const { data: myFileIds, isLoading: filesLoading, refetch: refetchFiles } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getMyFiles",
    account: address,
    chainId: sepolia.id,
    query: { enabled: mounted && isConnected && !!address },
  })

  const { data: myFolderIds, refetch: refetchFolders } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getMyFolders",
    account: address,
    chainId: sepolia.id,
    query: { enabled: mounted && isConnected && !!address },
  })

  const { data: visibleFolderIds, refetch: refetchVisibleFolders } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getVisibleFolders",
    account: address,
    chainId: sepolia.id,
    query: { enabled: mounted && isConnected && !!address },
  })

  const { data: myTeamIds, refetch: refetchTeams } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getMyTeams",
    account: address,
    chainId: sepolia.id,
    query: { enabled: mounted && isConnected && !!address },
  })

  const { data: stats } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getStats",
    account: address,
    chainId: sepolia.id,
    query: { enabled: mounted && isConnected && !!address },
  })

  const { data: activeFolderFileIds, refetch: refetchActiveFolderFiles } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "getVisibleFilesByFolder",
    args: [BigInt(activeFolder === "all" ? "0" : activeFolder)],
    account: address,
    chainId: sepolia.id,
    query: { enabled: mounted && isConnected && !!address && activeFolder !== "all" },
  })

  const localSecrets = useMemo(() => (address && mounted ? getAllLocalFileSecrets(address) : []), [address, mounted])
  const ownFileIds = useMemo(() => (Array.isArray(myFileIds) ? myFileIds.map((id) => id.toString()) : []), [myFileIds])
  const localSecretFileIds = useMemo(() => localSecrets.map((file) => file.fileId), [localSecrets])
  const visibleActiveFileIds = useMemo(() => (Array.isArray(activeFolderFileIds) ? activeFolderFileIds.map((id) => id.toString()) : []), [activeFolderFileIds])
  const visibleFolderFileContracts = useMemo(() => (
    activeFolder === "all" && Array.isArray(visibleFolderIds)
      ? visibleFolderIds.map((id) => ({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: FHENIX_DROPBOX_ABI,
        functionName: "getVisibleFilesByFolder",
        args: [BigInt(id)],
        account: address,
        chainId: sepolia.id,
      }))
      : []
  ), [activeFolder, address, visibleFolderIds])
  const { data: visibleFolderFileResults, refetch: refetchVisibleFolderFileReads } = useReadContracts({
    contracts: visibleFolderFileContracts,
    query: { enabled: mounted && isConnected && !!address && visibleFolderFileContracts.length > 0 },
  })
  const allVisibleFileIds = useMemo(() => {
    if (activeFolder !== "all") return visibleActiveFileIds
    return (visibleFolderFileResults || []).flatMap((result) => (
      Array.isArray(result.result) ? result.result.map((id) => id.toString()) : []
    ))
  }, [activeFolder, visibleActiveFileIds, visibleFolderFileResults])
  const fileIds = useMemo(() => (
    Array.from(new Set([...ownFileIds, ...allVisibleFileIds, ...localSecretFileIds]))
  ), [allVisibleFileIds, localSecretFileIds, ownFileIds])
  const folderIds = useMemo(() => {
    const own = Array.isArray(myFolderIds) ? myFolderIds.map((id) => id.toString()) : []
    const visible = Array.isArray(visibleFolderIds) ? visibleFolderIds.map((id) => id.toString()) : []
    return Array.from(new Set([...own, ...visible]))
  }, [myFolderIds, visibleFolderIds])
  const teamIds = useMemo(() => (Array.isArray(myTeamIds) ? myTeamIds.map((id) => id.toString()) : []), [myTeamIds])

  const fileContracts = useMemo(() => fileIds.flatMap((id) => [
    {
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "getFileInfo",
      args: [BigInt(id)],
      chainId: sepolia.id,
    },
    {
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "getFileMetadata",
      args: [BigInt(id)],
      chainId: sepolia.id,
    },
    {
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "getFilePrivacy",
      args: [BigInt(id)],
      chainId: sepolia.id,
    },
    {
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "getConfidentialRuleHandles",
      args: [BigInt(id)],
      chainId: sepolia.id,
    },
  ]), [fileIds])

  const { data: fileReadResults, refetch: refetchFileReads } = useReadContracts({
    contracts: fileContracts,
    query: { enabled: mounted && isConnected && !!address && fileContracts.length > 0 },
  })

  const folderContracts = useMemo(() => folderIds.map((id) => ({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "folders",
    args: [BigInt(id)],
    chainId: sepolia.id,
  })), [folderIds])

  const { data: folderReadResults, refetch: refetchFolderReads } = useReadContracts({
    contracts: folderContracts,
    query: { enabled: mounted && isConnected && !!address && folderContracts.length > 0 },
  })

  const teamContracts = useMemo(() => teamIds.map((id) => ({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: "teams",
    args: [BigInt(id)],
    chainId: sepolia.id,
  })), [teamIds])

  const { data: teamReadResults, refetch: refetchTeamReads } = useReadContracts({
    contracts: teamContracts,
    query: { enabled: mounted && isConnected && !!address && teamContracts.length > 0 },
  })

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

  const teams = useMemo(() => (
    (teamReadResults || [])
      .map((result) => tupleToTeamInfo(result.result))
      .filter(Boolean) as TeamInfo[]
  ), [teamReadResults])

  const records = useMemo<FileRecord[]>(() => fileIds.map((id, index) => {
    const baseIndex = index * 4
    const info = tupleToFileInfo(fileReadResults?.[baseIndex]?.result)
    const metadata = tupleToFileMetadata(fileReadResults?.[baseIndex + 1]?.result)
    const privacy = tupleToFilePrivacy(fileReadResults?.[baseIndex + 2]?.result)
    const confidential = tupleToConfidentialRuleHandles(fileReadResults?.[baseIndex + 3]?.result)
    const secret = localSecrets.find((item) => item.fileId === id)
    return { id, owned: ownFileIds.includes(id) || localSecretFileIds.includes(id), info, metadata, privacy, confidential, secret }
  }), [fileIds, fileReadResults, localSecretFileIds, localSecrets, ownFileIds])

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

  useEffect(() => {
    setSelectedFiles([])
  }, [activeFolder])

  const statValues = Array.isArray(stats) ? stats : [0n, 0n, 0n, 0n]
  const totalFiles = Number(statValues[0] || 0n)
  const totalDownloads = Number(statValues[1] || 0n)
  const totalVolume = BigInt(statValues[2] || 0n)
  const contractMyFileCount = Number(statValues[3] || 0n)
  const localOwnedFileCount = new Set([...ownFileIds, ...localSecretFileIds]).size
  const myFileCount = Math.max(contractMyFileCount, localOwnedFileCount)

  useEffect(() => {
    if (!txSuccess) return
    void refetchFiles()
    void refetchFolders()
    void refetchVisibleFolders()
    void refetchTeams()
    void refetchActiveFolderFiles()
    void refetchVisibleFolderFileReads()
    void refetchFileReads()
    void refetchFolderReads()
    void refetchTeamReads()
  }, [refetchActiveFolderFiles, refetchFileReads, refetchFiles, refetchFolderReads, refetchFolders, refetchTeamReads, refetchTeams, refetchVisibleFolderFileReads, refetchVisibleFolders, txSuccess])

  useEffect(() => {
    if (!writeError) return
    setNotice(writeError.message.includes("does not match the target chain")
      ? `Switch your wallet to ${sepolia.name} before submitting on-chain actions.`
      : writeError.message || "Transaction was not submitted.")
    setPendingBatch(null)
  }, [writeError])

  const ensureSepolia = useCallback(async () => {
    if (!wrongNetwork) return true
    setNotice(`Switching wallet to ${sepolia.name}...`)
    try {
      await switchChainAsync({ chainId: sepolia.id })
      setNotice(`Wallet switched to ${sepolia.name}. Click the action again to submit on-chain.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Please switch your wallet to ${sepolia.name}.`)
    }
    return false
  }, [switchChainAsync, wrongNetwork])

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
    try {
      await copyTextToClipboard(text)
      setCopiedId(id)
      setNotice("Share link copied.")
      setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current))
        setNotice(null)
      }, 1800)
    } catch {
      setNotice("Copy failed. Select the link text and copy it manually.")
    }
  }, [])

  const createFolder = async () => {
    if (!folderName.trim()) return
    if (!(await ensureSepolia())) return
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "createFolder",
      args: [folderName.trim(), "#111111"],
      chainId: sepolia.id,
    })
    setFolderName("")
  }

  const createTeam = async () => {
    if (!teamName.trim()) return
    if (!(await ensureSepolia())) return
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "createTeam",
      args: [teamName.trim()],
      chainId: sepolia.id,
    })
    setTeamName("")
  }

  const addTeamMember = async () => {
    const selectedTeam = teams[0]
    if (!selectedTeam || !teamMember.trim()) return
    if (!(await ensureSepolia())) return
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "addTeamMember",
      args: [selectedTeam.id, teamMember.trim() as `0x${string}`, TEAM_ROLES.editor],
      chainId: sepolia.id,
    })
    setTeamMember("")
  }

  const shareFolderWithTeam = async () => {
    if (!teamShareId || activeFolder === "all" || activeFolder === "0") return
    if (!(await ensureSepolia())) return
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "grantFolderToTeam",
      args: [BigInt(activeFolder), BigInt(teamShareId), TEAM_ROLES.viewer],
      chainId: sepolia.id,
    })
  }

  const moveFile = async (fileId: string, folderId: string) => {
    if (!(await ensureSepolia())) return
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "moveFileToFolder",
      args: [BigInt(fileId), BigInt(folderId)],
      chainId: sepolia.id,
    })
  }

  const toggleAnonymous = async (fileId: string, currentValue: boolean) => {
    if (!(await ensureSepolia())) return
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "updateFilePrivacy",
      args: [BigInt(fileId), !currentValue],
      chainId: sepolia.id,
    })
  }

  const updatePlanDraft = (fileId: string, patch: Partial<{ price: string; periodDays: string }>) => {
    setPlanDrafts((current) => ({
      ...current,
      [fileId]: {
        ...(current[fileId] ?? { price: "0.001", periodDays: "7" }),
        ...patch,
      },
    }))
  }

  const createSubscriptionPlan = async (fileId: string) => {
    const draft = planDrafts[fileId] || { price: "0.001", periodDays: "7" }
    if (!(await ensureSepolia())) return
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: "createSubscriptionPlan",
      args: [BigInt(fileId), parseNativePrice(draft.price), BigInt(draft.periodDays) * 24n * 60n * 60n, 12n],
      chainId: sepolia.id,
    })
  }

  const runBatchDownload = async () => {
    const selected = filteredRecords.filter((record) => selectedFiles.includes(record.id))
    const selectedIds = selected.map((record) => record.id)
    if (selectedIds.length === 0) {
      setNotice("Select visible files before starting a batch download.")
      return
    }

    const missingKey = selected.find((record) => record.info?.contentEncrypted && (!record.secret?.encryptionKey || !record.secret.encryptionIv))
    if (missingKey) {
      const name = missingKey.secret?.fileName || missingKey.metadata?.fileName || `File #${missingKey.id}`
      setNotice(`${name} is encrypted and this browser does not have its key.`)
      return
    }

    try {
      if (!(await ensureSepolia())) return
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: FHENIX_DROPBOX_ABI,
        functionName: "batchDownloadFiles",
        args: [selectedIds.map((id) => BigInt(id))],
        chainId: sepolia.id,
      })
      setPendingBatch({ ids: selectedIds, hash })
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

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F4F0] px-6">
        <div className="w-full max-w-md rounded-2xl border border-black/[0.07] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/[0.04]">
            <Wallet className="h-8 w-8 text-black/35" />
          </div>
          <h1 className="text-xl font-semibold text-[#111]">Connect Your Wallet</h1>
          <p className="mt-2 text-sm text-black/50">Connect your wallet to manage files, folders, teams, subscriptions, and batch downloads.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => connectors[0] && connect({ connector: connectors[0] })}
              disabled={!connectors[0] || isConnecting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#111] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Connect Wallet
            </button>
            <Link href="/" className="inline-flex flex-1 items-center justify-center rounded-xl border border-black/[0.08] px-4 py-3 text-sm font-medium text-black/70 hover:bg-black/[0.03]">
              Go Back
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard"
            className="mt-0.5 rounded-lg p-2 text-black/60 transition-colors hover:bg-black/[0.04] hover:text-black"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[#111]">My Files</h1>
            <p className="mt-1 text-sm text-black/50">Organize, share, and batch download your on-chain files.</p>
          </div>
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
                disabled={isWriting || isWaiting || isSwitchingChain}
                className="rounded-lg bg-[#111] px-3 text-white disabled:opacity-50"
              >
                {isWriting || isWaiting || isSwitchingChain ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.07] bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-medium">
              <Users className="h-4 w-4" />
              Teams
            </div>
            <div className="space-y-2">
              {teams.length === 0 ? (
                <div className="rounded-xl bg-black/[0.02] p-3 text-xs text-black/40">No teams yet.</div>
              ) : (
                teams.map((team) => (
                  <div key={team.id.toString()} className="rounded-xl bg-black/[0.02] p-3">
                    <div className="truncate text-sm font-medium">{team.name}</div>
                    <div className="text-xs text-black/40">{team.memberCount.toString()} member(s)</div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="New team"
                  className="min-w-0 flex-1 rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-sm"
                />
                <button onClick={createTeam} disabled={isWriting || isWaiting || isSwitchingChain} className="rounded-lg bg-[#111] px-3 text-white disabled:opacity-50">
                  <Users className="h-4 w-4" />
                </button>
              </div>
              <input
                value={teamMember}
                onChange={(event) => setTeamMember(event.target.value)}
                placeholder="0x member as editor"
                className="w-full rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-sm"
              />
              <button
                onClick={addTeamMember}
                disabled={teams.length === 0 || !teamMember.trim() || isWriting || isWaiting || isSwitchingChain}
                className="w-full rounded-lg border border-black/[0.08] px-3 py-2 text-xs font-medium disabled:opacity-50"
              >
                Add to first team
              </button>
              <select
                value={teamShareId}
                onChange={(event) => setTeamShareId(event.target.value)}
                className="w-full rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-xs"
              >
                <option value="">Share active folder</option>
                {teams.map((team) => (
                  <option key={team.id.toString()} value={team.id.toString()}>{team.name}</option>
                ))}
              </select>
              <button
                onClick={shareFolderWithTeam}
                disabled={!teamShareId || activeFolder === "all" || activeFolder === "0" || isWriting || isWaiting || isSwitchingChain}
                className="w-full rounded-lg bg-[#111] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                Grant viewer access
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.07] bg-white p-4 text-xs text-black/45">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-black/70">
              <Shield className="h-4 w-4" />
              Wave 5 Tools
            </div>
            CoFHE rule handles, team folders, webhook delivery, and subscriptions are recorded on-chain. Secret file keys stay in this browser and copied share links.
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
              disabled={selectedFiles.length === 0 || isWriting || isWaiting || isSwitchingChain}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {isWriting || isWaiting || isSwitchingChain ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
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
                  const canShareLink = hasUsableShareLink(record)
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
                              {record.confidential?.enabled && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                  <Shield className="h-3 w-3" />
                                  CoFHE rules
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
                          {record.owned && (
                            <>
                              <div className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-black/[0.02] p-1">
                                <input
                                  value={planDrafts[record.id]?.price ?? "0.001"}
                                  onChange={(event) => updatePlanDraft(record.id, { price: event.target.value })}
                                  className="w-20 bg-transparent px-2 text-xs outline-none"
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  title="Subscription price in ETH"
                                />
                                <select
                                  value={planDrafts[record.id]?.periodDays ?? "7"}
                                  onChange={(event) => updatePlanDraft(record.id, { periodDays: event.target.value })}
                                  className="bg-transparent text-xs outline-none"
                                  title="Subscription period"
                                >
                                  <option value="1">1d</option>
                                  <option value="7">7d</option>
                                  <option value="30">30d</option>
                                </select>
                                <button
                                  onClick={() => createSubscriptionPlan(record.id)}
                                  className="rounded-md bg-[#111] p-1.5 text-white"
                                  title="Create subscription plan"
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                </button>
                              </div>
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
                            </>
                          )}
                          {canShareLink && (
                            <>
                              <button
                                onClick={() => setQrModalFile(record)}
                                className="rounded-lg border border-black/[0.08] p-2 hover:bg-black/[0.04]"
                                title={record.info?.contentEncrypted ? "Secret QR code" : "QR code"}
                              >
                                <QrCode className="h-4 w-4 text-black/55" />
                              </button>
                              <button
                                onClick={() => copyToClipboard(shareUrl, record.id)}
                                className="rounded-lg border border-black/[0.08] p-2 hover:bg-black/[0.04]"
                                title={record.info?.contentEncrypted ? "Copy secret link" : "Copy share link"}
                              >
                                {copiedId === record.id ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-black/55" />}
                              </button>
                            </>
                          )}
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

      {qrModalFile && hasUsableShareLink(qrModalFile) && (
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
