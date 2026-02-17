import { Controller, Delete, Get, Param, ParseIntPipe, Query } from '@nestjs/common'
import { CharacterService } from '../services/character.service'
import { GetListReqDto } from '../dto/req/get-list.req.dto'

@Controller('character')
export class CharacterController {
  constructor(private readonly characterDataService: CharacterService) {}

  @Get('list')
  async getList(@Query() dto: GetListReqDto) {
    return this.characterDataService.getList(dto)
  }

  @Get(':id')
  async getCharacter(@Param('id', ParseIntPipe) id: number) {
    return this.characterDataService.getCharacter(id)
  }

  @Delete(':id')
  async deleteCharacter(@Param('id', ParseIntPipe) id: number) {
    return this.characterDataService.deleteById(id)
  }
}
