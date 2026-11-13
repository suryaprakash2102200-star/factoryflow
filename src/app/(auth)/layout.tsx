import Link from "next/link";
import { HeroCarousel } from "./HeroCarousel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-slate-100 p-3 sm:p-6">
      <div className="relative mx-auto flex h-full max-h-[860px] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Left hero panel */}
        <aside className="relative m-3 hidden w-[45%] shrink-0 overflow-hidden rounded-2xl lg:block">
          <HeroCarousel />
          <div className="absolute inset-0 flex flex-col justify-between p-8 text-white">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide">
                Selected Works
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/signup"
                  className="rounded-full px-4 py-1.5 text-xs font-medium text-white/90 transition hover:text-white"
                >
                  Sign Up
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-white/60 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
                >
                  Join Us
                </Link>
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-bold">
                  N
                </div>
                <div>
                  <div className="text-sm font-semibold">Kairo</div>
                  <div className="text-xs text-white/70">CRM &amp; Workflow</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowButton dir="left" />
                <ArrowButton dir="right" />
              </div>
            </div>
          </div>
        </aside>

        {/* Right form panel */}
        <section className="scrollbar-hide relative flex h-full w-full flex-col overflow-y-auto px-6 py-6 sm:px-12 sm:py-8 lg:w-[55%]">
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold tracking-widest text-slate-900">
              KAIRO<span className="text-blue-500">CRM</span>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span aria-hidden>🌐</span>
              EN
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center py-6">
            <div className="w-full max-w-sm">{children}</div>
          </div>

          <div className="flex items-center justify-center gap-3 text-slate-400">
            <SocialIcon label="Facebook">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" /></svg>
            </SocialIcon>
            <SocialIcon label="Twitter">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 5.8a8.4 8.4 0 0 1-2.4.7 4.1 4.1 0 0 0 1.8-2.3 8.3 8.3 0 0 1-2.6 1 4.1 4.1 0 0 0-7 3.7A11.7 11.7 0 0 1 3 4.8a4.1 4.1 0 0 0 1.3 5.5 4 4 0 0 1-1.9-.5v.1a4.1 4.1 0 0 0 3.3 4 4.1 4.1 0 0 1-1.9.1 4.1 4.1 0 0 0 3.8 2.9A8.2 8.2 0 0 1 2 18.6 11.6 11.6 0 0 0 8.3 20c7.5 0 11.7-6.3 11.7-11.7v-.6A8.4 8.4 0 0 0 22 5.8z"/></svg>
            </SocialIcon>
            <SocialIcon label="LinkedIn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5V9h3v10zM6.5 7.7a1.8 1.8 0 1 1 0-3.5 1.8 1.8 0 0 1 0 3.5zM19 19h-3v-5c0-1.2 0-2.7-1.6-2.7S12.5 12.5 12.5 14v5h-3V9h2.9v1.4h.1A3.2 3.2 0 0 1 15.4 9c3 0 3.6 2 3.6 4.6V19z"/></svg>
            </SocialIcon>
            <SocialIcon label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.4A4 4 0 1 1 12.6 8a4 4 0 0 1 3.4 3.4z"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>
            </SocialIcon>
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroArt() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 20% 30%, #f97316 0%, #9a3412 22%, #1e1b4b 55%, #020617 85%)",
      }}
    >
      {/* Stars */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 15%, white, transparent), radial-gradient(1px 1px at 80% 20%, white, transparent), radial-gradient(1px 1px at 45% 10%, white, transparent), radial-gradient(1px 1px at 70% 35%, white, transparent), radial-gradient(1px 1px at 10% 45%, white, transparent), radial-gradient(1.5px 1.5px at 90% 60%, white, transparent)",
          backgroundSize: "400px 400px",
        }}
      />
      {/* Moon */}
      <div
        className="absolute h-14 w-14 rounded-full"
        style={{
          top: "18%",
          right: "22%",
          background:
            "radial-gradient(circle at 35% 35%, #f1f5f9 0%, #cbd5e1 55%, #475569 100%)",
          boxShadow: "0 0 40px rgba(251, 191, 36, 0.25)",
        }}
      />
      {/* Mountain silhouettes */}
      <svg
        className="absolute bottom-0 left-0 right-0"
        viewBox="0 0 500 260"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "55%" }}
      >
        <defs>
          <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#0c0a09" />
          </linearGradient>
          <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="100%" stopColor="#1c1917" />
          </linearGradient>
        </defs>
        <path d="M0,180 L70,90 L120,140 L180,60 L240,130 L300,80 L370,150 L440,70 L500,130 L500,260 L0,260 Z" fill="url(#m2)" opacity="0.9" />
        <path d="M0,220 L60,160 L140,200 L210,140 L280,190 L360,150 L420,200 L500,170 L500,260 L0,260 Z" fill="url(#m1)" />
      </svg>
    </div>
  );
}

function ArrowButton({ dir }: { dir: "left" | "right" }) {
  return (
    <button
      type="button"
      aria-label={`${dir === "left" ? "Previous" : "Next"} slide`}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left" ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  );
}

function SocialIcon({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      {children}
    </button>
  );
}
