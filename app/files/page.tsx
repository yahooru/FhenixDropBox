"use client"

import { useState } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import Link from "next/link"
import { Search, FileText, MoreVertical, Download, Share2, Trash2, ExternalLink, Lock, CheckCircle2, Loader2 } from "lucide-react"
import { FHENIX_DROPBOX_ABI, CONTRACT_ADDRESS } from "@/lib/fhenix"

const fileTypeIcons: Record<string, string> = {
  pdf: "bg-red-50 text-red-600",
  xlsx: "bg-emerald-50 text-emerald-600",
  docx: "bg-blue-50 text-blue-600",
  zip: "bg-amber-50 text-amber-600",
  pptx: "bg-orange-50 text-orange-600",
  default: "bg-gray-50 text-gray-600"
}

export default function FilesPage() {
  const { address, isConnected } = useAccount()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  // Get user's files from contract
  const { data: myFileIds, isLoading: filesLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getMyFiles',
    query: { enabled: isConnected && !!address }
  })

  // Get stats
  const { data: stats } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getStats',
    query: { enabled: isConnected }
  })

  const totalFiles = stats ? Number(stats[0]) : 0
  const totalDownloads = stats ? Number(stats[1]) : 0
  const totalVolume = stats ? Number(stats[2]) / 1e6 : 0

  // Get file details for each file
  const fileIds = myFileIds || []

  const filteredFiles = fileIds.map((id: bigint) => ({
    id: id.toString(),
    name: `File #${id.toString()}`,
    size: "N/A",
    type: "file",
    downloads: 0,
    price: "0 USDC",
    status: "active" as const
  }))

  const toggleSelectFile = (id: string) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(filteredFiles.map((f) => f.id))
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-[#111] flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-medium mb-3">Connect Your Wallet</h1>
        <p className="text-sm text-black/50">
          Connect your wallet to view and manage your uploaded files.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">My Files</h1>
          <p className="text-sm text-black/50 mt-1">
            Manage and monitor your uploaded files on-chain
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111] text-white text-sm hover:bg-[#333] transition-colors"
        >
          Upload New
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <div className="text-2xl font-medium">{filesLoading ? "..." : fileIds.length}</div>
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
          <div className="text-xs text-black/40">Total Files</div>
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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-black/[0.1] bg-white text-sm focus:outline-none focus:border-black/[0.2]"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-black/[0.1] bg-white text-sm focus:outline-none focus:border-black/[0.2]"
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111] text-white text-sm hover:bg-[#333] transition-colors"
            >
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase tracking-wider">
                    File ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase tracking-wider">
                    Downloads
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-black/40 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="border-b border-black/[0.04] hover:bg-black/[0.02] transition-colors"
                  >
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
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${fileTypeIcons.default}`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{file.name}</div>
                          <div className="text-xs text-black/40">ID: {file.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {file.status === "active" ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">{file.downloads}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/share/${file.id}`}
                          className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-4 h-4 text-black/40" />
                        </Link>
                        <button
                          className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors"
                          title="More"
                        >
                          <MoreVertical className="w-4 h-4 text-black/40" />
                        </button>
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
            <button className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/20 transition-colors">
              Deactivate
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/20 transition-colors">
              Delete
            </button>
          </div>
          <button
            onClick={() => setSelectedFiles([])}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
