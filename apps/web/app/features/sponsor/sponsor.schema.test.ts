import { describe, expect, it } from 'vitest'
import { firstIssueMessage, parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import {
  celebratedFrom,
  isCurrencyCode,
  orderCommand,
  orderForm,
  payCommand,
  startedFrom,
  tokenFrom,
} from './sponsor.schema'

describe('orderForm', () => {
  const form = orderForm(
    createFormKit(issue => issue.kind),
    issue => issue,
  )
  const valid = { amount: 10, name: '', message: '', shown: true }

  it('needs an amount', () => {
    expect(firstIssueMessage(form, valid)).toBeUndefined()
    expect(firstIssueMessage(form, { ...valid, amount: null })).toBe('amount')
  })

  it('keeps the name and the message within the API limits', () => {
    expect(firstIssueMessage(form, { ...valid, name: 'n'.repeat(101) })).toBe('maxLength')
    expect(firstIssueMessage(form, { ...valid, message: 'm'.repeat(501) })).toBe('maxLength')
    expect(firstIssueMessage(form, { ...valid, message: 'm'.repeat(500) })).toBeUndefined()
  })
})

describe('commands', () => {
  it('accepts a complete order', () => {
    const draft = { amount: 12.5, name: '路过', message: '', shown: false }
    expect(parseOptional(orderCommand, draft)).toEqual(draft)
    expect(parseOptional(orderCommand, { ...draft, amount: '12.5' })).toBeUndefined()
  })

  it('accepts a payment for an order with the address to come back to', () => {
    const start = { id: 4, method: 'alipay', back: 'https://shionlib.com/zh/sponsor/orders/4' }
    expect(parseOptional(payCommand, start)).toEqual(start)
    for (const value of [
      { ...start, id: 0 },
      { ...start, method: '' },
      { ...start, back: '' },
      null,
    ]) {
      expect(parseOptional(payCommand, value)).toBeUndefined()
    }
  })
})

describe('input guards', () => {
  it('reads the token of an order from the address', () => {
    expect(tokenFrom(new URLSearchParams('token=abc'))).toBe('abc')
    expect(tokenFrom(new URLSearchParams(''))).toBe('')
    expect(tokenFrom(new URLSearchParams({ token: 't'.repeat(129) }))).toBe('')
  })

  it('reads the celebrated orders from storage', () => {
    expect(celebratedFrom('[3,4]')).toEqual([3, 4])
    for (const stored of [null, '', 'nonsense', '{"a":1}', '["3"]']) {
      expect(celebratedFrom(stored)).toEqual([])
    }
  })

  it('reads a started payment from storage', () => {
    const started = {
      order: 4,
      method: 'alipay',
      payUrl: 'https://pay.example/4',
      payCurrency: 'CNY',
      amount: 72.5,
    }
    expect(startedFrom(JSON.stringify(started))).toEqual(started)
    expect(startedFrom(JSON.stringify({ ...started, payCurrency: null, amount: null }))).toEqual({
      ...started,
      payCurrency: null,
      amount: null,
    })
    for (const stored of [null, 'null', 'nonsense', JSON.stringify({ ...started, payUrl: 'x' })]) {
      expect(startedFrom(stored)).toBeUndefined()
    }
  })

  it('tells a currency code from another unit', () => {
    expect(isCurrencyCode('CNY')).toBe(true)
    expect(isCurrencyCode('USDT')).toBe(false)
    expect(isCurrencyCode('')).toBe(false)
  })
})
