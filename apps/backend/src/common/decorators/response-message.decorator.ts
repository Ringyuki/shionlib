import { SetMetadata } from '@nestjs/common'
import { RESPONSE_MESSAGE_KEY } from '../interceptors/success-response.interceptor'

export const ResponseMessage = (key: string) => SetMetadata(RESPONSE_MESSAGE_KEY, key)
