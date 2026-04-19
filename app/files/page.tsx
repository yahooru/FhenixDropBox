"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Filter, FileText, MoreVertical, Download, Share2, Trash2, Eye, EyeOff, Lock, CheckCircle2, ExternalLink } from "lucide-react"

// Mock data
const mockFiles = [
  {
    id: "1",
    name: "Q4 Financial Report 2024.pdf",
    size: "2.4 MB",
    type: "pdf",
    uploaded: "2 days ago",
    downloads: 12,
    earnings: "60 USDC",
    price: "5 USDC",
    status: "active",
    ipfsHash: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    views: 34,
  },
  {
    id: "2",
    name: "Product Roadmap 2024.xlsx",
    size: "890 KB",
    type: "xlsx",
    uploaded: "1 week ago",
    downloads: 8,
    earnings: "80 USDC",
    price: "10 USDC",
    status: "active",
    ipfsHash: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    views: 21,
  },
  {
    id: "3",
    name: "Legal Contract Draft.docx",
    size: "156 KB",
    type: "docx",
    uploaded: "3 days ago",
    downloads: 3,
    earnings: "75 USDC",
    price: "25 USDC",
    status: "active",
    ipfsHash: "QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX",
    views: 8,
  },
  {
    id: "4",
    name: "Design Assets Bundle.zip",
    size: "45.2 MB",
    type: "zip",
    uploaded: "2 weeks ago",
    downloads: 24,
    earnings: "480 USDC",
    price: "20 USDC",
    status: "active",
    ipfsHash: "QmZTFJMkmRMKnR9aZcG9W7KJvMjz9k4S4LQ2c8J3VYK7zH",
    views: 67,
  },
  {
    id: "5",
    name: "Marketing Strategy.pptx",
    size: "3.8 MB",
    type: "pptx",
    uploaded: "1 month ago",
    downloads: 0,
    earnings: "0 USDC",
    price: "15 USDC",
    status: "paused",
    ipfsHash: "QmPCNWVK9xq3N7p3j8T9m2L6v5F1h3K8j9H2g4T6y7U8",
    views: 12,
  },
]

const fileTypeIcons: Record<string, string> = {
  pdf: "bg-red-50 text-red-600",
  xlsx: "bg-emerald-50 text-emerald-600",
  docx: "bg-blue-50 text-blue-600",
  zip: "bg-amber-50 text-amber-600",
  pptx: "bg-orange-50 text-orange-600",
}

export default function FilesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const filteredFiles = mockFiles.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === "all" || file.status === filterStatus
    return matchesSearch && matchesFilter
  })

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">My Files</h1>
          <p className="text-sm text-black/50 mt-1">
            Manage and monitor your uploaded files
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
          <div className="text-2xl font-medium">{mockFiles.length}</div>
          <div className="text-xs text-black/40">Total Files</div>
        </div>
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <div className="text-2xl font-medium">{mockFiles.filter(f => f.status === "active").length}</div>
          <div className="text-xs text-black/40">Active</div>
        </div>
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <div className="text-2xl font-medium">{mockFiles.reduce((acc, f) => acc + f.downloads, 0)}</div>
          <div className="text-xs text-black/40">Downloads</div>
        </div>
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <div className="text-2xl font-medium">{mockFiles.reduce((acc, f) => acc + parseFloat(f.earnings), 0).toFixed(0)}</div>
          <div className="text-xs text-black/40">USDC Earned</div>
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
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase tracking-wider">
                  Downloads
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase tracking-wider">
                  Earnings
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-black/40 uppercase tracking-wider">
                  IPFS
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
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${fileTypeIcons[file.type] || "bg-gray-50 text-gray-600"}`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{file.name}</div>
                        <div className="text-xs text-black/40">{file.size} • {file.uploaded}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      file.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${file.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {file.status === "active" ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{file.price}</span>
                      <Lock className="w-3 h-3 text-black/20" />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm">{file.downloads}</div>
                    <div className="text-xs text-black/40">{file.views} views</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-emerald-600">{file.earnings}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-black/40 max-w-[80px] truncate">
                        {file.ipfsHash.slice(0, 12)}...
                      </code>
                    </div>
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
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === file.id ? null : file.id)}
                          className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-black/40" />
                        </button>
                        {activeMenu === file.id && (
                          <div className="absolute right-0 mt-1 w-40 rounded-xl bg-white border border-black/[0.1] shadow-lg overflow-hidden z-10">
                            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/[0.04] transition-colors">
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/[0.04] transition-colors">
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/[0.04] transition-colors">
                              <ExternalLink className="w-4 h-4" />
                              View on IPFS
                            </button>
                            <div className="border-t border-black/[0.06]" />
                            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/[0.04] transition-colors text-red-600">
                              <Trash2 className="w-4 h-4" />
                              Delete
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

        {filteredFiles.length === 0 && (
          <div className="py-16 text-center">
            <FileText className="w-12 h-12 text-black/20 mx-auto mb-4" />
            <div className="text-sm text-black/50">No files found</div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedFiles.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#111] text-white px-6 py-3 rounded-xl flex items-center gap-4 shadow-2xl">
          <span className="text-sm">{selectedFiles.length} selected</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/20 transition-colors">
              Pause All
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
