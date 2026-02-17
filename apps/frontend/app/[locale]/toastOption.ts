import { ToasterProps as ReactHotToastProps } from 'react-hot-toast'
import type { ComponentProps } from 'react'
import { Toaster as SileoToaster } from 'sileo'

export const reactHotToastOptions: ReactHotToastProps['toastOptions'] = {
  success: {
    iconTheme: {
      primary: 'var(--toast-text-success)',
      secondary: 'var(--toast-bg-success)',
    },
    style: {
      background: 'var(--toast-bg-success)',
      color: 'var(--toast-text-success)',
    },
  },
  error: {
    iconTheme: {
      primary: 'var(--toast-text-destructive)',
      secondary: 'var(--toast-bg-destructive)',
    },
    style: {
      background: 'var(--toast-bg-destructive)',
      color: 'var(--toast-text-destructive)',
    },
  },
}

export const reactHotToastProps: Omit<ReactHotToastProps, 'children'> = {
  toastOptions: reactHotToastOptions,
  containerStyle: { marginRight: 'var(--removed-body-scroll-bar-size, 0px)' },
}

type SileoToasterProps = ComponentProps<typeof SileoToaster>
export const sileoToastProps: Omit<SileoToasterProps, 'children'> = {
  offset: {
    top: 'var(--topbar-top-offset, 0px)',
    bottom: 'var(--topbar-top-offset, 0px)',
    right: 'var(--removed-body-scroll-bar-size, 0px)',
  },
  options: {
    styles: {},
    duration: 4000,
  },
}
