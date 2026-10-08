import { parseOptional } from '~/shared/form/check'
import {
  isPasskeyCreationOptions,
  isPasskeyRequestOptions,
  passkeyCredential,
  type PasskeyCredential,
} from './auth.schema'

export function passkeysSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof window.PublicKeyCredential.parseRequestOptionsFromJSON === 'function'
  )
}

export async function assertPasskey(options: unknown): Promise<PasskeyCredential | undefined> {
  if (!isPasskeyRequestOptions(options)) {
    return undefined
  }
  const credential = await navigator.credentials.get({
    publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
  })
  if (!(credential instanceof PublicKeyCredential)) {
    return undefined
  }
  return parseOptional(passkeyCredential, credential.toJSON())
}

export async function createPasskey(options: unknown): Promise<PasskeyCredential | undefined> {
  if (!isPasskeyCreationOptions(options)) {
    return undefined
  }
  const credential = await navigator.credentials.create({
    publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
  })
  if (!(credential instanceof PublicKeyCredential)) {
    return undefined
  }
  return parseOptional(passkeyCredential, credential.toJSON())
}
