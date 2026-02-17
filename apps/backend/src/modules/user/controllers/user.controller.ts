import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Get,
  UseGuards,
  Param,
  ParseIntPipe,
} from '@nestjs/common'
import { Response } from 'express'
import { UserService } from '../services/user.service'
import { CreateUserDto } from '../dto/req/CreateUser.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { LoginDto } from '../dto/req/Login.req.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { BanUserReqDto } from '../dto/req/ban-user.req.dto'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ShionConfigService,
  ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto, @Req() request: RequestWithUser) {
    return await this.userService.create(createUserDto, request)
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, refresh_token } = await this.userService.login(loginDto, request)

    response.setHeader('Set-Cookie', [
      `shionlib_access_token=${token}; HttpOnly; ${this.configService.get('environment') === 'production' && loginDto.identifier !== 'ringyuki' ? 'Secure' : ''} ; SameSite=Lax; Path=/; Max-Age=${this.configService.get('token.expiresIn')}`,
      `shionlib_refresh_token=${refresh_token}; HttpOnly; ${this.configService.get('environment') === 'production' && loginDto.identifier !== 'ringyuki' ? 'Secure' : ''}; SameSite=Lax; Path=/; Max-Age=${this.configService.get('refresh_token.shortWindowSec')}`,
    ])
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() request: RequestWithUser) {
    return await this.userService.getMe(request)
  }

  @Get(':id')
  async getUser(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.getById(id)
  }

  @Post('check-name')
  async checkName(@Body() body: { name: string }) {
    return await this.userService.checkName(body.name)
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ShionlibUserRoles.ADMIN)
  @Post(':id/ban')
  async ban(@Body() dto: BanUserReqDto, @Param('id', ParseIntPipe) id: number) {
    return await this.userService.ban(id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ShionlibUserRoles.ADMIN)
  @Post(':id/unban')
  async unban(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.unban(id)
  }
}
