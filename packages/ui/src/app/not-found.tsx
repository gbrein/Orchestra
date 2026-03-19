import Link from 'next/link'
import { Home, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── 404 Page ──────────────────────────────────────────────────────────────

export default function NotFoundPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-background px-6 text-center">
      {/* Orchestra wordmark */}
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary"
          aria-hidden
        >
          <span className="text-sm font-bold text-primary-foreground">O</span>
        </div>
        <span className="text-base font-semibold tracking-tight text-foreground">
          Orchestra
        </span>
      </div>

      {/* 404 content */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"
          aria-hidden
        >
          <SearchX className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-mono text-4xl font-bold tabular-nums text-foreground/20">
            404
          </p>
          <h1 className="text-lg font-semibold text-foreground">
            Page not found
          </h1>
          <p className="max-w-[320px] text-sm text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
      </div>

      {/* Home link */}
      <Link
        href="/"
        className={cn(
          'flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5',
          'text-sm font-medium text-primary-foreground',
          'transition-colors hover:bg-primary/90',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <Home className="h-4 w-4" aria-hidden />
        Back to Orchestra
      </Link>
    </div>
  )
}
