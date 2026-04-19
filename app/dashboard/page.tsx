"use client"

import { useAccount } from "wagmi"
import Link from "next/link"
import { Upload, FolderOpen, Share2, Download, Eye, Lock, TrendingUp, Clock, FileText, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"

// Mock data for demo
const mockFiles = [
  { id: "1", name: "Q4 Financial Report.pdf", size: "2.4 MB", downloads: 12, price: "5 USDC", status: "active", created: "2 days ago" },
  { id: "2", name: "Product Roadmap 2024.xlsx", size: "890 KB", downloads: 8, price: "10 USDC", status: "active", created: "1 week ago" },
  { id: "3", name: "Legal Contract Draft.docx", size: "156 KB", downloads: 3, price: "25 USDC", status: "active", created: "3 days ago" },
]

const mockRecentActivity = [
  { type: "download", file: "Q4 Financial Report.pdf", user: "0x742d...35Cc", time: "5 min ago" },
  { type: "purchase", file: "Product Roadmap 2024.xlsx", user: "0x8ba1...92Ff", time: "1 hour ago" },
  { type: "upload", file: "Legal Contract Draft.docx", user: "You", time: "3 days ago" },
]

function StatCard({ icon: Icon, label, value, trend }: { icon: any; label: string; value: string; trend?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.07] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-black/[0.04] flex items-center justify-center">
          <Icon className="w-5 h-5 text-black/50" />
        </div>
        {trend && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-medium mb-1">{value}</div>
      <div className="text-xs text-black/40">{label}</div>
    </div>
  )
}

function FileRow({ file }: { file: typeof mockFiles[0] }) {
  return (
    <div className="flex items-center justify-between py-4 px-4 hover:bg-black/[0.02] rounded-xl transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-black/[0.04] flex items-center justify-center">
          <FileText className="w-5 h-5 text-black/40" />
        </div>
        <div>
          <div className="text-sm font-medium">{file.name}</div>
          <div className="text-xs text-black/40">{file.size} • {file.created}</div>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-sm font-medium">{file.price}</div>
          <div className="text-xs text-black/40">{file.downloads} downloads</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-black/40">Active</span>
        </div>
        <Link
          href={`/share/${file.id}`}
          className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors"
        >
          <Share2 className="w-4 h-4 text-black/40" />
        </Link>
      </div>
    </div>
  )
}

function ActivityItem({ item }: { item: typeof mockRecentActivity[0] }) {
  const icons = {
    download: Download,
    purchase: Lock,
    upload: Upload,
  }
  const colors = {
    download: "text-blue-600 bg-blue-50",
    purchase: "text-emerald-600 bg-emerald-50",
    upload: "text-purple-600 bg-purple-50",
  }
  const Icon = icons[item.type as keyof typeof icons]

  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[item.type as keyof typeof colors]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm">
          <span className="text-black/60">
            {item.type === "upload" ? "Uploaded" : item.type === "download" ? "Downloaded by" : "Purchased by"}
          </span>{" "}
          <span className="font-medium">{item.file}</span>
        </div>
        <div className="text-xs text-black/40">{item.user} • {item.time}</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-black/[0.05] rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-black/[0.05] rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Dashboard</h1>
          <p className="text-sm text-black/50 mt-1">
            Welcome back, {address?.slice(0, 8)}...
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111] text-white text-sm hover:bg-[#333] transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload File
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={FolderOpen} label="Total Files" value="12" trend="+3" />
        <StatCard icon={Download} label="Total Downloads" value="47" trend="+12%" />
        <StatCard icon={Share2} label="Active Shares" value="8" />
        <StatCard icon={Lock} label="Total Earned" value="142 USDC" trend="+28%" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/upload"
          className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-black/[0.07] hover:border-black/[0.12] hover:shadow-lg transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Upload New File</div>
            <div className="text-xs text-black/40">Add files to share privately</div>
          </div>
          <ArrowRight className="w-4 h-4 text-black/30" />
        </Link>

        <Link
          href="/files"
          className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-black/[0.07] hover:border-black/[0.12] hover:shadow-lg transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
            <FolderOpen className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Manage Files</div>
            <div className="text-xs text-black/40">View and edit your files</div>
          </div>
          <ArrowRight className="w-4 h-4 text-black/30" />
        </Link>

        <Link
          href="/settings"
          className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-black/[0.07] hover:border-black/[0.12] hover:shadow-lg transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Shared Links</div>
            <div className="text-xs text-black/40">View all shareable links</div>
          </div>
          <ArrowRight className="w-4 h-4 text-black/30" />
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Files */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
            <h2 className="font-medium">Recent Files</h2>
            <Link href="/files" className="text-xs text-black/40 hover:text-black transition-colors">
              View All
            </Link>
          </div>
          <div className="p-4">
            {mockFiles.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <h2 className="font-medium">Recent Activity</h2>
          </div>
          <div className="p-4">
            {mockRecentActivity.map((item, i) => (
              <ActivityItem key={i} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Privacy Banner */}
      <div className="bg-gradient-to-r from-[#111] to-[#333] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-medium mb-1">Privacy Protected</div>
            <div className="text-sm text-white/60">
              All your files and access rules are encrypted using Fhenix FHE technology.
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-white/40">
            <Eye className="w-4 h-4" />
            No one can see your data
          </div>
        </div>
      </div>
    </div>
  )
}
