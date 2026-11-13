"use client";

import { useEffect, useState } from "react";

/* Flat illustrations drawn in SVG — no photos. One per step of the factory flow. */

const W = "#ffffff";
const SOFT = "rgba(255,255,255,0.18)";
const LINE = "rgba(255,255,255,0.55)";
const ACCENT = "#fbbf24";
const MINT = "#6ee7b7";

function Enquiry() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden>
      <rect x="40" y="60" width="150" height="180" rx="16" fill={SOFT} />
      <rect x="58" y="82" width="70" height="10" rx="5" fill={W} />
      {[0, 1, 2].map((r) => (
        <g key={r} transform={`translate(58 ${110 + r * 40})`}>
          <circle cx="10" cy="10" r="10" fill={r === 0 ? ACCENT : LINE} />
          <rect x="28" y="2" width="76" height="7" rx="3.5" fill={W} opacity={0.9} />
          <rect x="28" y="14" width="50" height="6" rx="3" fill={LINE} />
        </g>
      ))}
      <path d="M200 150 h40" stroke={W} strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />
      <path d="M236 140 l12 10 l-12 10" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(258 50) rotate(4)">
        <rect width="110" height="150" rx="12" fill={W} />
        <rect x="14" y="16" width="44" height="8" rx="4" fill="#93c5fd" />
        <text x="82" y="26" fontSize="16" fontWeight="700" fill="#1d4ed8" textAnchor="middle">₹</text>
        {[0, 1, 2, 3].map((r) => (
          <g key={r}>
            <rect x="14" y={44 + r * 18} width="52" height="6" rx="3" fill="#cbd5e1" />
            <rect x="76" y={44 + r * 18} width="20" height="6" rx="3" fill="#94a3b8" />
          </g>
        ))}
        <rect x="14" y="122" width="82" height="14" rx="7" fill="#2563eb" />
      </g>
      <circle cx="350" cy="214" r="22" fill={MINT} />
      <path d="M340 214 l7 7 l13 -14" fill="none" stroke="#065f46" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Production() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden>
      <path d="M40 250 V140 l60 35 V140 l60 35 V140 l60 35 V110 h40 v140 z" fill={SOFT} />
      <rect x="230" y="70" width="20" height="40" fill={SOFT} />
      <circle cx="248" cy="52" r="10" fill={LINE} opacity="0.6" />
      <circle cx="262" cy="36" r="14" fill={LINE} opacity="0.4" />
      {[70, 130, 190].map((x) => <rect key={x} x={x} y="200" width="26" height="22" rx="4" fill={W} opacity="0.85" />)}
      <g transform="translate(320 120)">
        {Array.from({ length: 8 }).map((_, k) => (
          <rect key={k} x="-7" y="-46" width="14" height="18" rx="3" fill={ACCENT} transform={`rotate(${k * 45})`} />
        ))}
        <circle r="34" fill={ACCENT} />
        <circle r="13" fill="#1e3a8a" />
      </g>
      <g transform="translate(270 190)">
        <rect width="110" height="72" rx="12" fill={W} />
        <rect x="12" y="12" width="50" height="7" rx="3.5" fill="#94a3b8" />
        <rect x="12" y="28" width="86" height="8" rx="4" fill="#e2e8f0" />
        <rect x="12" y="28" width="62" height="8" rx="4" fill="#10b981" />
        <rect x="12" y="46" width="86" height="8" rx="4" fill="#e2e8f0" />
        <rect x="12" y="46" width="34" height="8" rx="4" fill="#3b82f6" />
      </g>
      <rect x="20" y="250" width="360" height="4" rx="2" fill={LINE} />
    </svg>
  );
}

function Dispatch() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden>
      <rect x="20" y="236" width="360" height="4" rx="2" fill={LINE} />
      {[0, 1, 2, 3].map((k) => <rect key={k} x={40 + k * 70} y="246" width="40" height="4" rx="2" fill={SOFT} />)}
      <rect x="70" y="120" width="170" height="100" rx="10" fill={W} />
      <rect x="86" y="136" width="44" height="34" rx="4" fill="#fde68a" />
      <rect x="136" y="136" width="44" height="34" rx="4" fill="#fcd34d" />
      <rect x="186" y="136" width="40" height="34" rx="4" fill="#fde68a" />
      <path d="M240 150 h50 l34 36 v34 h-84 z" fill="#93c5fd" />
      <path d="M252 160 h32 l22 24 h-54 z" fill="#1e3a8a" opacity="0.5" />
      {[115, 285].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="222" r="20" fill="#1e293b" />
          <circle cx={cx} cy="222" r="8" fill="#cbd5e1" />
        </g>
      ))}
      {[140, 165, 190].map((y, k) => <rect key={y} x={20 + k * 6} y={y} width={36 - k * 8} height="4" rx="2" fill={LINE} />)}
      <circle cx="320" cy="90" r="30" fill={MINT} />
      <path d="M306 90 l10 10 l18 -20" fill="none" stroke="#065f46" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Insights() {
  const bars = [60, 95, 75, 130, 110, 160];
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden>
      <rect x="40" y="50" width="320" height="200" rx="18" fill={SOFT} />
      {[0, 1, 2].map((k) => (
        <g key={k} transform={`translate(${60 + k * 98} 70)`}>
          <rect width="86" height="40" rx="10" fill={W} />
          <rect x="10" y="10" width="34" height="6" rx="3" fill="#94a3b8" />
          <rect x="10" y="22" width="50" height="9" rx="4.5" fill={["#2563eb", "#10b981", "#f59e0b"][k]} />
        </g>
      ))}
      {bars.map((h, k) => (
        <rect key={k} x={74 + k * 40} y={230 - h * 0.7} width="24" height={h * 0.7} rx="6" fill={k === bars.length - 1 ? ACCENT : W} opacity={k === bars.length - 1 ? 1 : 0.85} />
      ))}
      <path d="M86 196 L126 172 L166 186 L206 150 L246 160 L286 122" fill="none" stroke={MINT} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="286" cy="122" r="7" fill={MINT} />
      <path d="M330 34 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5 l14 -5 z" fill={ACCENT} />
    </svg>
  );
}

const SLIDES = [
  { Art: Enquiry, title: "Enquiry to quotation", sub: "Log every RFQ and send priced quotes from your item master in minutes." },
  { Art: Production, title: "Production you can see", sub: "Job cards, machines, operators and output — live on one board." },
  { Art: Dispatch, title: "Dispatch on time", sub: "Track every order from confirmation to delivery and invoice." },
  { Art: Insights, title: "Know your numbers", sub: "Win rate, on-time delivery and rejects without spreadsheets." },
];

export function HeroCarousel() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
        <defs>
          <pattern id="hero-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="#fff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </svg>

      {SLIDES.map(({ Art }, idx) => (
        <div
          key={idx}
          className="absolute inset-x-8 top-20 bottom-48 transition-all duration-700 ease-out"
          style={{ opacity: idx === i ? 1 : 0, transform: `translateY(${idx === i ? 0 : 12}px)` }}
        >
          <Art />
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-28 px-8 text-white">
        <div className="mb-2 text-2xl font-semibold tracking-tight">{SLIDES[i].title}</div>
        <div className="max-w-xs text-sm text-white/80">{SLIDES[i].sub}</div>
      </div>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-1.5">
        {SLIDES.map((s, idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Show: ${s.title}`}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
