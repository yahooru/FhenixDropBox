"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import Link from "next/link"
import {
  Search, FileText, MoreVertical, Download, Share2,
  Trash2, ExternalLink, Lock, CheckCircle2, Loader2,
  Plus, Eye, EyeOff, FolderPlus, Link2, QrCode, Copy,
  Shield, Upload, Folder, TrendingUp, Calendar, Hash
} from "lucide-react"
import { FHENIX_DROPBOX_ABI, CONTRACT_ADDRESS, formatUSDC } from "@/lib/fhenix"
import { QRCodeSVG } from "qrcode.react"

export default function FilesPage() {
  const { address, isConnected } = useAccount()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [qrModalFile, setQrModalFile] = useState<{ fileId: string; fileName: string; ipfsHash?: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    setBaseUrl(window.location.origin)
  }, [])

  // Get user's files from contract
  const { data: myFileIds, isLoading: filesLoading, refetch: refetchFiles } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getMyFiles',
    query: { enabled: isConnected && !!address && mounted }
  })

  useEffect(() => {
    if (mounted && isConnected && address) {
      refetchFiles()
    }
  }, [mounted, isConnected, address, refetchFiles])

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

  const fileIds = myFileIds ? Array.from(myFileIds) : []

  const copyToClipboard = useCallback(async (text: string, fileId?: string) => {
    try {
      await navigator.clipboard.writeText(text)
      if (fileId) {
        setCopiedId(fileId)
        setTimeout(() => setCopiedId(null), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [])

  const filesList = fileIds.map((id: bigint) => {
    const idStr = id.toString()
    return {
      id: idStr,
      name: `File #${idStr}`,
      ipfsHash: '',
      size: "Encrypted",
      status: "active",
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  })

  const filteredFiles = filesList.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.ipfsHash?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const { writeContract } = useWriteContract()

  const handleDeactivate = (fileId: string) => {
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: FHENIX_DROPBOX_ABI,
      functionName: 'deactivateFile',
      args: [BigInt(fileId)],
    })
  }

  const handleShareClick = (fileId: string) => {
    window.open(`/share/${fileId}`, '_blank')
  }

  if (!mounted) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-16 w-64 bg-black/[0.05] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-black/[0.05] rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#111]">My Files</h1>
          <p className="text-sm text-black/50 mt-1">Manage and share your encrypted files</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#111] text-white text-sm font-medium hover:bg-[#222] transition-all shadow-lg hover:shadow-xl"
        >
          <Upload className="w-4 h-4" />
          Upload Files
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-5 border border-blue-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Folder className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-blue-700">{filesLoading ? "..." : myFileCount}</div>
          <div className="text-xs text-blue-600/70 mt-1">My Files</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-5 border border-emerald-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-700">{totalDownloads}</div>
          <div className="text-xs text-emerald-600/70 mt-1">Total Downloads</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl p-5 border border-amber-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-700">{totalVolume.toFixed(2)}</div>
          <div className="text-xs text-amber-600/70 mt-1">USDC Earned</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl p-5 border border-purple-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-purple-700">{totalFiles}</div>
          <div className="text-xs text-purple-600/70 mt-1">Total Platform</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files by name or ID..."
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-black/[0.08] bg-white text-sm focus:outline-none focus:border-black/[0.2] focus:ring-2 focus:ring-black/[0.05] transition-all"
        />
      </div>

      {/* Files Grid */}
      <div className="bg-white rounded-3xl border border-black/[0.08] overflow-hidden shadow-sm">
        {filesLoading ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 rounded-full bg-black/[0.05] flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-black/30" />
            </div>
            <div className="text-sm text-black/50">Loading from blockchain...</div>
          </div>
        ) : fileIds.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#f5f4f0] to-[#e8e6e0] flex items-center justify-center mx-auto mb-6">
              <FileText className="w-12 h-12 text-black/20" />
            </div>
            <h3 className="text-lg font-medium text-black/70 mb-2">No files uploaded yet</h3>
            <p className="text-sm text-black/40 mb-6 max-w-sm mx-auto">
              Upload your first file and start sharing with complete privacy protection
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111] text-white text-sm font-medium hover:bg-[#222] transition-all"
            >
              <Upload className="w-4 h-4" />
              Upload Your First File
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04]">
            {filteredFiles.map((file, index) => (
              <div
                key={file.id}
                className="p-5 hover:bg-black/[0.02] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  {/* File Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f5f4f0] to-[#e8e6e0] flex items-center justify-center shrink-0">
                    <FileText className="w-7 h-7 text-black/40" />
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[#111] truncate">{file.name}</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                        <Lock className="w-3 h-3" />
                        Encrypted
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-black/40">
                      <span className="inline-flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        ID: {file.id}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {file.createdAt}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setQrModalFile({ fileId: file.id, fileName: file.name })}
                      className="p-2.5 rounded-xl hover:bg-black/[0.05] transition-colors bg-black/[0.02]"
                      title="QR Code"
                    >
                      <QrCode className="w-5 h-5 text-black/50" />
                    </button>
                    <button
                      onClick={() => handleShareClick(file.id)}
                      className="p-2.5 rounded-xl hover:bg-black/[0.05] transition-colors bg-black/[0.02]"
                      title="Share"
                    >
                      <Share2 className="w-5 h-5 text-black/50" />
                    </button>
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}/share/${file.id}`, file.id)}
                      className={`p-2.5 rounded-xl transition-colors ${
                        copiedId === file.id
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-black/[0.02] hover:bg-black/[0.05]'
                      }`}
                      title="Copy Link"
                    >
                      {copiedId === file.id ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5 text-black/50" />
                      )}
                    </button>
                    <Link
                      href={`/share/${file.id}`}
                      className="px-4 py-2 rounded-xl bg-[#111] text-white text-xs font-medium hover:bg-[#222] transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-black/40 py-2">
        <span className="inline-flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          Protected by Fhenix FHE on Ethereum Sepolia
        </span>
        <a
          href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-black transition-colors"
        >
          View Contract
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* QR Modal */}
      {qrModalFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setQrModalFile(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f5f4f0] to-[#e8e6e0] flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-black/40" />
              </div>
              <h3 className="text-xl font-semibold text-[#111]">Scan to Access</h3>
              <p className="text-sm text-black/50 mt-1">{qrModalFile.fileName}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border-2 border-black/[0.08] flex items-center justify-center mb-6">
              <QRCodeSVG
                value={`${baseUrl}/share/${qrModalFile.fileId}`}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="bg-[#f5f4f0] rounded-xl p-3 mb-6">
              <div className="text-xs text-black/40 mb-1 text-center">Share Link</div>
              <div className="text-xs font-mono text-[#111] text-center break-all">
                {`${baseUrl}/share/${qrModalFile.fileId}`}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(`${baseUrl}/share/${qrModalFile.fileId}`)}
                className="flex-1 py-3.5 rounded-xl bg-[#111] text-white text-sm font-medium hover:bg-[#222] transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              <button
                onClick={() => setQrModalFile(null)}
                className="px-6 py-3.5 rounded-xl border border-black/[0.1] text-sm hover:bg-black/[0.02] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
