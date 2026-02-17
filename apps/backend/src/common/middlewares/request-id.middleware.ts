import type { Request, Response, NextFunction } from 'express'
import { randomUUID as nodeRandomUUID } from 'node:crypto'

export const requestId = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.id = globalThis.crypto?.randomUUID?.() ?? nodeRandomUUID()
    res.setHeader('Shionlib-Request-Id', req.id)
    next()
  }
}
