const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'API request failed')
  return json.data as T
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'API request failed')
  return json.data as T
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'API request failed')
  return json.data as T
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'API request failed')
  return json.data as T
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'API request failed')
}

export async function apiUpload<T>(
  path: string,
  file: File,
  extraFields?: Record<string, string>,
): Promise<T> {
  const formData = new FormData()
  formData.append('file', file)
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) {
      formData.append(k, v)
    }
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
    // No Content-Type header — browser sets it with boundary for multipart
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Upload failed')
  return json.data as T
}
