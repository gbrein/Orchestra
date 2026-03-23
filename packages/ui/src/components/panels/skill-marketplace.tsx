'use client'

import { useState, useMemo, useCallback } from 'react'
import { apiPost, apiDelete } from '@/lib/api'
import {
  Search,
  Check,
  Box,
  Tag,
  GitBranch,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  PackageOpen,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { SkillDetail } from './skill-detail'
import type { Skill } from '@orchestra/shared'

// ---------------------------------------------------------------------------
// Mock marketplace data — replaced by API integration in production
// ---------------------------------------------------------------------------

const MOCK_SKILLS: readonly Skill[] = [
  {
    id: 'skill-github-copilot',
    name: 'GitHub Tools',
    description: 'Search repos, create issues, review pull requests, and manage GitHub workflows directly from your assistant.',
    source: 'marketplace',
    gitUrl: null,
    path: '/skills/github-tools',
    version: '2.1.0',
    author: 'Orchestra Team',
    category: 'Development',
    icon: null,
    mcpConfig: null,
    installedAt: '',
  },
  {
    id: 'skill-web-search',
    name: 'Web Search',
    description: 'Search the web in real time using Exa or Perplexity. Ground your assistant\'s responses with fresh, cited sources.',
    source: 'marketplace',
    gitUrl: null,
    path: '/skills/web-search',
    version: '1.4.2',
    author: 'Orchestra Team',
    category: 'Research',
    icon: null,
    mcpConfig: null,
    installedAt: '',
  },
  {
    id: 'skill-code-runner',
    name: 'Code Runner',
    description: 'Execute Python, Node.js, and shell scripts in a sandboxed environment. Ideal for data analysis and automation tasks.',
    source: 'marketplace',
    gitUrl: null,
    path: '/skills/code-runner',
    version: '1.0.5',
    author: 'Orchestra Team',
    category: 'Development',
    icon: null,
    mcpConfig: null,
    installedAt: '',
  },
  {
    id: 'skill-document-writer',
    name: 'Document Writer',
    description: 'Generate professional documents, reports, and emails with consistent formatting, tone, and style guidelines.',
    source: 'marketplace',
    gitUrl: null,
    path: '/skills/document-writer',
    version: '1.2.0',
    author: 'Orchestra Team',
    category: 'Writing',
    icon: null,
    mcpConfig: null,
    installedAt: '',
  },
  {
    id: 'skill-data-analysis',
    name: 'Data Analysis',
    description: 'Analyze datasets, generate charts, and produce statistical summaries. Integrates with CSV, JSON, and SQL sources.',
    source: 'marketplace',
    gitUrl: null,
    path: '/skills/data-analysis',
    version: '1.1.3',
    author: 'Orchestra Team',
    category: 'Analysis',
    icon: null,
    mcpConfig: null,
    installedAt: '',
  },
  {
    id: 'skill-meeting-notes',
    name: 'Meeting Notes',
    description: 'Summarize meeting transcripts, extract action items, and draft follow-up messages automatically.',
    source: 'marketplace',
    gitUrl: null,
    path: '/skills/meeting-notes',
    version: '1.0.1',
    author: 'Community',
    category: 'Writing',
    icon: null,
    mcpConfig: null,
    installedAt: '',
  },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = 'All' | 'Development' | 'Writing' | 'Analysis' | 'Research'

type ImportStatus = 'idle' | 'loading' | 'success' | 'error'

export interface SkillMarketplaceProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: readonly Category[] = ['All', 'Development', 'Writing', 'Analysis', 'Research']

const CATEGORY_COLORS: Record<string, string> = {
  Development: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Writing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Analysis: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Research: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  Data: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryColor(category: string | null): string {
  if (!category) return 'bg-muted text-muted-foreground border-border'
  return CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground border-border'
}

function matchesSearch(skill: Skill, query: string): boolean {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  return (
    skill.name.toLowerCase().includes(q) ||
    skill.description.toLowerCase().includes(q) ||
    (skill.category?.toLowerCase().includes(q) ?? false)
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SkillCardProps {
  readonly skill: Skill
  readonly isInstalled: boolean
  readonly onInstall: (skillId: string) => Promise<void>
  readonly onClick: () => void
}

function SkillCard({ skill, isInstalled, onInstall, onClick }: SkillCardProps) {
  const [installing, setInstalling] = useState(false)

  async function handleInstallClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (isInstalled) return
    setInstalling(true)
    try {
      await onInstall(skill.id)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={cn(
        'w-full cursor-pointer rounded-lg border bg-card p-4 text-left transition-colors',
        'hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      aria-label={`View details for ${skill.name}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted"
          aria-hidden
        >
          {skill.icon ? (
            <span className="text-xl">{skill.icon}</span>
          ) : (
            <Box className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold leading-none">{skill.name}</span>
            {skill.category && (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                  getCategoryColor(skill.category),
                )}
              >
                <Tag className="h-2 w-2" />
                {skill.category}
              </span>
            )}
          </div>

          <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {skill.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
              {skill.author && <span>{skill.author}</span>}
              {skill.version && (
                <>
                  <span aria-hidden>·</span>
                  <span>v{skill.version}</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleInstallClick}
              disabled={isInstalled || installing}
              aria-label={isInstalled ? `${skill.name} is installed` : `Install ${skill.name}`}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                isInstalled
                  ? 'cursor-default bg-emerald-500/15 text-emerald-400'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                installing && 'opacity-70',
              )}
            >
              {isInstalled ? (
                <>
                  <Check className="h-3 w-3" />
                  Installed
                </>
              ) : installing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Installing
                </>
              ) : (
                'Install'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Browse Tab
// ---------------------------------------------------------------------------

interface BrowseTabProps {
  readonly skills: readonly Skill[]
  readonly installedSkillIds: ReadonlySet<string>
  readonly onInstall: (skillId: string) => Promise<void>
  readonly onViewDetail: (skill: Skill) => void
}

function BrowseTab({ skills, installedSkillIds, onInstall, onViewDetail }: BrowseTabProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')

  const filtered = useMemo(() => {
    return skills.filter((skill) => {
      const categoryMatch =
        activeCategory === 'All' || skill.category === activeCategory
      return categoryMatch && matchesSearch(skill, search)
    })
  }, [skills, search, activeCategory])

  return (
    <div className="flex flex-col gap-3 py-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="pl-8 text-sm"
          aria-label="Search skills"
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            aria-pressed={activeCategory === cat}
            className={cn(
              'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
              activeCategory === cat
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Skill list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No skills match &ldquo;{search}&rdquo;
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2" role="list" aria-label="Available skills">
          {filtered.map((skill) => (
            <div key={skill.id} role="listitem">
              <SkillCard
                skill={skill}
                isInstalled={installedSkillIds.has(skill.id)}
                onInstall={onInstall}
                onClick={() => onViewDetail(skill)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Installed Tab
// ---------------------------------------------------------------------------

interface InstalledTabProps {
  readonly skills: readonly Skill[]
  readonly onUninstall: (skillId: string) => Promise<void>
}

function InstalledTab({ skills, onUninstall }: InstalledTabProps) {
  const [uninstallingIds, setUninstallingIds] = useState<ReadonlySet<string>>(new Set())

  async function handleUninstall(skillId: string) {
    setUninstallingIds((prev) => new Set([...Array.from(prev), skillId]))
    try {
      await onUninstall(skillId)
    } finally {
      setUninstallingIds((prev) => {
        const next = new Set(Array.from(prev))
        next.delete(skillId)
        return next
      })
    }
  }

  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <PackageOpen className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">No skills installed yet</p>
          <p className="text-xs text-muted-foreground">
            Browse the marketplace to add abilities!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 py-4" role="list" aria-label="Installed skills">
      {skills.map((skill) => {
        const isUninstalling = uninstallingIds.has(skill.id)
        return (
          <div
            key={skill.id}
            role="listitem"
            className="flex items-center gap-3 rounded-lg border bg-card p-3"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted"
              aria-hidden
            >
              {skill.icon ? (
                <span className="text-lg">{skill.icon}</span>
              ) : (
                <Box className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-none">{skill.name}</p>
              {skill.category && (
                <span
                  className={cn(
                    'mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                    getCategoryColor(skill.category),
                  )}
                >
                  {skill.category}
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleUninstall(skill.id)}
              disabled={isUninstalling}
              aria-label={`Uninstall ${skill.name}`}
              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
            >
              {isUninstalling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import Tab
// ---------------------------------------------------------------------------

function ImportTab({ onImportSuccess }: { readonly onImportSuccess: (skill: Skill) => void }) {
  const [gitUrl, setGitUrl] = useState('')
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleImport() {
    const url = gitUrl.trim()
    if (!url) return

    setStatus('loading')
    setMessage(null)

    try {
      const skill = await apiPost<Skill>('/api/skills/import', { gitUrl: url })
      setStatus('success')
      setMessage(`"${skill.name}" imported successfully.`)
      setGitUrl('')
      onImportSuccess(skill)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Import failed')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleImport()
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="git-url-input"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          Git Repository URL
        </label>
        <p className="text-xs text-muted-foreground">
          Import a custom skill from a Git repository.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          id="git-url-input"
          value={gitUrl}
          onChange={(e) => setGitUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://github.com/user/skill-repo"
          className="font-mono text-xs"
          disabled={status === 'loading'}
          aria-label="Git repository URL"
        />
        <Button
          onClick={() => void handleImport()}
          disabled={!gitUrl.trim() || status === 'loading'}
          size="sm"
          className="shrink-0 gap-1.5"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Importing
            </>
          ) : (
            <>
              <GitBranch className="h-3.5 w-3.5" />
              Import
            </>
          )}
        </Button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs',
            status === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive',
          )}
          role="status"
          aria-live="polite"
        >
          {status === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          {message}
        </div>
      )}

      <Separator />

      {/* Requirements note */}
      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="mb-2 font-medium text-foreground/80">Requirements</p>
        <ul className="flex flex-col gap-1.5 pl-1">
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-muted-foreground/50" aria-hidden>•</span>
            Repository must contain a <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">SKILL.md</code> file at the root
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-muted-foreground/50" aria-hidden>•</span>
            Repository must be publicly accessible or credentials configured
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-muted-foreground/50" aria-hidden>•</span>
            A <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">package.json</code> or <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">mcp.json</code> defines available tools
          </li>
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SkillMarketplace({ open, onOpenChange }: SkillMarketplaceProps) {
  const [activeTab, setActiveTab] = useState('browse')
  const [installedSkillIds, setInstalledSkillIds] = useState<ReadonlySet<string>>(new Set())
  const [allSkills, setAllSkills] = useState<readonly Skill[]>(MOCK_SKILLS)
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)

  const installedSkills = useMemo(
    () => allSkills.filter((s) => installedSkillIds.has(s.id)),
    [allSkills, installedSkillIds],
  )

  const handleInstall = useCallback(async (skillId: string) => {
    await apiPost('/api/skills/install', { skillId })
    setInstalledSkillIds((prev) => new Set([...Array.from(prev), skillId]))
  }, [])

  const handleUninstall = useCallback(async (skillId: string) => {
    await apiDelete(`/api/skills/${skillId}`)
    setInstalledSkillIds((prev) => {
      const next = new Set(Array.from(prev))
      next.delete(skillId)
      return next
    })
  }, [])

  const handleImportSuccess = useCallback((skill: Skill) => {
    setAllSkills((prev) => {
      const exists = prev.some((s) => s.id === skill.id)
      return exists ? prev : [...prev, skill]
    })
    setInstalledSkillIds((prev) => new Set([...Array.from(prev), skill.id]))
    setActiveTab('installed')
  }, [])

  const handleViewDetail = useCallback((skill: Skill) => {
    setSelectedSkill(skill)
  }, [])

  const handleBackFromDetail = useCallback(() => {
    setSelectedSkill(null)
  }, [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[400px] flex-col gap-0 p-0"
        aria-label="Skill Marketplace"
      >
        {selectedSkill ? (
          <SkillDetail
            skill={selectedSkill}
            installedSkillIds={installedSkillIds}
            onBack={handleBackFromDetail}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
          />
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="text-base font-semibold">Skill Marketplace</SheetTitle>
              <SheetDescription className="sr-only">
                Browse, install, and manage skills for your assistants
              </SheetDescription>
            </SheetHeader>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="mx-5 mt-3 w-auto justify-start rounded-none border-b bg-transparent p-0">
                {(['browse', 'installed', 'import'] as const).map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className={cn(
                      'rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium capitalize',
                      'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                    )}
                  >
                    {tab === 'installed'
                      ? `Installed${installedSkills.length > 0 ? ` (${installedSkills.length})` : ''}`
                      : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
                <TabsContent value="browse" className="mt-0">
                  <BrowseTab
                    skills={allSkills}
                    installedSkillIds={installedSkillIds}
                    onInstall={handleInstall}
                    onViewDetail={handleViewDetail}
                  />
                </TabsContent>

                <TabsContent value="installed" className="mt-0">
                  <InstalledTab skills={installedSkills} onUninstall={handleUninstall} />
                </TabsContent>

                <TabsContent value="import" className="mt-0">
                  <ImportTab onImportSuccess={handleImportSuccess} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
