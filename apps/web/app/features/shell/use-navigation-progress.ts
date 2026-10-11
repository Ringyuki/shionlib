import { useEffect, useState, type TransitionEvent } from 'react'
import { useNavigation } from 'react-router'

const quickEnough = 150

type Phase = 'idle' | 'loading' | 'filling' | 'fading'

type Run = { slow: boolean; phase: Phase }

function useSlowNavigation() {
  const navigating = useNavigation().state !== 'idle'
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!navigating) {
      return
    }
    const timer = setTimeout(() => setSlow(true), quickEnough)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [navigating])
  return navigating && slow
}

function phaseAfter(phase: Phase, property: string): Phase {
  if (phase === 'filling' && property === 'scale') {
    return 'fading'
  }
  return phase === 'fading' && property === 'opacity' ? 'idle' : phase
}

export function useNavigationProgress() {
  const slow = useSlowNavigation()
  const [run, setRun] = useState<Run>({ slow: false, phase: 'idle' })
  if (run.slow !== slow) {
    const ended = run.phase === 'loading' ? 'filling' : run.phase
    setRun({ slow, phase: slow ? 'idle' : ended })
  }
  const waiting = run.slow && run.phase === 'idle'
  useEffect(() => {
    if (!waiting) {
      return
    }
    let painted = 0
    const reset = requestAnimationFrame(() => {
      painted = requestAnimationFrame(() => setRun({ slow: true, phase: 'loading' }))
    })
    return () => {
      cancelAnimationFrame(reset)
      cancelAnimationFrame(painted)
    }
  }, [waiting])
  const settle = (event: TransitionEvent) => {
    const property = event.propertyName
    setRun(current => ({ ...current, phase: phaseAfter(current.phase, property) }))
  }
  return { phase: run.phase, settle }
}
