import { createContext, useContext, type ReactNode } from 'react'

export type AuthGate = {
  signedIn: boolean
  requireSignIn: (resume?: () => void) => void
}

const AuthGateContext = createContext<AuthGate>({
  signedIn: false,
  requireSignIn: () => undefined,
})

export function AuthGateProvider({ gate, children }: { gate: AuthGate; children: ReactNode }) {
  return <AuthGateContext value={gate}>{children}</AuthGateContext>
}

export function useAuthGate(): AuthGate {
  return useContext(AuthGateContext)
}
