import { INestApplication, Logger } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { ServerOptions } from 'socket.io'
import { Redis } from 'ioredis'
import { createAdapter } from '@socket.io/redis-adapter'
import { ShionConfigService } from '../config/services/config.service'

export class ShionWsAdapter extends IoAdapter {
  private readonly logger = new Logger(ShionWsAdapter.name)

  constructor(
    private readonly app: INestApplication,
    private readonly configService: ShionConfigService,
    private readonly redis?: Redis,
  ) {
    super(app)
  }

  createIOServer(port: number, options?: ServerOptions) {
    const cors = {
      origin: [/^http:\/\/localhost:\d+$/],
      methods: this.configService.get('cors.methods'),
      credentials: true,
    }
    const server = super.createIOServer(port, { ...options, cors })

    if (this.redis) {
      const pubClient = this.redis.duplicate({ lazyConnect: true })
      const subClient = this.redis.duplicate({ lazyConnect: true })
      void pubClient.connect().catch(error => {
        this.logger.error('Error connecting to Redis', error)
      })
      void subClient.connect().catch(error => {
        this.logger.error('Error connecting to Redis', error)
      })
      server.adapter(createAdapter(pubClient, subClient))
      this.logger.log('WS Redis adapter initialized')
    }
    this.logger.log('WS server initialized')
    return server
  }
}
