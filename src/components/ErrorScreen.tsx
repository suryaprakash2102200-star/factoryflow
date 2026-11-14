import Link from "next/link";

/** Full-page message for server errors (500) and missing pages (404). */
export function ErrorScreen({
  code,
  title,
  message,
  digest,
  onRetry,
}: {
  code: string;
  title: string;
  message: string;
  digest?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className={`text-6xl font-bold ${code === "500" ? "text-rose-500" : "text-violet-500"}`}>{code}</div>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        {digest && (
          <p className="mt-3 font-mono text-xs text-slate-400">
            Error ID: {digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          {onRetry && (
            <button onClick={onRetry} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
              Try again
            </button>
          )}
          <Link href="/" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
