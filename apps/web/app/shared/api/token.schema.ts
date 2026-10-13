import * as v from 'valibot'

const claims = v.pipe(
  v.string(),
  v.transform(payload => Buffer.from(payload, 'base64url').toString('utf8')),
  v.parseJson(),
  v.looseObject({ exp: v.number() }),
)

export function tokenExpiry(token: string | undefined): number | undefined {
  const payload = token?.split('.')[1]
  const parsed = v.safeParse(claims, payload)
  return parsed.success ? parsed.output.exp : undefined
}
