"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { Shield, Lock, Key, FileLock, Eye, EyeOff, Upload, Download, Share2, Database, Zap, CheckCircle2, DollarSign, Clock, Users, FileText, ShieldCheck } from "lucide-react"

// ─── Intersection Observer hook ──────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView()
  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 1800
    const step = 16
    const increment = end / (duration / step)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, step)
    return () => clearInterval(timer)
  }, [inView, end])
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// ─── Bento card ──────────────────────────────────────────────────────────────
function BentoCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView(0.1)
  return (
    <div
      ref={ref}
      className={`group relative rounded-2xl border border-black/[0.07] bg-white overflow-hidden transition-all duration-700 hover:border-black/[0.15] hover:bg-[#fafaf8] ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms, border-color 0.3s ease, background-color 0.3s ease`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0,0,0,0.03), transparent 60%)" }}
      />
      {children}
    </div>
  )
}

// ─── Pill tag ─────────────────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] tracking-widest font-sans text-black/40 bg-black/[0.04]">
      {children}
    </span>
  )
}

// ─── Privacy Badge ────────────────────────────────────────────────────────────
function PrivacyBadge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/[0.03] border border-black/[0.06]">
      <Icon className="w-4 h-4 text-black/50" />
      <span className="text-xs text-black/60">{label}</span>
    </div>
  )
}

// ─── Wallet Button ────────────────────────────────────────────────────────────
function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [showMenu, setShowMenu] = useState(false)

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111] text-white text-xs hover:bg-[#333] transition-colors"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-black/[0.1] shadow-lg overflow-hidden z-50">
            <Link
              href="/dashboard"
              className="block px-4 py-3 text-xs hover:bg-black/[0.04] transition-colors"
              onClick={() => setShowMenu(false)}
            >
              Dashboard
            </Link>
            <button
              onClick={() => { disconnect(); setShowMenu(false) }}
              className="w-full text-left px-4 py-3 text-xs hover:bg-black/[0.04] transition-colors text-red-600"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="px-5 py-2.5 rounded-xl bg-[#111] text-white text-xs hover:bg-[#333] transition-colors tracking-wide"
    >
      Connect Wallet
    </button>
  )
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, description, delay = 0 }: { icon: any; title: string; description: string; delay?: number }) {
  const { ref, inView } = useInView(0.1)
  return (
    <div
      ref={ref}
      className="p-6 rounded-2xl border border-black/[0.07] bg-white hover:border-black/[0.12] hover:shadow-lg transition-all duration-300"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      <div className="w-12 h-12 rounded-xl bg-black/[0.04] flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-black/60" />
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-black/45 leading-relaxed">{description}</p>
    </div>
  )
}

