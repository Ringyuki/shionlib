import { describe, expect, it } from 'bun:test'

const { cards } = await import('../../src/routes/cards')

describe('card routes', () => {
  it('refuses an id that is not a positive number', async () => {
    const response = await cards.request('/game/abc')
    expect(response.status).toBe(400)
  })

  it('refuses a document without a title', async () => {
    const response = await cards.request('/docs?locale=zh&category=dev')
    expect(response.status).toBe(400)
  })

  it('answers only the kinds it knows', async () => {
    const response = await cards.request('/album/1')
    expect(response.status).toBe(404)
  })
})
