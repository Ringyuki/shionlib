export type ErrorResponseBody = {
  code: number
  message: string
  timestamp: string
  version: string
}

export type ErrorResponder = (status: number, message: string) => Response
