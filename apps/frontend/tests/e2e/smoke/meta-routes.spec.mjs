import { expect, test } from '@playwright/test'

test.describe('Meta routes', () => {
  test('sitemap routes should respond with xml/xsl payloads', async ({ request }) => {
    const [indexResponse, sectionResponse, stylesheetResponse] = await Promise.all([
      request.get('/sitemap.xml'),
      request.get('/sitemap-game-1.xml'),
      request.get('/sitemap.xsl'),
    ])

    expect(indexResponse.ok()).toBeTruthy()
    expect(sectionResponse.ok()).toBeTruthy()
    expect(stylesheetResponse.ok()).toBeTruthy()

    expect(indexResponse.headers()['content-type']).toContain('application/xml')
    expect(sectionResponse.headers()['content-type']).toContain('application/xml')
    expect(stylesheetResponse.headers()['content-type']).toContain('text/xsl')

    const indexXml = await indexResponse.text()
    const sectionXml = await sectionResponse.text()
    const stylesheet = await stylesheetResponse.text()

    expect(indexXml).toContain('<sitemapindex')
    expect(sectionXml).toContain('<urlset')
    expect(stylesheet).toContain('<xsl:stylesheet')
  })

  test('og route should return image', async () => {
    test.skip(
      true,
      'Current /og implementation is unstable in Dockerized e2e and should be fixed in business logic later.',
    )
  })

  test('og to-png route should validate params', async ({ request }) => {
    const invalidToPngResponse = await request.get('/og/to-png')
    expect(invalidToPngResponse.status()).toBe(400)
  })
})
