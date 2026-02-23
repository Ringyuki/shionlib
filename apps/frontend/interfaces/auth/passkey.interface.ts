import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser'

export interface PasskeyCredentialItem {
  id: number
  credential_id: string
  name: string | null
  transports: string[]
  aaguid: string | null
  device_type: string | null
  credential_backed_up: boolean
  last_used_at: string | null
  created: string
}

export interface PasskeyCreationOptionsPayload {
  flow_id: string
  options: PublicKeyCredentialCreationOptionsJSON
}

export interface PasskeyRequestOptionsPayload {
  flow_id: string
  options: PublicKeyCredentialRequestOptionsJSON
}

export type PasskeyRegisterResponsePayload = RegistrationResponseJSON
export type PasskeyLoginResponsePayload = AuthenticationResponseJSON
