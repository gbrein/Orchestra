'use client'

import { useCallback, useEffect, useState } from 'react'

const KEYS = {
  completed: 'orchestra:onboarding:completed',
  sidebarDrag: 'orchestra:coaching:sidebar-drag',
  connectNodes: 'orchestra:coaching:connect-nodes',
  runWorkflow: 'orchestra:coaching:run-workflow',
} as const

export interface UseOnboardingReturn {
  /** True when the wizard should be shown (first-time user). */
  readonly showWizard: boolean
  /** Mark the wizard as completed. */
  readonly completeWizard: () => void
}

export function useOnboarding(): UseOnboardingReturn {
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    try {
      const completed = localStorage.getItem(KEYS.completed)
      if (!completed) {
        setShowWizard(true)
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  const completeWizard = useCallback(() => {
    try {
      localStorage.setItem(KEYS.completed, 'true')
    } catch {
      // silent
    }
    setShowWizard(false)
  }, [])

  return { showWizard, completeWizard }
}

// ─── Coaching Steps ────────────────────────────────────────────────────────

export interface CoachingStep {
  readonly visible: boolean
  readonly dismiss: () => void
}

export function useCoachingStep(key: keyof typeof KEYS): CoachingStep {
  const storageKey = KEYS[key]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(storageKey)
      const completed = localStorage.getItem(KEYS.completed)
      // Only show coaching after wizard is completed and this step hasn't been dismissed
      if (completed && !dismissed) {
        setVisible(true)
      }
    } catch {
      // silent
    }
  }, [storageKey])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(storageKey, 'true')
    } catch {
      // silent
    }
    setVisible(false)
  }, [storageKey])

  return { visible, dismiss }
}
