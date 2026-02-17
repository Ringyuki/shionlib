import { JSX } from 'react'

export interface PluginProps {
  placeholder?: string
  autoFocus?: boolean
  onSubmit?: () => void
  isSubmitting?: boolean
  isSubmitDisabled?: boolean
  submitLabel?: string | React.ReactNode
  clearSignal?: number
}

export type Plugin<T = PluginProps> = (props: T) => JSX.Element
