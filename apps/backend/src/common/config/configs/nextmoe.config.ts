import { NextMoeConfig } from '../interfaces/nextmoe.interface'
import { withDefault } from '../../utils/env.util'

export default (): NextMoeConfig => ({
  nextmoe: {
    baseUrl: withDefault('NEXTMOE_API_BASE_URL', 'https://api.nextmoe.dev'),
    apiKey: withDefault('NEXTMOE_API_KEY', ''),
  },
})
