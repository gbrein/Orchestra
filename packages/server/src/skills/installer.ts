import { mkdir, cp, writeFile, rm, access } from 'fs/promises'
import { join } from 'path'
import { homedir, tmpdir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '../lib/prisma'
import { validateSkillDirectory } from './validator'
import type { CatalogSkill } from './catalog'
import type { Skill } from '@orchestra/shared'

const execAsync = promisify(exec)

export interface InstallOptions {
  name: string
  source: 'marketplace' | 'git'
  gitUrl?: string
  catalogEntry?: CatalogSkill
}

export interface InstallResult {
  success: boolean
  skill?: Skill
  error?: string
}

// ---------------------------------------------------------------------------
// Directory helpers
// ---------------------------------------------------------------------------

export function getSkillsDirectory(): string {
  return join(homedir(), '.orchestra', 'skills')
}

export async function ensureSkillsDirectory(): Promise<void> {
  const dir = getSkillsDirectory()
  await mkdir(dir, { recursive: true })
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export async function installSkill(options: InstallOptions): Promise<InstallResult> {
  const { name, source } = options

  // [G21] Validate name before any filesystem operations
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return {
      success: false,
      error: `Invalid skill name "${name}" — only letters, digits, hyphens, and underscores are allowed`,
    }
  }

  if (source === 'marketplace') {
    return installMarketplaceSkill(name, options.catalogEntry)
  }

  if (source === 'git') {
    if (!options.gitUrl) {
      return { success: false, error: 'gitUrl is required for git source' }
    }
    return installGitSkill(name, options.gitUrl)
  }

  return { success: false, error: `Unknown source: ${source}` }
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

export async function uninstallSkill(skillId: string): Promise<void> {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } })
  if (!skill) {
    throw new Error(`Skill with id '${skillId}' not found`)
  }

  // Remove from DB first so it can't be referenced after filesystem removal
  await prisma.skill.delete({ where: { id: skillId } })

  // Best-effort removal of the skill directory
  try {
    await rm(skill.path, { recursive: true, force: true })
  } catch {
    // Log but don't re-throw — DB record is the source of truth
  }
}

// ---------------------------------------------------------------------------
// Marketplace install
// ---------------------------------------------------------------------------

async function installMarketplaceSkill(
  name: string,
  catalogEntry?: CatalogSkill,
): Promise<InstallResult> {
  if (!catalogEntry) {
    return { success: false, error: `No catalog entry provided for skill "${name}"` }
  }

  const skillDir = join(getSkillsDirectory(), name)

  try {
    // If already installed on disk, just ensure the DB record exists
    if (await pathExists(skillDir)) {
      const skill = await upsertSkillRecord({
        name: catalogEntry.name,
        description: catalogEntry.description,
        source: 'marketplace',
        path: skillDir,
        version: catalogEntry.version,
        author: catalogEntry.author,
        category: catalogEntry.category,
        icon: catalogEntry.icon,
        mcpConfig: catalogEntry.mcpConfig ?? null,
      })
      return { success: true, skill: toSkillDto(skill) }
    }

    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), catalogEntry.skillMdContent, 'utf8')

    const validation = await validateSkillDirectory(skillDir)
    if (!validation.valid) {
      await rm(skillDir, { recursive: true, force: true })
      return { success: false, error: `Validation failed: ${validation.errors.join('; ')}` }
    }

    const skill = await upsertSkillRecord({
      name: catalogEntry.name,
      description: catalogEntry.description,
      source: 'marketplace',
      path: skillDir,
      version: catalogEntry.version,
      author: catalogEntry.author,
      category: catalogEntry.category,
      icon: catalogEntry.icon,
      mcpConfig: catalogEntry.mcpConfig ?? null,
    })

    return { success: true, skill: toSkillDto(skill) }
  } catch (err) {
    // Clean up partial install
    await rm(skillDir, { recursive: true, force: true }).catch(() => undefined)
    return { success: false, error: errorMessage(err) }
  }
}

// ---------------------------------------------------------------------------
// Git install  [G21]
// ---------------------------------------------------------------------------

