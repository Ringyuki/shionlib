describe('requestId middleware', () => {
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  const loadRequestId = async () => {
    const dynamicImport = (specifier: string) => import(specifier)
    try {
      return await dynamicImport('./request-id.middleware.js')
    } catch {
      return dynamicImport('./request-id.middleware')
    }
  }

  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetModules()
    jest.unmock('node:crypto')
    if (originalCryptoDescriptor) {
      Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor)
    }
  })

  it('uses global crypto randomUUID and sets response header', async () => {
    const randomUUID = jest.fn(() => 'uuid-global')
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID },
      configurable: true,
    })

    const { requestId } = await loadRequestId()

    const req = {} as any
    const res = { setHeader: jest.fn() } as any
    const next = jest.fn()
    requestId()(req, res, next)

    expect(randomUUID).toHaveBeenCalledTimes(1)
    expect(req.id).toBe('uuid-global')
    expect(res.setHeader).toHaveBeenCalledWith('Shionlib-Request-Id', 'uuid-global')
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('falls back to node randomUUID when global crypto is missing', async () => {
    const nodeRandomUUID = jest.fn(() => 'uuid-node')
    jest.doMock('node:crypto', () => ({
      randomUUID: nodeRandomUUID,
    }))
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    })

    const { requestId } = await loadRequestId()

    const req = {} as any
    const res = { setHeader: jest.fn() } as any
    const next = jest.fn()
    requestId()(req, res, next)

    expect(nodeRandomUUID).toHaveBeenCalledTimes(1)
    expect(req.id).toBe('uuid-node')
    expect(res.setHeader).toHaveBeenCalledWith('Shionlib-Request-Id', 'uuid-node')
    expect(next).toHaveBeenCalledTimes(1)
  })
})
