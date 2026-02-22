import { PotatoVNConfig } from '../interfaces/potatovn.interface'
import { withDefault } from '../../utils/env.util'

export default (): PotatoVNConfig => ({
  potatovn: {
    baseUrl: withDefault('POTATOVN_BASE_URL', 'https://api.potatovn.net'),
  },
})
