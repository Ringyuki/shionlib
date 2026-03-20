import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import {
  GameDownloadSourceReportVerdict,
  ReviewGameDownloadSourceReportReqDto,
} from './review-game-download-source-report.req.dto'

describe('ReviewGameDownloadSourceReportReqDto', () => {
  it('transforms boolean flags from plain payloads', () => {
    const dto = plainToInstance(ReviewGameDownloadSourceReportReqDto, {
      verdict: GameDownloadSourceReportVerdict.VALID,
      notify: 0,
      remove_resource: 1,
    })

    expect(dto.notify).toBe(false)
    expect(dto.remove_resource).toBe(true)
    expect(validateSync(dto)).toHaveLength(0)
  })
})
