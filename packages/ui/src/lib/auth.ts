import { createAuthClient } from '@better-auth/client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// createAuthClient<BetterAuth>() returns a factory; call with options to get client
const getClient = createAuthClient()
const authClient = getClient({
  baseURL: `${API_BASE}/api/auth`,
  betterFetchOptions: {
    credentials: 'include',
  },
})

export async function signIn(email: string, password: string) {
  return authClient.signIn({
    provider: 'email',
    data: { email, password },
  })
}

export async function signUp(email: string, password: string, name: string) {
  return authClient.signUp({
    provider: 'email',
    data: { email, password, name },
    autoCreateSession: true,
  })
}

export async function signOut() {
  return authClient.signOut()
}

export async function getSession() {
  return authClient.getSession()
}

export async function signInWithGithub() {
  return authClient.signIn({
    provider: 'github',
    callbackURL: typeof window !== 'undefined' ? window.location.origin : '/',
  })
}

export async function signInWithGoogle() {
  return authClient.signIn({
    provider: 'google',
    callbackURL: typeof window !== 'undefined' ? window.location.origin : '/',
  })
}
