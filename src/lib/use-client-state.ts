"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true after hydration, false during SSR — without setState-in-effect. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

const EVT = "local-pref-change";

/** A boolean preference backed by localStorage, safe for SSR. */
export function useLocalFlag(key: string): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      window.addEventListener(EVT, cb);
      return () => {
        window.removeEventListener("storage", cb);
        window.removeEventListener(EVT, cb);
      };
    },
    () => {
      try {
        return localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event(EVT));
  };
  return [value, set];
}
