import Image from "next/image";
import Link from "next/link";

/* Login / signup always use the dark look from the design, whatever the app theme. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark auth-shell fixed inset-0 overflow-hidden bg-[#111113]">
      <div className="relative flex h-full w-full overflow-hidden bg-[#111113] text-white">
        {/* Form side */}
        <section className="scrollbar-hide relative flex h-full w-full flex-col overflow-y-auto px-6 py-6 sm:px-16 sm:py-10 lg:w-[42%]">
          <div className="flex items-center gap-8">
            <Link href="/login" className="flex items-center gap-2 text-lg font-semibold">
              <Spark />
              <span>Factory<span className="text-violet-400">Flow</span></span>
            </Link>
            <nav className="hidden gap-6 text-sm text-white/70 xl:flex">
              <span>Enquiries</span><span>Quotes</span><span>Production</span><span>Reports</span>
            </nav>
          </div>

          <div className="flex flex-1 items-center py-6">
            <div className="w-full max-w-sm">{children}</div>
          </div>
        </section>

        {/* Illustration side */}
        <aside className="relative hidden flex-1 items-center justify-center lg:flex">
          <Image src="/login-hero.png" alt="" width={1536} height={1024} priority className="h-auto w-full max-w-[900px] object-contain" />
        </aside>
      </div>
    </div>
  );
}

function Spark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      {Array.from({ length: 8 }).map((_, k) => (
        <rect key={k} x="11" y="1.5" width="2.4" height="6" rx="1.2" fill="#fff" transform={`rotate(${k * 45} 12.2 12)`} />
      ))}
      <circle cx="12.2" cy="12" r="3" fill="#a78bfa" />
    </svg>
  );
}
