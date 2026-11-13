"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thin top progress bar. Shows whenever the user clicks a link and the next
 * page hasn't rendered yet. We detect navigation start by intercepting
 * link clicks on document, and stop on pathname/search change.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop when route actually changes
  useEffect(() => {
    if (active) {
      setProgress(100);
      const t = setTimeout(() => {
        setActive(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search?.toString()]);

  // Detect navigation start from internal link clicks
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;
      if (href.startsWith("http") || href.startsWith("//")) return;
      if (href.startsWith("#") || target.target === "_blank") return;
      if (target.hasAttribute("download")) return;
      // Same URL? ignore
      const next = new URL(href, window.location.href);
      if (
        next.pathname === window.location.pathname &&
        next.search === window.location.search
      ) {
        return;
      }
      start();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    setActive(true);
    setProgress(10);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        return p + Math.max(1, (90 - p) * 0.08);
      });
    }, 120);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!active && progress === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)] transition-[width,opacity] duration-150 ease-out"
        style={{ width: `${progress}%`, opacity: active ? 1 : 0 }}
      />
    </div>
  );
}
