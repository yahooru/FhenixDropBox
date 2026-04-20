"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { Shield, LayoutDashboard, Upload, FolderOpen, Share2, Settings, Wallet, LogOut, Menu, X } from "lucide-react"
import { useState, useEffect } from "react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/files", label: "My Files", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isConnected) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111] flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-medium mb-3">Connect Your Wallet</h1>
          <p className="text-sm text-black/50 mb-8">
            Connect your wallet to access the FhenixDropBox dashboard and start sharing files privately.
          </p>
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="w-full px-6 py-4 rounded-xl bg-[#111] text-white text-sm hover:bg-[#333] transition-colors flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F4F0] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-black/[0.08] fixed inset-y-0 left-0">
        <div className="p-6 border-b border-black/[0.06]">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#111]" />
            <span className="font-medium text-sm">FhenixDropBox</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-[#111] text-white"
                    : "text-black/60 hover:bg-black/[0.04] hover:text-black"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-black/[0.06]">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-black/50">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
            <button
              onClick={() => disconnect()}
              className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors"
              title="Disconnect"
            >
              <LogOut className="w-4 h-4 text-black/30" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 bg-white border-b border-black/[0.08]">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#111]" />
            <span className="font-medium text-sm">FhenixDropBox</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-black/[0.04]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="p-4 border-t border-black/[0.06] bg-white">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                    isActive
                      ? "bg-[#111] text-white"
                      : "text-black/60 hover:bg-black/[0.04]"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
