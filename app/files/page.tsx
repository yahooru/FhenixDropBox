"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import Link from "next/link"
import { Search, FileText, MoreVertical, Download, Share2, Trash2, ExternalLink, Lock, CheckCircle2, Loader2, ArrowLeft, Plus, Eye, EyeOff, Shield, FolderPlus, Link2, QrCode } from "lucide-react"
import { FHENIX_DROPBOX_ABI, CONTRACT_ADDRESS, formatUSDC } from "@/lib/fhenix"
import { QRCodeSVG } from "qrcode.react"

// Coming soon tooltip component
function ComingSoon({ children, label }: { children: React.ReactNode; label: string }) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-not-allowed opacity-50"
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

const fileTypeColors: Record<string, { bg: string; text: string }> = {
  pdf: { bg: "bg-red-50", text: "text-red-600" },
  xlsx: { bg: "bg-emerald-50", text: "text-emerald-600" },
  docx: { bg: "bg-blue-50", text: "text-blue-600" },
  zip: { bg: "bg-amber-50", text: "text-amber-600" },
  pptx: { bg: "bg-orange-50", text: "text-orange-600" },
  default: { bg: "bg-gray-50", text: "text-gray-600" }
}

export default function FilesPage() {
  const { address, isConnected } = useAccount()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [qrModalFile, setQrModalFile] = useState<{ fileId: string; fileName: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [baseUrl, setBaseUrl] = useState<string>('')

  useEffect(() => {
    setMounted(true)
    setBaseUrl(window.location.origin)
  }, [])

  // Get user's files from contract
  const { data: myFileIds, isLoading: filesLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getMyFiles',
    query: { enabled: isConnected && !!address && mounted }
  })

  // Get stats
  const { data: stats } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getStats',
    query: { enabled: isConnected && mounted }
  })

  const totalFiles = stats ? Number(stats[0]) : 0
  const totalDownloads = stats ? Number(stats[1]) : 0
  const totalVolume = stats ? Number(stats[2]) / 1e6 : 0
  const myFileCount = stats ? Number(stats[3]) : 0

  const fileIds = myFileIds || []

  // Fetch all file info in batch
  const { data: filesInfo } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getFileInfo',
    args: [fileIds[0] || BigInt(0)],
    query: { enabled: fileIds.length > 0 }
  })

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Generate URL hash for share link
  const generateHash = (input: string): string => {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()
  }

  const filteredFiles = fileIds.map((id: bigint, index: number) => ({
    id: id.toString(),
    name: `File #${id.toString()}`,
    size: "N/A",
    type: "file",
    downloads: 0,
    price: "0 USDC",
    status: "active" as const,
    createdAt: 'Fetching...',
    contentEncrypted: false,
    ipfsHash: ''
  }))

  const toggleSelectFile = (id: string) => {
    setSelectedFiles(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(filteredFiles.map(f => f.id))
    }
  }

  const { writeContract, isPending: isDeactivating } = useWriteContract()
  const { isLoading: isWaitingTx } = useWaitForTransactionReceipt({ hash: undefined as any })

  const handleDeactivate = (fileId: string) => {
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: 'deactivateFile',
      args: [BigInt(fileId)],
    })
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
          Connect your wallet to view and manage your files.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard" className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-medium">My Files</h1>
          </div>
          <p className="text-sm text-black/50 ml-11">
            Manage and monitor your uploaded files
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111] text-white text-sm hover:bg-[#333] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Upload
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <div className="text-2xl font-medium">{filesLoading ? "..." : myFileCount}</div>
          <div className="text-xs text-black/40">My Files</div>
        </div>
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <div className="text-2xl font-medium">{totalDownloads}</div>
          <div className="text-xs text-black/40">Downloads</div>
        </div>
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <div className="text-2xl font-medium">{totalVolume.toFixed(2)}</div>
          <div className="text-xs text-black/40">USDC Earned</div>
        </div>
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <div className="text-2xl font-medium">{totalFiles}</div>
          <div className="text-xs text-black/40">Total Platform</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-black/[0.1] bg-white text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-black/[0.1] bg-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>

      {/* Files Table */}
      <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
        {filesLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-black/30 mx-auto mb-4" />
            <div className="text-sm text-black/50">Loading files from blockchain...</div>
          </div>
        ) : fileIds.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-12 h-12 text-black/20 mx-auto mb-4" />
            <div className="text-sm text-black/50 mb-4">No files uploaded yet</div>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111] text-white text-sm"
            >
              <Plus className="w-4 h-4" />
              Upload Your First File
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-black/[0.2]"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase">File</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase">Uploaded</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase">Downloads</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-black/40 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="border-b border-black/[0.04] hover:bg-black/[0.02] transition-colors">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => toggleSelectFile(file.id)}
                        className="rounded border-black/[0.2]"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${fileTypeColors.default.bg}`}>
                          <FileText className={`w-5 h-5 ${fileTypeColors.default.text}`} />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{file.name}</div>
                          <div className="text-xs text-black/40">ID: {file.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-black/50">
                      {file.createdAt}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {file.downloads}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setQrModalFile({ fileId: file.id, fileName: file.name })}
                          className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors"
                          title="QR Code"
                        >
                          <QrCode className="w-4 h-4 text-black/40" />
                        </button>
                        <Link
                          href={`/share/${file.id}`}
                          className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-4 h-4 text-black/40" />
                        </Link>
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === file.id ? null : file.id)}
                            className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-black/40" />
                          </button>
                          {activeMenu === file.id && (
                            <div className="absolute right-0 mt-1 w-40 rounded-xl bg-white border border-black/[0.1] shadow-lg overflow-hidden z-10">
                              <ComingSoon label="Coming in Wave 3">
                                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/[0.04]">
                                  <Eye className="w-4 h-4" />
                                  View Preview
                                </button>
                              </ComingSoon>
                              <ComingSoon label="Coming in Wave 3">
                                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/[0.04]">
                                  <FolderPlus className="w-4 h-4" />
                                  Add to Folder
                                </button>
                              </ComingSoon>
                              <ComingSoon label="Coming in Wave 3">
                                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/[0.04]">
                                  <Link2 className="w-4 h-4" />
                                  Set Link Expiry     
                                </button>
                              </ComingSoon>
                              <div className="border-t border-black/[0.06]" />
                              <button
                                onClick={() => handleDeactivate(file.id)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/[0.04] text-red-600"
                              >
                                <EyeOff className="w-4 h-4" />
                                Deactivate
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contract Info */}
      <div className="bg-white rounded-2xl border border-black/[0.07] p-4">
        <div className="flex items-center justify-between text-xs text-black/40">
          <span>Data stored on Ethereum Sepolia</span>
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-black transition-colors"
          >
            View Contract
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedFiles.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#111] text-white px-6 py-3 rounded-xl flex items-center gap-4 shadow-2xl">
          <span className="text-sm">{selectedFiles.length} selected</span>
          <div className="flex gap-2">
            <ComingSoon label="Coming in Wave 3">
              <button className="px-3 py-1.5 rounded-lg bg-white/10 text-xs opacity-50 cursor-not-allowed">
                Deactivate
              </button>
            </ComingSoon>
            <button
              onClick={() => setSelectedFiles([])}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/20"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalFile && mounted && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setQrModalFile(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium">Scan to Access</h3>
              <p className="text-sm text-black/50">{qrModalFile.fileName}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-black/[0.1] flex items-center justify-center mb-4">
              <QRCodeSVG
                value={`${baseUrl}/share/${qrModalFile.fileId}`}
                size={180}
                level="H"
              />
            </div>
            <div className="text-center">
              <div className="text-xs text-black/40 mb-1">Secure Link ID</div>
              <div className="text-sm font-mono text-black/60">{generateHash(qrModalFile.fileId)}</div>
            </div>
            <button
              onClick={() => setQrModalFile(null)}
              className="w-full mt-4 py-3 rounded-xl bg-[#111] text-white text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
