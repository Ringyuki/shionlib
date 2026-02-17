import { shionlibRequest } from './request'
import { VerificationCodeRes } from '@/interfaces/auth/verification-code.interface'

export const verficationCodeUtil = () => {
  const get = async (email: string) => {
    return await shionlibRequest().post<VerificationCodeRes>('/auth/code/request', {
      data: { email },
    })
  }

  const verify = async (uuid: string, code: string) => {
    return await shionlibRequest().post<{ verified: boolean }>('/auth/code/verify', {
      data: { uuid, code },
    })
  }

  return {
    get,
    verify,
  }
}
