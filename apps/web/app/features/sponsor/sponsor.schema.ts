import * as v from 'valibot'
import { parseOptional } from '~/shared/form/check'
import type { FormKit } from '~/shared/form/form-kit'
import type { Started } from './sponsor'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

export type SponsorIssue = 'amount'

export type OrderValues = {
  amount: number | null
  name: string
  message: string
  shown: boolean
}

export function orderForm(kit: FormKit, issue: (kind: SponsorIssue) => string) {
  return v.object({
    amount: v.number(issue('amount')),
    name: kit.text('CreateSponsorOrderInputBody', 'name'),
    message: kit.text('CreateSponsorOrderInputBody', 'message'),
    shown: v.boolean(),
  })
}

export const orderCommand = v.object({
  amount: v.number(),
  name: v.string(),
  message: v.string(),
  shown: v.boolean(),
})

export type OrderDraft = v.InferOutput<typeof orderCommand>

export const payCommand = v.object({
  id,
  method: v.pipe(v.string(), v.nonEmpty()),
  back: v.pipe(v.string(), v.nonEmpty()),
})

export type PaymentStart = v.InferOutput<typeof payCommand>

const token = v.fallback(v.pipe(v.string(), v.maxLength(128)), '')

export function tokenFrom(search: URLSearchParams): string {
  return v.parse(token, search.get('token') ?? '')
}

const celebrated = v.fallback(v.pipe(v.string(), v.parseJson(), v.array(id)), [])

export function celebratedFrom(stored: string | null): number[] {
  return v.parse(celebrated, stored)
}

const started = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    order: id,
    method: v.string(),
    payUrl: v.pipe(v.string(), v.url()),
    payCurrency: v.nullable(v.string()),
    amount: v.nullable(v.number()),
  }),
)

export function startedFrom(stored: string | null): Started | undefined {
  return parseOptional(started, stored)
}

const currencyCode = v.pipe(v.string(), v.regex(/^[A-Za-z]{3}$/))

export function isCurrencyCode(currency: string): boolean {
  return v.is(currencyCode, currency)
}
