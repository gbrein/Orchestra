import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// UUID regex used to validate workspace IDs before constructing paths
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Returns the directory where files for a given workspace are stored.
 * Path: ~/.orchestra/workspaces/{workspaceId}/files/
 */
export function getWorkspaceFilesDir(workspaceId: string): string {
  validateWorkspaceId(workspaceId)
  return join(homedir(), '.orchestra', 'workspaces', workspaceId, 'files')
}

/**
 * Ensures the workspace files directory exists, creating it recursively if needed.
 */
export async function ensureWorkspaceDir(workspaceId: string): Promise<void> {
  const dir = getWorkspaceFilesDir(workspaceId)
  await mkdir(dir, { recursive: true })
}

export interface SavedFile {
  readonly storedName: string
  readonly filePath: string
  readonly fileSize: number
}

/**
 * Persists a file buffer to disk under a UUID-prefixed name.
 * Rejects filenames that contain path-traversal sequences.
 */
export async function saveFile(
  workspaceId: string,
  originalName: string,
  buffer: Buffer,
): Promise<SavedFile> {
  validateWorkspaceId(workspaceId)
  validateFileName(originalName)

  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)} MB`)
  }

  await ensureWorkspaceDir(workspaceId)

  const ext = extractExtension(originalName)
  const storedName = `${randomUUID()}${ext}`
  const filePath = join(getWorkspaceFilesDir(workspaceId), storedName)

  await writeFile(filePath, buffer)

  return { storedName, filePath, fileSize: buffer.byteLength }
}

/**
 * Removes a previously stored file from disk.
 * The storedName must be a plain filename (no directory separators).
 */
export async function deleteFile(workspaceId: string, storedName: string): Promise<void> {
  validateWorkspaceId(workspaceId)
  validateFileName(storedName)

  const filePath = join(getWorkspaceFilesDir(workspaceId), storedName)
  await rm(filePath, { force: true })
}

// ------------------------------------------------------------------
// Private helpers
// ------------------------------------------------------------------

function validateWorkspaceId(workspaceId: string): void {
  if (!UUID_REGEX.test(workspaceId)) {
    throw new Error(`Invalid workspace ID: "${workspaceId}"`)
  }
}

function validateFileName(name: string): void {
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error(`Rejected filename with path-traversal characters: "${name}"`)
  }
}

function extractExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === filename.length - 1) return ''
  const ext = filename.slice(dotIndex)
  // Only allow simple alphanumeric extensions
  return /^\.[a-zA-Z0-9]{1,10}$/.test(ext) ? ext : ''
}
