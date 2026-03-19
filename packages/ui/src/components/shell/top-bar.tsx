'use client'

import { useRef, useState } from 'react'
import { Music, Bell, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NotificationPanel } from '@/components/shell/notification-panel'
import { WorkspaceSwitcher, type Workspace } from '@/components/panels/workspace-switcher'
import { cn } from '@/lib/utils'
import type { OrchestraNotification } from '@/hooks/use-notifications'
import { useComplexity } from '@/hooks/use-complexity'

// ─── Types ─────────────────────────────────────────────────────────────────

export type TopBarTab = 'workspace' | 'discussions' | 'history'

export interface TopBarProps {
  readonly notifications?: readonly OrchestraNotification[]
  readonly unreadCount?: number
  readonly onAcknowledge?: (id: string) => void
  readonly onAcknowledgeAll?: () => void
  readonly onRemoveNotification?: (id: string) => void
  readonly onReviewApproval?: (notification: OrchestraNotification) => void
  readonly workspaces?: readonly Workspace[]
  readonly activeWorkspaceId?: string
  readonly onHomeClick?: () => void
  readonly onWorkspaceClick?: () => void
  readonly onSelectWorkspace?: (id: string) => void
  readonly onCreateWorkspace?: (name: string) => void
  readonly onDiscussionsClick?: () => void
  readonly onHistoryClick?: () => void
  readonly onSettingsClick?: () => void
  readonly activeTab?: TopBarTab
}

// ─── TopBar ────────────────────────────────────────────────────────────────

export function TopBar({
  notifications = [],
  unreadCount = 0,
  onAcknowledge,
  onAcknowledgeAll,
  onRemoveNotification,
  onReviewApproval,
  workspaces = [],
  activeWorkspaceId = '',
  onHomeClick,
  onWorkspaceClick,
  onSelectWorkspace,
  onCreateWorkspace,
  onDiscussionsClick,
  onHistoryClick,
  onSettingsClick,
  activeTab = 'workspace',
}: TopBarProps) {
  const { isSimple } = useComplexity()
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const bellButtonRef = useRef<HTMLButtonElement>(null)

  function toggleNotificationPanel() {
    setNotificationPanelOpen((prev) => !prev)
  }

  function closeNotificationPanel() {
    setNotificationPanelOpen(false)
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4">
      {/* Left: Logo + Workspace switcher */}
      <div className="flex items-center gap-3">
        <Music className="h-5 w-5 text-primary" aria-hidden />
        <span className="text-sm font-semibold">Orchestra</span>
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeId={activeWorkspaceId}
          onSelect={onSelectWorkspace ?? (() => {})}
          onCreateWorkspace={onCreateWorkspace ?? (() => {})}
        />
      </div>

      {/* Center: View tabs */}
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 text-xs',
            activeTab === 'workspace' && !onHomeClick
              ? 'font-medium text-foreground'
              : 'text-muted-foreground',
          )}
          onClick={onHomeClick}
        >
          Home
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 text-xs',
            activeTab === 'workspace'
              ? 'font-medium text-foreground'
              : 'text-muted-foreground',
          )}
          aria-current={activeTab === 'workspace' ? 'page' : undefined}
          onClick={onWorkspaceClick}
        >
          Workspace
        </Button>
        {!isSimple && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 text-xs',
              activeTab === 'discussions'
                ? 'font-medium text-foreground'
                : 'text-muted-foreground',
            )}
            aria-current={activeTab === 'discussions' ? 'page' : undefined}
            onClick={onDiscussionsClick}
          >
            Discussions
          </Button>
        )}
        {!isSimple && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 text-xs',
              activeTab === 'history'
                ? 'font-medium text-foreground'
                : 'text-muted-foreground',
            )}
            aria-current={activeTab === 'history' ? 'page' : undefined}
            onClick={onHistoryClick}
          >
            History
          </Button>
        )}
      </nav>

      {/* Right: Notifications + Settings */}
      <div className="flex items-center gap-2">
        {/* Bell icon with notification panel */}
        <div className="relative">
          <Button
            ref={bellButtonRef}
            variant="ghost"
            size="sm"
            className="relative h-8 w-8 p-0"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
            aria-expanded={notificationPanelOpen}
            aria-haspopup="true"
            onClick={toggleNotificationPanel}
          >
            <Bell className="h-4 w-4" aria-hidden />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center p-0 text-[10px]"
                aria-hidden
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>

          <NotificationPanel
            open={notificationPanelOpen}
            onClose={closeNotificationPanel}
            notifications={notifications}
            unreadCount={unreadCount}
            onAcknowledge={onAcknowledge ?? (() => undefined)}
            onAcknowledgeAll={onAcknowledgeAll ?? (() => undefined)}
            onRemove={onRemoveNotification ?? (() => undefined)}
            onReviewApproval={onReviewApproval}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Settings"
          onClick={onSettingsClick}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
