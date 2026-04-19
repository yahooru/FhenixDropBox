"use client"

import { useAccount, useReadContract } from "wagmi"
import Link from "next/link"
import { Upload, FolderOpen, Share2, Download, Lock, TrendingUp, FileText, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"
import { FHENIX_DROPBOX_ABI, CONTRACT_ADDRESS } from "@/lib/fhenix"

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

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Read stats from contract
  const { data: stats, isLoading: statsLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: FHENIX_DROPBOX_ABI,
    functionName: 'getStats',
    query: { enabled: isConnected }
  })

  const totalFiles = stats ? Number(stats[0]) : 0
  const totalDownloads = stats ? Number(stats[1]) : 0
  const totalVolume = stats ? Number(stats[2]) / 1e6 : 0
  const myFileCount = stats ? Number(stats[3]) : 0

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
            {address ? `Welcome back, ${address.slice(0, 8)}...` : 'Connect your wallet to get started'}
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
        <StatCard
          icon={FolderOpen}
          label="Total Files"
          value={statsLoading ? "..." : totalFiles.toString()}
          trend="+0"
        />
        <StatCard
          icon={Download}
          label="Total Downloads"
          value={statsLoading ? "..." : totalDownloads.toString()}
          trend="+0"
        />
        <StatCard
          icon={Share2}
          label="My Files"
          value={statsLoading ? "..." : myFileCount.toString()}
        />
        <StatCard
          icon={Lock}
          label="Total Volume"
          value={statsLoading ? "..." : `${totalVolume.toFixed(2)} USDC`}
          trend="+0%"
        />
      </div>

      {/* Contract Info */}
      <div className="bg-white rounded-2xl border border-black/[0.07] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Lock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="font-medium">Contract Connected</div>
            <div className="text-xs text-black/40">Reading from blockchain</div>
          </div>
        </div>
        <div className="bg-black/[0.03] rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-black/40">Contract Address</span>
            <span className="font-mono text-black/60">{CONTRACT_ADDRESS.slice(0, 10)}...</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-black/40">Network</span>
            <span className="text-black/60">Ethereum Sepolia</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-black/40">Chain ID</span>
            <span className="text-black/60">11155111</span>
          </div>
        </div>
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

      {/* Privacy Banner */}
      <div className="bg-gradient-to-r from-[#111] to-[#333] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-medium mb-1">Privacy Protected</div>
            <div className="text-sm text-white/60">
              All your files and access rules are encrypted on-chain.
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-white/40">
            <FileText className="w-4 h-4" />
            Powered by FhenixDropBox
          </div>
        </div>
      </div>

      {/* Connected Wallet */}
      {address && (
        <div className="bg-white rounded-2xl border border-black/[0.07] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <div>
                <div className="text-sm font-medium">Wallet Connected</div>
                <div className="text-xs text-black/40 font-mono">{address}</div>
              </div>
            </div>
            <a
              href={`https://sepolia.etherscan.io/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              View on Etherscan
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