// ─── How it works step ───────────────────────────────────────────────────────
function StepCard({ number, title, description, delay = 0 }: { number: string; title: string; description: string; delay?: number }) {
  const { ref, inView } = useInView(0.1)
  return (
    <div
      ref={ref}
      className="flex gap-4"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      <div className="w-12 h-12 rounded-full bg-[#111] text-white flex items-center justify-center text-sm font-medium shrink-0">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-medium mb-1">{title}</h3>
        <p className="text-sm text-black/45 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FhenixDropBoxPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [heroReady, setHeroReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 300)
    return () => clearTimeout(t)
  }, [])

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`)
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`)
  }

  return (
    <div className="bg-[#F5F4F0] text-[#111] min-h-screen font-sans antialiased">

      {/* ── STICKY NAV ────────────────────────────────────────────────────── */}
      <nav className="fixed top-4 inset-x-0 z-50 flex justify-center px-4">
        <div className="w-full max-w-4xl bg-white/80 backdrop-blur-xl border border-black/[0.08] rounded-2xl shadow-lg">
          <div className="flex items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#111]" />
              <span className="font-medium text-sm tracking-tight">FhenixDropBox</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-xs text-black/50 hover:text-black transition-colors tracking-wide">Features</Link>
              <Link href="#how-it-works" className="text-xs text-black/50 hover:text-black transition-colors tracking-wide">How it Works</Link>
              <Link href="#security" className="text-xs text-black/50 hover:text-black transition-colors tracking-wide">Security</Link>
              <Link href="/dashboard" className="text-xs text-black/50 hover:text-black transition-colors tracking-wide">Dashboard</Link>
            </div>

            <WalletButton />
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-32 pb-20 px-6 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F4F0] via-[#F0EEE8] to-[#E8E6E0]" />

        {/* Decorative elements */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#111]/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-[#111]/[0.02] rounded-full blur-3xl" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.04] mb-8"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.8s ease 0ms, transform 0.8s ease 0ms",
            }}
          >
            <Lock className="w-3 h-3 text-[#111]" />
            <span className="text-xs text-black/50 tracking-wide">Powered by Fhenix FHE Technology</span>
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light text-[#111] leading-[1.0] tracking-tight mb-8"
            style={{
              opacity: heroReady ? 1 : 0,
              filter: heroReady ? "blur(0px)" : "blur(24px)",
              transform: heroReady ? "translateY(0px)" : "translateY(32px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 100ms, filter 1s cubic-bezier(0.16,1,0.3,1) 100ms, transform 1s cubic-bezier(0.16,1,0.3,1) 100ms",
            }}
          >
            Share files with<br />
            <span className="font-medium">complete privacy</span>
          </h1>

          <p
            className="text-lg md:text-xl text-black/50 max-w-2xl mx-auto mb-12 leading-relaxed"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0px)" : "translateY(20px)",
              transition: "opacity 0.8s ease 200ms, transform 0.8s ease 200ms",
            }}
          >
            Decentralized file sharing with encrypted access control. Your data, your rules, zero exposure.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0px)" : "translateY(20px)",
              transition: "opacity 0.8s ease 400ms, transform 0.8s ease 400ms",
            }}
          >
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-xl bg-[#111] text-white text-sm hover:bg-[#333] transition-colors tracking-wide flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Start Sharing
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-4 rounded-xl border border-black/10 text-black/70 text-sm hover:border-black/20 hover:text-black transition-colors tracking-wide"
            >
              Learn More
            </Link>
          </div>

          {/* Stats */}
          <div
            className="flex gap-12 justify-center mt-20"
            style={{
              opacity: heroReady ? 1 : 0,
              transition: "opacity 0.8s ease 600ms",
            }}
          >
            {[
              { value: "100%", label: "Private" },
              { value: "0", label: "Data Exposed" },
              { value: "FHE", label: "Encryption" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl md:text-3xl font-medium text-[#111]">{stat.value}</div>
                <div className="text-xs text-black/40 tracking-widest uppercase mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY BADGES ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-black/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-4">
            <PrivacyBadge icon={Lock} label="Encrypted Prices" />
            <PrivacyBadge icon={Key} label="Hidden Passwords" />
            <PrivacyBadge icon={EyeOff} label="Private Access" />
            <PrivacyBadge icon={Shield} label="Confidential Payments" />
            <PrivacyBadge icon={Clock} label="Hidden Expiry" />
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Tag>FEATURES</Tag>
            <h2 className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              Privacy by design,<br />not by policy.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" onMouseMove={handleMouse}>
            <FeatureCard
              icon={Lock}
              title="Encrypted Access Control"
              description="Set prices, passwords, and access rules that are completely hidden from the blockchain. No one can see who accessed what."
              delay={0}
            />
            <FeatureCard
              icon={DollarSign}
              title="Confidential Payments"
              description="Validate payments without revealing amounts. Perfect for competitive pricing strategies and private transactions."
              delay={100}
            />
            <FeatureCard
              icon={FileLock}
              title="Secret-Based Unlock"
              description="Users unlock files using hidden codes. Verification happens on encrypted data without exposing the code."
              delay={200}
            />
            <FeatureCard
              icon={Clock}
              title="Encrypted Expiry & Limits"
              description="Set download limits and expiry times that are hidden from public view. Control when access ends privately."
              delay={300}
            />
            <FeatureCard
              icon={Database}
              title="Decentralized Storage"
              description="Files are encrypted locally and stored on IPFS. Only you and authorized users can access the content."
              delay={400}
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Enterprise Ready"
              description="Built for legal, business, and sensitive data sharing. Full privacy compliance without compromising usability."
              delay={500}
            />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Tag>HOW IT WORKS</Tag>
              <h2 className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05] mb-8">
                From upload to<br />private sharing
              </h2>

              <div className="space-y-8">
                <StepCard
                  number="1"
                  title="Upload & Encrypt"
                  description="Select your file. It's encrypted locally on your device before uploading to IPFS."
                  delay={0}
                />
                <StepCard
                  number="2"
                  title="Set Access Rules"
                  description="Define price, password, expiry, and download limits. These are encrypted with Fhenix FHE."
                  delay={100}
                />
                <StepCard
                  number="3"
                  title="Get Secure Link"
                  description="Receive a private shareable link. All access conditions remain hidden on-chain."
                  delay={200}
                />
                <StepCard
                  number="4"
                  title="Private Verification"
                  description="When someone accesses the file, all validations happen on encrypted data."
                  delay={300}
                />
                <StepCard
                  number="5"
                  title="Secure Download"
                  description="Access granted? File is decrypted locally for the authorized user only."
                  delay={400}
                />
              </div>
            </div>

            <div className="relative">
              <BentoCard className="p-8 min-h-[400px]">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 pb-4 border-b border-black/[0.06]">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Privacy Layer</div>
                      <div className="text-xs text-black/40">Everything is encrypted</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "Price", value: "████ USDC", visible: false },
                      { label: "Password", value: "••••••••", visible: false },
                      { label: "Downloads Left", value: "██/10", visible: false },
                      { label: "Expires", value: "████-██-██", visible: false },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-black/[0.02]">
                        <span className="text-xs text-black/40">{item.label}</span>
                        <span className="text-xs font-mono text-black/60">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-black/[0.06]">
                    <div className="flex items-center gap-2 text-xs text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Access rules are encrypted on-chain</span>
                    </div>
                  </div>
                </div>
              </BentoCard>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY ──────────────────────────────────────────────────────── */}
      <section id="security" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Tag>SECURITY</Tag>
            <h2 className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              Why privacy matters
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <BentoCard className="p-8" delay={0}>
              <div className="text-4xl mb-4">❌</div>
              <h3 className="text-lg font-medium mb-3">Traditional Web3</h3>
              <ul className="space-y-2 text-sm text-black/50">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  File prices are public
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  Who accessed what is visible
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  Payment amounts exposed
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  Access rules readable by anyone
                </li>
              </ul>
            </BentoCard>

            <BentoCard className="p-8" delay={100}>
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-lg font-medium mb-3">FhenixDropBox</h3>
              <ul className="space-y-2 text-sm text-black/50">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  Prices hidden with FHE encryption
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  Access logs completely private
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  Payment amounts confidential
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 h-1 rounded-full bg-emerald-500" />
                  Access rules encrypted always
                </li>
              </ul>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── USE CASES ─────────────────────────────────────────────────────── */}
      <section className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Tag>USE CASES</Tag>
            <h2 className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              Built for real-world privacy
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" onMouseMove={handleMouse}>
            {[
              { icon: FileText, title: "Legal Documents", desc: "Share sensitive legal files with clients securely" },
              { icon: Users, title: "Enterprise Data", desc: "Distribute internal data without exposure" },
              { icon: DollarSign, title: "Premium Content", desc: "Monetize content without revealing pricing" },
            ].map((item, i) => (
              <BentoCard key={i} className="p-6" delay={i * 80}>
                <item.icon className="w-6 h-6 text-black/40 mb-4" />
                <h3 className="text-base font-medium mb-2">{item.title}</h3>
                <p className="text-sm text-black/45">{item.desc}</p>
              </BentoCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#111] to-[#333]" />
        <div className="relative z-10 max-w-2xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-light tracking-tight leading-[1.05] mb-6">
            Start sharing privately today.
          </h2>
          <p className="text-sm text-white/60 leading-relaxed mb-10">
            Join the privacy revolution. Upload your first file and experience truly private file sharing.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-[#111] text-sm hover:bg-white/90 transition-colors tracking-wide"
          >
            <Upload className="w-4 h-4" />
            Get Started
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-black/50" />
            <span className="text-xs tracking-[0.2em] text-black/50">FHENIXDROPBOX</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link href="#features" className="text-xs text-black/35 hover:text-black/70 transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-xs text-black/35 hover:text-black/70 transition-colors">How it Works</Link>
            <Link href="#security" className="text-xs text-black/35 hover:text-black/70 transition-colors">Security</Link>
            <Link href="/dashboard" className="text-xs text-black/35 hover:text-black/70 transition-colors">Dashboard</Link>
          </div>

          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-black/25 hover:text-black/55 transition-colors">Privacy</a>
            <a href="#" className="text-xs text-black/25 hover:text-black/55 transition-colors">Terms</a>
            <a href="https://fhenix.zone" target="_blank" rel="noopener noreferrer" className="text-xs text-black/25 hover:text-black/55 transition-colors">Fhenix</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-black/[0.04]">
          <span className="text-xs text-black/20">© 2024 FhenixDropBox. Powered by Fhenix FHE.</span>
        </div>
      </footer>
    </div>
  )
}
