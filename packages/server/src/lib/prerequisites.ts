import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface PrereqResult {
  readonly name: string
  readonly passed: boolean
  readonly message: string
  readonly fix?: string
  readonly critical: boolean
}

export interface PrerequisitesReport {
  readonly allPassed: boolean
  readonly critical: boolean
  readonly results: readonly PrereqResult[]
  readonly failures: readonly PrereqResult[]
}

async function checkClaudeCode(): Promise<PrereqResult> {
  try {
    const { stdout } = await execFileAsync('claude', ['--version'], { timeout: 5000 })
    return {
      name: 'Claude Code CLI',
      passed: true,
      message: `Found: ${stdout.trim()}`,
      critical: true,
    }
  } catch {
    return {
      name: 'Claude Code CLI',
      passed: false,
      message: 'Claude Code CLI not found in PATH',
      fix: 'Install Claude Code: npm install -g @anthropic-ai/claude-code',
      critical: false,
    }
  }
}

async function checkDocker(): Promise<PrereqResult> {
  try {
    const { stdout } = await execFileAsync('docker', ['--version'], { timeout: 5000 })
    return {
      name: 'Docker',
      passed: true,
      message: `Found: ${stdout.trim()}`,
      critical: false,
    }
  } catch {
    return {
      name: 'Docker',
      passed: false,
      message: 'Docker not found',
      fix: 'Install Docker Desktop: https://docker.com/products/docker-desktop',
      critical: false,
    }
  }
}

async function checkPostgres(): Promise<PrereqResult> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    return {
      name: 'PostgreSQL',
      passed: false,
      message: 'DATABASE_URL environment variable not set',
      fix: 'Set DATABASE_URL=postgresql://orchestra:orchestra_dev@localhost:5432/orchestra',
      critical: true,
    }
  }

  return {
    name: 'PostgreSQL',
    passed: true,
    message: 'DATABASE_URL configured',
    critical: true,
  }
}

export async function checkPrerequisites(): Promise<PrerequisitesReport> {
  const results = await Promise.all([
    checkClaudeCode(),
    checkDocker(),
    checkPostgres(),
  ])

  const failures = results.filter((r) => !r.passed)
  const critical = failures.some((r) => r.critical)

  return {
    allPassed: failures.length === 0,
    critical,
    results,
    failures,
  }
}
