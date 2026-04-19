"use client"

import { useAccount, useReadContract } from "wagmi"
import Link from "next/link"
import { Upload, FolderOpen, Share2, Download, Lock, TrendingUp, FileText, ArrowRight, ArrowLeft, Settings, ExternalLink, Plus, Clock, Eye, Shield, Zap } from "lucide-react"
import { useState, useEffect } from "react"
import { FHENIX_DROPBOX_ABI, CONTRACT_ADDRESS } from "@/lib/fhenix"

function StatCard({ icon: Icon, label, value, trend, href }: { icon: any; label: string; value: string; trend?: string; href?: string }) {
  return (
    <Link
      href={href || "#"}
      className="bg-white rounded-2xl border border-black/[0.07] p-6 hover:border-black/[0.12] hover:shadow-lg transition-all block"
    >
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
    </Link>
  )
}

function QuickAction({ icon: Icon, title, description, href, delay = 0 }: { icon: any; title: string; description: string; href: string; delay?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-black/[0.07] hover:border-black/[0.12] hover:shadow-lg transition-all group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-black/50">{description}</div>
      </div>
      <ArrowRight className="w-5 h-5 text-black/30 group-hover:translate-x-1 transition-transform" />
    </Link>
  )
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
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
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-medium">Dashboard</h1>
          </div>
          <p className="text-sm text-black/50 ml-11">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/settings"
          className="p-3 rounded-xl hover:bg-black/[0.04] transition-colors"
        >
          <Settings className="w-5 h-5" />
        </Link>
      </div>

      {/* Wallet Card */}
      {address && (
        <div className="bg-gradient-to-r from-[#111] to-[#333] rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div>
                <div className="text-sm font-medium">Connected Wallet</div>
                <div className="text-xs text-white/60 font-mono">{address}</div>
              </div>
            </div>
            <a
              href={`https://sepolia.etherscan.io/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on Etherscan
            </a>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={FolderOpen}
          label="Total Files"
          value={statsLoading ? "..." : totalFiles.toString()}
          href="/files"
        />
        <StatCard
          icon={Download}
          label="Total Downloads"
          value={statsLoading ? "..." : totalDownloads.toString()}
        />
        <StatCard
          icon={Share2}
          label="My Files"
          value={statsLoading ? "..." : myFileCount.toString()}
          href="/files"
        />
        <StatCard
          icon={Lock}
          label="Total Volume"
          value={statsLoading ? "..." : `${totalVolume.toFixed(2)} USDC`}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          icon={Plus}
          title="Upload Files"
          description="Upload and encrypt new files"
          href="/upload"
          delay={0}
        />
        <QuickAction
          icon={FolderOpen}
          title="Manage Files"
          description="View and edit your files"
          href="/files"
          delay={100}
        />
        <QuickAction
          icon={Settings}
          title="Settings"
          description="Privacy and preferences"
          href="/settings"
          delay={200}
        />
      </div>

      {/* Features Overview */}
      <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
        <div className="p-6 border-b border-black/[0.06]">
          <h2 className="text-lg font-medium">Platform Features</h2>
          <p className="text-sm text-black/50">Available and upcoming privacy features</p>
        </div>
        <div className="divide-y divide-black/[0.06]">
          {[
            { icon: Lock, title: "Encrypted Access Rules", desc: "Prices, passwords, and limits hidden on-chain", available: true },
            { icon: Download, title: "Multi-File Upload", desc: "Upload up to 10 files at once", available: true },
            { icon: Shield, title: "Password Protection", desc: "SHA-256 hashed passwords", available: true },
            { icon: Eye, title: "File Preview", desc: "Preview PDFs and images before purchase", available: false },
            { icon: Clock, title: "Link Expiry", desc: "24h / 7d / 30d link expiration", available: false },
            { icon: Zap, title: "Instant Access", desc: "Quick verification without delays", available: true },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${feature.available ? 'bg-emerald-50' : 'bg-black/[0.05]'}`}>
                <feature.icon className={`w-5 h-5 ${feature.available ? 'text-emerald-600' : 'text-black/30'}`} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{feature.title}</div>
                <div className="text-xs text-black/50">{feature.desc}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${feature.available ? 'bg-emerald-50 text-emerald-700' : 'bg-black/[0.05] text-black/40'}`}>
                {feature.available ? 'Available' : 'Coming Soon'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Info */}
      <div className="bg-white rounded-2xl border border-black/[0.07] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Lock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="font-medium">Contract Connected</div>
            <div className="text-xs text-black/40">Reading from Ethereum Sepolia</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-black/[0.02] rounded-lg">
            <div className="text-xs text-black/40 mb-1">Contract</div>
            <div className="text-xs font-mono truncate">{CONTRACT_ADDRESS.slice(0, 10)}...</div>
          </div>
          <div className="p-3 bg-black/[0.02] rounded-lg">
            <div className="text-xs text-black/40 mb-1">Network</div>
            <div className="text-xs">Sepolia</div>
          </div>
          <div className="p-3 bg-black/[0.02] rounded-lg">
            <div className="text-xs text-black/40 mb-1">Chain ID</div>
            <div className="text-xs">11155111</div>
          </div>
          <div className="p-3 bg-black/[0.02] rounded-lg">
            <div className="text-xs text-black/40 mb-1">Explorer</div>
            <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
              View
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
