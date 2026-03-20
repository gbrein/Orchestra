import { createAuthClient } from 'better-auth/client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export const authClient = createAuthClient({
  baseURL: `${API_BASE}/api/auth`,
  fetchOptions: {
    credentials: 'include',
  },
})

export async function signIn(email: string, password: string) {
  return authClient.signIn.email({ email, password })
}

export async function signUp(email: string, password: string, name: string) {
  return authClient.signUp.email({ email, password, name })
}

export async function signOut() {
  return authClient.signOut()
}

export async function getSession() {
  return authClient.getSession()
}

export async function signInWithGithub() {
  return authClient.signIn.social({
    provider: 'github',
    callbackURL: typeof window !== 'undefined' ? window.location.origin : '/',
  })
}

export async function signInWithGoogle() {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: typeof window !== 'undefined' ? window.location.origin : '/',
  })
}
