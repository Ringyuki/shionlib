import {
  Button as HinaButton,
  IconButton as HinaIconButton,
  type ButtonProps as HinaButtonProps,
  type IconButtonProps as HinaIconButtonProps,
} from '@hina-ui/react'
import type { MouseEvent } from 'react'
import { useAuthGate } from './auth-gate'

type LoginRequired = { loginRequired?: boolean }

export type ButtonProps = HinaButtonProps & LoginRequired

export type IconButtonProps = HinaIconButtonProps & LoginRequired

export function Button({ loginRequired = false, onClickCapture, ...props }: ButtonProps) {
  const guard = useLoginGuard(loginRequired, onClickCapture)
  return <HinaButton {...props} onClickCapture={guard} />
}

export function IconButton({ loginRequired = false, onClickCapture, ...props }: IconButtonProps) {
  const guard = useLoginGuard(loginRequired, onClickCapture)
  return <HinaIconButton {...props} onClickCapture={guard} />
}

function useLoginGuard(
  loginRequired: boolean,
  onClickCapture: ((event: MouseEvent<HTMLElement>) => void) | undefined,
) {
  const gate = useAuthGate()
  return (event: MouseEvent<HTMLElement>) => {
    if (loginRequired && !gate.signedIn) {
      event.preventDefault()
      event.stopPropagation()
      const target = event.currentTarget
      gate.requireSignIn(() => target.click())
      return
    }
    onClickCapture?.(event)
  }
}
