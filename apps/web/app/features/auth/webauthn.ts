export function passkeysSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof window.PublicKeyCredential.parseRequestOptionsFromJSON === 'function'
  )
}

export async function assertPasskey(
  options: unknown,
): Promise<Record<string, unknown> | undefined> {
  if (!isRequestOptions(options)) {
    return undefined
  }
  const credential = await navigator.credentials.get({
    publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
  })
  if (!(credential instanceof PublicKeyCredential)) {
    return undefined
  }
  const json: unknown = credential.toJSON()
  return isRecord(json) ? json : undefined
}

function isRequestOptions(value: unknown): value is PublicKeyCredentialRequestOptionsJSON {
  return isRecord(value) && typeof value.challenge === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
