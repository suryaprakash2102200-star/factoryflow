"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  {
    img: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
    title: "Close deals faster",
    sub: "Track every lead through your pipeline with clarity.",
  },
  {
    img: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80",
    title: "Built for your team",
    sub: "Assign, collaborate, and win customers together.",
  },
  {
    img: "https://images.unsplash.com/photo-1460472178825-e5240623afd5?auto=format&fit=crop&w=1200&q=80",
    title: "Insights that matter",
    sub: "Turn customer data into your next big decision.",
  },
  {
    img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
    title: "Grow with confidence",
    sub: "Every interaction, every account — in one workspace.",
  },
];

export function HeroCarousel() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0">
      {SLIDES.map((s, idx) => (
        <div
          key={idx}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: idx === i ? 1 : 0 }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${s.img})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/50 to-slate-950/80" />
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-28 px-8 text-white">
        <div className="mb-2 text-2xl font-semibold tracking-tight">
          {SLIDES[i].title}
        </div>
        <div className="max-w-xs text-sm text-white/80">{SLIDES[i].sub}</div>
      </div>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-1.5">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Slide ${idx + 1}`}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${
              idx === i ? "w-6 bg-white" : "w-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
