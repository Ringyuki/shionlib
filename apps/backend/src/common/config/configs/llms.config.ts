import { LLMsConfig } from '../interfaces/llms.interface'
import { withDefault } from '../../utils/env.util'

export default (): LLMsConfig => ({
  openai: {
    apiKey: withDefault('OPENAI_API_KEY', ''),
    baseURL: withDefault('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
  },
})
