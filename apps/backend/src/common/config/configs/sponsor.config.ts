import { SponsorConfig } from '../interfaces/sponsor.interface'
import { withDefault } from '../../utils/env.util'

export default (): SponsorConfig => ({
  sponsor: {
    enabled: withDefault('SPONSOR_ENABLED', false),
    provider: withDefault('SPONSOR_PROVIDER', 'idatariver'),
    idatariver: {
      baseUrl: withDefault('IDATARIVER_BASE_URL', 'https://open.idatariver.com'),
      developerSecret: withDefault('IDATARIVER_DEVELOPER_SECRET', ''),
      projectId: withDefault('IDATARIVER_PROJECT_ID', ''),
    },
  },
})
