import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Logger, Injectable } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { MessageListItemResDto } from '../dto/res/message-list.res.dto'
import { TokenPayloadInterface } from '../../auth/interfaces/token-payload.interface'
import { MessageQueryService } from '../services/message-query.service'
import { JwtService } from '@nestjs/jwt'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { CacheService } from '../../cache/services/cache.service'

type AuthedSocket = Socket & { data: { user: TokenPayloadInterface } }

@Injectable()
@WebSocketGateway({ namespace: '/ws' })
export class MessageGateway implements OnGatewayConnection, OnGatewayInit {
  private readonly logger = new Logger(MessageGateway.name)
  constructor(
    private readonly messageQueryService: MessageQueryService,
    private readonly jwtService: JwtService,
    private readonly configService: ShionConfigService,
    private readonly cacheService: CacheService,
  ) {}
  @WebSocketServer()
  server: Server

  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      try {
        const cookieHeader = socket.handshake.headers.cookie || ''
        const cookies = cookieHeader
          ?.split(';')
          .map((c: string) => c.trim().split('='))
          .reduce((acc: Record<string, string>, [k, v]) => ((acc[k] = v), acc), {})
        const token = cookies['shionlib_access_token']
        if (!token) return next(new Error('UNAUTHORIZED'))

        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get('token.secret'),
        })

        const blocked = await this.cacheService.get<boolean>(`auth:family:blocked:${payload.fid}`)
        if (blocked) return next(new Error('FAMILY_BLOCKED'))

        socket.data.user = payload
        return next()
      } catch {
        return next(new Error('UNAUTHORIZED'))
      }
    })
  }

  handleConnection(client: AuthedSocket) {
    const userId = client.data.user?.sub

    if (!userId) {
      client.disconnect()
      return
    }
    const room = this.roomOf(userId)
    client.join(room)
    this.logger.log(`WS connected user=${userId} room=${room}`)
  }

  notifyMessageCreated(
    receiverId: number,
    message: Pick<MessageListItemResDto, 'id' | 'title' | 'type' | 'tone' | 'created'>,
  ) {
    const room = this.roomOf(receiverId)
    this.server.to(room).emit('message:new', message)
  }

  notifyUnreadCount(receiverId: number, unread: number) {
    const room = this.roomOf(receiverId)
    this.server.to(room).emit('message:unread', { unread })
  }

  private roomOf(userId: number) {
    return `user:${userId}`
  }

  @SubscribeMessage('message:unread:pull')
  async handleUnreadPull(@ConnectedSocket() client: AuthedSocket) {
    const unread = await this.messageQueryService.getUnreadCount(
      (client.data.user as TokenPayloadInterface).sub,
    )
    client.emit('message:unread', { unread })
  }
}
