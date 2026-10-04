import { Button as HinaButton, type ButtonProps as HinaButtonProps } from '@hina-ui/react'
import type { MouseEvent } from 'react'
import { useAuthGate } from './auth-gate'

export type ButtonProps = HinaButtonProps & {
  loginRequired?: boolean
}

export function Button({ loginRequired = false, onClickCapture, ...props }: ButtonProps) {
  const gate = useAuthGate()
  const guard = (event: MouseEvent<HTMLElement>) => {
    if (loginRequired && !gate.signedIn) {
      event.preventDefault()
      event.stopPropagation()
      const target = event.currentTarget
      gate.requireSignIn(() => target.click())
      return
    }
    onClickCapture?.(event)
  }
  return <HinaButton {...props} onClickCapture={guard} />
}
