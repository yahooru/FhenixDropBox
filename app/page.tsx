"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { Shield, Lock, Key, Upload, Database, Eye, EyeOff, CheckCircle2, FileText, ChevronDown, FolderPlus, Link2, Download, Share2, Settings } from "lucide-react"
import { IntroAnimation, INTRO_DURATION_MS, HERO_REVEAL_MS } from "@/components/intro-animation"

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
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-black/[0.1] shadow-lg overflow-hidden z-50">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-3 text-xs hover:bg-black/[0.04] transition-colors"
              onClick={() => setShowMenu(false)}
            >
              <FileText className="w-4 h-4" />
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FhenixDropBoxPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [heroReady, setHeroReady] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  const handleIntroDone = useCallback(() => {
    setHeroReady(true)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setVideoReady(true), HERO_REVEAL_MS)
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

      {/* ── INTRO ANIMATION ───────────────────────────────────────────────── */}
      <IntroAnimation onDone={handleIntroDone} />

      {/* ── STICKY NAV ────────────────────────────────────────────────────── */}
      <nav className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-3xl">

          {/* Main bar */}
          <div
            className="flex items-center justify-between px-5 py-3 rounded-2xl border border-black/[0.06]"
            style={{
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              background: "rgba(245,244,240,0.30)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <Link href="/" className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#111]" />
              <span className="text-xs tracking-[0.15em] text-black/70 font-medium">FHENIXDROPBOX</span>
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-7">
              <Link href="#features" className="text-[11px] text-black/60 hover:text-black transition-colors duration-200 tracking-wide">Features</Link>
              <Link href="#how-it-works" className="text-[11px] text-black/60 hover:text-black transition-colors duration-200 tracking-wide">How it Works</Link>
              <Link href="/dashboard" className="text-[11px] text-black/60 hover:text-black transition-colors duration-200 tracking-wide">Dashboard</Link>
            </div>

            <WalletButton />
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative h-screen overflow-hidden">

        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/agentic-hero-9yW3wnTNMfn2U6lsVhTTZSJFEvAoSj.mp4"
          style={{
            transform: videoReady ? "scale(1.05)" : "scale(0.85)",
            transition: "transform 2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {/* Progressive blur + light gradient rising from bottom */}
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ height: "65%", background: "linear-gradient(to top, #F5F4F0 0%, #F5F4F0 18%, rgba(245,244,240,0.85) 35%, rgba(245,244,240,0.5) 55%, rgba(245,244,240,0.15) 75%, transparent 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ height: "20%", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", maskImage: "linear-gradient(to top, black 0%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ height: "38%", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", maskImage: "linear-gradient(to top, black 0%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ height: "55%", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", maskImage: "linear-gradient(to top, black 0%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 100%)" }} />

        {/* Spacer so hero content doesn't sit under the fixed nav */}
        <div className="h-20" />

        {/* Title + metrics — anchored to bottom left */}
        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col px-6 md:px-12 pb-12 max-w-3xl">
          {/* Title */}
          <h1
            className="text-6xl sm:text-7xl md:text-8xl font-light text-[#111] leading-[1.0] tracking-tight mb-10"
            style={{
              fontFamily: '"IBM Plex Sans", sans-serif',
              opacity: heroReady ? 1 : 0,
              filter: heroReady ? "blur(0px)" : "blur(24px)",
              transform: heroReady ? "translateY(0px)" : "translateY(32px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 0ms, filter 1s cubic-bezier(0.16,1,0.3,1) 0ms, transform 1s cubic-bezier(0.16,1,0.3,1) 0ms",
            }}
          >
            Share files with<br />complete privacy.<br />Zero exposure.
          </h1>

          {/* CTA buttons */}
          <div
            className="flex gap-4 mb-8"
            style={{
              opacity: heroReady ? 1 : 0,
              transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${200}ms`,
            }}
          >
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-xl bg-[#111] text-white text-sm hover:bg-[#333] transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Start Sharing
            </Link>
          </div>

          {/* 3 metrics — staggered after title */}
          <div className="flex gap-8 sm:gap-12">
            {[
              { value: "100%", label: "Private" },
              { value: "FHE", label: "Encryption" },
              { value: "0", label: "Data Exposed" },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  opacity: heroReady ? 1 : 0,
                  filter: heroReady ? "blur(0px)" : "blur(16px)",
                  transform: heroReady ? "translateY(0px)" : "translateY(20px)",
                  transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${120 + i * 80}ms, filter 0.8s cubic-bezier(0.16,1,0.3,1) ${120 + i * 80}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${120 + i * 80}ms`,
                }}
              >
                <div className="text-3xl sm:text-4xl text-[#111] font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>{stat.value}</div>
                <div className="text-xs text-black/40 tracking-widest uppercase mt-1" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLATFORM OVERVIEW (bento) ──────────────────────────────────────── */}
      <section id="features" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <Tag>PLATFORM</Tag>
            <h2 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
              Privacy-first file sharing<br />built on Fhenix.
            </h2>
          </div>

          <div className="grid grid-cols-12 grid-rows-auto gap-3" onMouseMove={handleMouse}>
            {/* Big left card */}
            <BentoCard className="col-span-12 p-8 min-h-[200px] flex flex-col justify-between relative overflow-hidden" delay={0}>
              <img
                src="/images/arc.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: "center 70%" }}
              />
              <div className="absolute inset-0" style={{
                maskImage: "linear-gradient(to bottom, transparent 45%, black 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 45%, black 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }} />
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, transparent 35%, rgba(245,244,240,0.3) 50%, rgba(245,244,240,0.75) 65%, rgba(245,244,240,0.95) 80%, rgb(245,244,240) 100%)",
                }}
              />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl border border-black/10 bg-white/60 flex items-center justify-center mb-6" style={{ backdropFilter: "blur(8px)" }}>
                  <Lock className="w-5 h-5 text-black/60" />
                </div>
                <h3 className="text-xl font-light mb-3">Encrypted Access Control</h3>
                <p className="text-sm text-black/45 leading-relaxed max-w-sm">
                  All file prices, passwords, and access rules are encrypted using Fhenix FHE. No one can see your data.
                </p>
              </div>
            </BentoCard>

            {/* Bottom row */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={120}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <Key className="w-5 h-5 text-black/60" />
              </div>
              <h3 className="text-lg font-light mb-2">Secret-Based Unlock</h3>
              <p className="text-sm text-black/45 leading-relaxed">Passwords are verified without being exposed. Zero knowledge verification.</p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={160}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <EyeOff className="w-5 h-5 text-black/60" />
              </div>
              <h3 className="text-lg font-light mb-2">Private Downloads</h3>
              <p className="text-sm text-black/45 leading-relaxed">Download counts and access logs are hidden. Complete privacy.</p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={200}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <Database className="w-5 h-5 text-black/60" />
              </div>
              <h3 className="text-lg font-light mb-2">Decentralized Storage</h3>
              <p className="text-sm text-black/45 leading-relaxed">Files encrypted and stored on IPFS. Only you control the keys.</p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <Tag>HOW IT WORKS</Tag>
            <h2 className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              From upload to private sharing<br />in five steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3" onMouseMove={handleMouse}>
            {[
              { n: "01", title: "Upload", desc: "Select your file. It's encrypted locally before uploading to IPFS.", delay: 0 },
              { n: "02", title: "Set Rules", desc: "Define access conditions. All are encrypted with Fhenix FHE.", delay: 80 },
              { n: "03", title: "Share Link", desc: "Get a private shareable link. Access rules stay hidden.", delay: 140 },
              { n: "04", title: "Verify", desc: "Access requests are verified on encrypted data.", delay: 200 },
              { n: "05", title: "Download", desc: "Access granted? File is decrypted locally for the user only.", delay: 260 },
            ].map((step) => (
              <BentoCard key={step.n} className="relative overflow-hidden flex flex-col min-h-[280px]" delay={step.delay}>
                <div className="relative z-10 p-7">
                  <span className="text-[11px] text-black/20 tracking-widest block">{step.n}</span>
                </div>
                <div className="relative z-10 px-7 pb-7 mt-auto">
                  <h3 className="text-2xl font-light mb-3">{step.title}</h3>
                  <p className="text-sm text-black/45 leading-relaxed">{step.desc}</p>
                </div>
              </BentoCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY BADGES ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-black/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { icon: Lock, label: "Encrypted Prices" },
              { icon: Key, label: "Hidden Passwords" },
              { icon: EyeOff, label: "Private Access" },
              { icon: Shield, label: "Confidential Payments" },
              { icon: Clock, label: "Hidden Expiry" },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/[0.03] border border-black/[0.06]">
                <badge.icon className="w-4 h-4 text-black/50" />
                <span className="text-xs text-black/60">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] overflow-hidden">
        <img
          src="/images/footer.png"
          alt=""
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-full object-cover object-bottom pointer-events-none select-none"
          style={{ opacity: 0.85 }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            maskImage: "linear-gradient(to top, transparent 0%, black 55%)",
            WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 55%)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgb(245,244,240) 0%, rgba(245,244,240,0.92) 18%, rgba(245,244,240,0.55) 35%, transparent 55%)",
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05] mb-6">
            Start sharing privately today.
          </h2>
          <p className="text-sm text-black/45 leading-relaxed mb-10">
            Join the privacy revolution. Upload your first file and experience truly private file sharing.
          </p>
          {!submitted ? (
            <form
              onSubmit={e => { e.preventDefault(); if (email) setSubmitted(true) }}
              className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
            >
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="flex-1 bg-white border border-black/10 rounded-xl px-4 py-3 text-sm text-[#111] placeholder:text-black/25 focus:outline-none focus:border-black/25 transition-colors"
              />
              <Link
                href="/dashboard"
                className="px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                GET STARTED
              </Link>
            </form>
          ) : (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-600/20 bg-emerald-50 text-emerald-700 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {"You're on the list. We'll be in touch."}
            </div>
          )}
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
            <Link href="#features" className="text-xs text-black/35 hover:text-black/70 transition-colors tracking-widest">Features</Link>
            <Link href="#how-it-works" className="text-xs text-black/35 hover:text-black/70 transition-colors tracking-widest">How it Works</Link>
            <Link href="/dashboard" className="text-xs text-black/35 hover:text-black/70 transition-colors tracking-widest">Dashboard</Link>
          </div>

          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-black/25 hover:text-black/55 transition-colors tracking-widest">Privacy</a>
            <a href="#" className="text-xs text-black/25 hover:text-black/55 transition-colors tracking-widest">Terms</a>
            <a href="https://fhenix.zone" target="_blank" rel="noopener noreferrer" className="text-xs text-black/25 hover:text-black/55 transition-colors tracking-widest">Fhenix</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-black/[0.04]">
          <span className="text-xs text-black/20">2024 FhenixDropBox. Powered by Fhenix FHE.</span>
        </div>
      </footer>
    </div>
  )
}
