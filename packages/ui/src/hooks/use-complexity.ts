'use client'

import { createContext, useContext } from 'react'

export type ComplexityTier = 'simple' | 'standard' | 'full'

export interface ComplexityContextValue {
  readonly tier: ComplexityTier
  readonly level: number
  readonly isSimple: boolean
  readonly isFull: boolean
}

function tierFromLevel(level: number): ComplexityTier {
  if (level <= 3) return 'simple'
  if (level <= 7) return 'standard'
  return 'full'
}

export function getComplexityFromStorage(): ComplexityContextValue {
  if (typeof window === 'undefined') {
    return { tier: 'standard', level: 5, isSimple: false, isFull: false }
  }
  try {
    const raw = localStorage.getItem('orchestra:settings:complexity')
    const level = raw ? JSON.parse(raw) : 5
    const tier = tierFromLevel(level)
    return { tier, level, isSimple: tier === 'simple', isFull: tier === 'full' }
  } catch {
    return { tier: 'standard', level: 5, isSimple: false, isFull: false }
  }
}

export const ComplexityContext = createContext<ComplexityContextValue>({
  tier: 'standard',
  level: 5,
  isSimple: false,
  isFull: false,
})

export function useComplexity(): ComplexityContextValue {
  return useContext(ComplexityContext)
}
