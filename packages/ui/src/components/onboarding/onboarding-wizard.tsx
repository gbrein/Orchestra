'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { StepWorkingDirectory } from './step-working-directory'
import { StepWorkMode, type WorkMode } from './step-work-mode'
import { StepFirstAction, type FirstAction } from './step-first-action'

export interface OnboardingWizardProps {
  readonly open: boolean
  readonly onComplete: (result: OnboardingResult) => void
}

export interface OnboardingResult {
  readonly workingDirectory: string
  readonly workMode: WorkMode
  readonly firstAction: FirstAction
  readonly description?: string
}

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1)
  const [workingDir, setWorkingDir] = useState('')
  const [workMode, setWorkMode] = useState<WorkMode | null>(null)

  function handleFirstAction(action: FirstAction, description?: string) {
    onComplete({
      workingDirectory: workingDir.trim(),
      workMode: workMode ?? 'quick',
      firstAction: action,
      description,
    })
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl border-border p-8 [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // Only allow Escape on step 2+ (step 1 is mandatory)
          if (step === 1) {
            e.preventDefault()
          } else if (step === 2) {
            // Skip to step 3 with default mode
            setStep(3)
          }
        }}
      >
        <DialogTitle className="sr-only">Welcome to Orchestra</DialogTitle>

        {/* Step indicator */}
        <div className="mb-4 flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n === step
                  ? 'w-6 bg-primary'
                  : n < step
                  ? 'w-3 bg-primary/60'
                  : 'w-3 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Steps */}
        {step === 1 && (
          <StepWorkingDirectory
            value={workingDir}
            onChange={setWorkingDir}
            onContinue={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepWorkMode
            value={workMode}
            onChange={setWorkMode}
            onContinue={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepFirstAction
            onAction={handleFirstAction}
            onBack={() => setStep(2)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
