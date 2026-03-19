'use client'

import { createContext, useContext, useEffect, useState } from 'react'

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

function buildValue(level: number): ComplexityContextValue {
  const tier = tierFromLevel(level)
  return { tier, level, isSimple: tier === 'simple', isFull: tier === 'full' }
}

const DEFAULT_VALUE = buildValue(5)

export const ComplexityContext = createContext<ComplexityContextValue>(DEFAULT_VALUE)

export function useComplexity(): ComplexityContextValue {
  return useContext(ComplexityContext)
}

/**
 * Reads complexity from localStorage after mount (client-only).
 * Returns the default on server and first render to avoid hydration mismatch.
 */
export function useComplexityState() {
  const [value, setValue] = useState<ComplexityContextValue>(DEFAULT_VALUE)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('orchestra:settings:complexity')
      const level = raw ? JSON.parse(raw) : 5
      setValue(buildValue(level))
    } catch {
      // keep default
    }
  }, [])

  const refresh = () => {
    try {
      const raw = localStorage.getItem('orchestra:settings:complexity')
      const level = raw ? JSON.parse(raw) : 5
      setValue(buildValue(level))
    } catch {
      // keep current
    }
  }

  return { value, refresh }
}