async function installGitSkill(name: string, gitUrl: string): Promise<InstallResult> {
  const tempDir = join(tmpdir(), `orchestra-skill-${name}-${Date.now()}`)
  const finalDir = join(getSkillsDirectory(), name)

  if (await pathExists(finalDir)) {
    return { success: false, error: `Skill "${name}" is already installed` }
  }

  try {
    await mkdir(tempDir, { recursive: true })

    // [G21] Security: no-checkout prevents executing hook scripts from the repo,
    // disabling hooksPath provides an additional guarantee against hook execution.
    await execAsync(
      `git clone --depth 1 --no-checkout --config core.hooksPath=/dev/null ${shellEscape(gitUrl)} ${shellEscape(tempDir)}`,
    )

    // Only check out the two safe files we actually need
    await execAsync(
      `git -C ${shellEscape(tempDir)} checkout HEAD -- SKILL.md orchestra.json`,
    ).catch(() => {
      // orchestra.json is optional — ignore if not present
    })

    // If SKILL.md was not checked out, try skill.md
    if (!(await pathExists(join(tempDir, 'SKILL.md')))) {
      await execAsync(
        `git -C ${shellEscape(tempDir)} checkout HEAD -- skill.md`,
      ).catch(() => undefined)
    }

    const validation = await validateSkillDirectory(tempDir)
    if (!validation.valid) {
      await rm(tempDir, { recursive: true, force: true })
      return { success: false, error: `Validation failed: ${validation.errors.join('; ')}` }
    }

    // Move validated content to final location
    await mkdir(finalDir, { recursive: true })
    await cp(tempDir, finalDir, { recursive: true })
    await rm(tempDir, { recursive: true, force: true })

    const meta = validation.metadata!

    const skill = await upsertSkillRecord({
      name: meta.name,
      description: meta.description,
      source: 'git',
      gitUrl,
      path: finalDir,
      version: meta.version ?? null,
      author: meta.author ?? null,
      category: meta.category ?? null,
      icon: meta.icon ?? null,
      mcpConfig: meta.mcpConfig ?? null,
    })

    return { success: true, skill: toSkillDto(skill) }
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    await rm(finalDir, { recursive: true, force: true }).catch(() => undefined)
    return { success: false, error: errorMessage(err) }
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

interface SkillCreateData {
  name: string
  description: string
  source: 'marketplace' | 'git'
  gitUrl?: string
  path: string
  version?: string | null
  author?: string | null
  category?: string | null
  icon?: string | null
  mcpConfig?: object | null
}

async function upsertSkillRecord(data: SkillCreateData) {
  return prisma.skill.upsert({
    where: { name: data.name },
    create: {
      name: data.name,
      description: data.description,
      source: data.source,
      gitUrl: data.gitUrl ?? null,
      path: data.path,
      version: data.version ?? null,
      author: data.author ?? null,
      category: data.category ?? null,
      icon: data.icon ?? null,
      mcpConfig: data.mcpConfig ?? undefined,
    },
    update: {
      description: data.description,
      path: data.path,
      version: data.version ?? null,
      author: data.author ?? null,
      category: data.category ?? null,
      icon: data.icon ?? null,
      mcpConfig: data.mcpConfig ?? undefined,
    },
  })
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Minimal shell argument escaping — wraps the value in single quotes and
 * escapes any single quotes within the value. Only used for git command args.
 */
function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function toSkillDto(record: {
  id: string
  name: string
  description: string
  source: string
  gitUrl: string | null
  path: string
  version: string | null
  author: string | null
  category: string | null
  icon: string | null
  mcpConfig: unknown
  installedAt: Date
}): Skill {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    source: record.source as 'marketplace' | 'git',
    gitUrl: record.gitUrl,
    path: record.path,
    version: record.version,
    author: record.author,
    category: record.category,
    icon: record.icon,
    mcpConfig: record.mcpConfig as import('@orchestra/shared').McpSkillConfig | null,
    installedAt: record.installedAt.toISOString(),
  }
}
