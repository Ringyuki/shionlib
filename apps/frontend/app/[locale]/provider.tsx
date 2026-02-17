'use client'

import { ThemeProvider } from 'next-themes'
import { AppProgressProvider as ProgressProvider } from '@bprogress/next'
import { SocketProvider } from '@/libs/socketio/core'
import { Toaster as SileoToaster } from 'sileo'
import { Toaster as ReactHotToastToaster } from 'react-hot-toast'
import { reactHotToastProps, sileoToastProps } from './toastOption'
import { useToastPreferenceStore } from '@/store/localSettingsStore'
import { AuthSessionCheck } from '@/components/common/auth/AuthSessionCheck'

export default function ShionlibProvider({ children }: { children: React.ReactNode }) {
  const position = useToastPreferenceStore(state => state.position)

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme">
      <ProgressProvider height="3px" color="var(--primary)" shallowRouting>
        <SocketProvider>
          <AuthSessionCheck />
          {children}
          <SileoToaster {...sileoToastProps} position={position} />
          <ReactHotToastToaster {...reactHotToastProps} position={position} />
        </SocketProvider>
      </ProgressProvider>
    </ThemeProvider>
  )
}
