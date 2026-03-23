import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../lib/prisma'

const UI_ORIGIN = process.env.UI_ORIGIN ?? 'http://localhost:3000'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  basePath: '/api/auth',
  secret: (() => {
    const secret = process.env.BETTER_AUTH_SECRET
    if (!secret) throw new Error('BETTER_AUTH_SECRET environment variable is required. Run `npm run setup` to generate one.')
    return secret
  })(),
  appName: 'Orchestra',

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      enabled: Boolean(process.env.GITHUB_CLIENT_ID),
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min cache
    },
  },

  trustedOrigins: [UI_ORIGIN],
})

export type Auth = typeof auth
