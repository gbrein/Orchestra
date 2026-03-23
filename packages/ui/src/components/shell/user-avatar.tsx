'use client'

import { useState, useRef, useEffect } from 'react'
import { LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  readonly onSettingsClick?: () => void
}

export function UserAvatar({ onSettingsClick }: UserAvatarProps) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  if (!user) return null

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
          user.image
            ? 'overflow-hidden'
            : 'bg-primary/10 text-primary hover:bg-primary/20',
        )}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user.image ? (
          <img src={user.image} alt="" className="h-full w-full object-cover" />
        ) : (
          initials || '?'
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-card py-1 shadow-lg"
          role="menu"
        >
          {/* User info */}
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>

          {/* Menu items */}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            onClick={() => {
              setOpen(false)
              onSettingsClick?.()
            }}
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            Settings
          </button>
          <div className="border-t border-border" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
