jest.mock('openai/helpers/zod', () => ({
  zodTextFormat: jest.fn(() => ({ type: 'json_schema' })),
}))

import { ModerationProcessor } from './moderation.processor'
import { ModerationDecision } from '../enums/decisions.enum'
import { LLM_MODERATION_JOB, LLM_MODERATION_MODEL } from '../constants/moderation.constants'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'

const CATEGORY_KEYS = [
  'harassment',
  'harassment/threatening',
  'sexual',
  'hate',
  'hate/threatening',
  'illicit',
  'illicit/violent',
  'self-harm/intent',
  'self-harm/instructions',
  'self-harm',
  'sexual/minors',
  'violence',
  'violence/graphic',
] as const

function createModeration(
  topCategory: (typeof CATEGORY_KEYS)[number] = 'harassment',
  score = 0,
): any {
  const categories: Record<string, boolean> = {}
  const categoryScores: Record<string, number> = {}
  for (const key of CATEGORY_KEYS) {
    categories[key] = false
    categoryScores[key] = 0
  }
  categoryScores[topCategory] = score
  categories[topCategory] = score > 0
  return {
    categories,
    category_scores: categoryScores,
  }
}

describe('ModerationProcessor', () => {
  const makeProcessor = () => {
    const tx = {
      moderation_events: { create: jest.fn().mockResolvedValue(undefined) },
      comment: { update: jest.fn().mockResolvedValue(undefined) },
    }
    const prismaService = {
      comment: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb: (arg: any) => Promise<unknown>) => cb(tx)),
    }
    const openaiService = {
      moderate: jest.fn(),
      parseResponse: jest.fn(),
    }
    const messageService = { send: jest.fn().mockResolvedValue(undefined) }
    const activityService = { create: jest.fn().mockResolvedValue(undefined) }
    const moderationQueue = { add: jest.fn().mockResolvedValue(undefined) }
    const processor = new ModerationProcessor(
      openaiService as any,
      prismaService as any,
      messageService as any,
      activityService as any,
      moderationQueue as any,
    )
    const logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() }
    ;(processor as any).logger = logger

    return {
      processor,
      tx,
      prismaService,
      openaiService,
      messageService,
      activityService,
      moderationQueue,
      logger,
    }
  }

  it('skips omni moderation when comment is missing', async () => {
    const { processor, prismaService, logger, openaiService } = makeProcessor()
    prismaService.comment.findUnique.mockResolvedValue(null)

    await expect(processor.processOmniModeration({ data: { commentId: 42 } } as any)).resolves.toBe(
      undefined,
    )

    expect(logger.warn).toHaveBeenCalledWith('comment 42 not found, skip')
    expect(openaiService.moderate).not.toHaveBeenCalled()
  })

  it('approves comment in omni moderation and notifies parent author', async () => {
    const {
      processor,
      prismaService,
      openaiService,
      tx,
      activityService,
      messageService,
      moderationQueue,
    } = makeProcessor()
    prismaService.comment.findUnique.mockResolvedValue({
      id: 11,
      creator_id: 7,
      game_id: 99,
      parent_id: 66,
      html: '<p>Hello<br/>World</p>',
      parent: { creator_id: 9 },
    })
    const moderation = createModeration('harassment', 0.01)
    openaiService.moderate.mockResolvedValue({ results: [moderation] })

    const result = await processor.processOmniModeration({ data: { commentId: 11 } } as any)

    expect(result).toBe(moderation)
    expect(openaiService.moderate).toHaveBeenCalledWith('omni-moderation-latest', 'Hello World')
    expect(tx.moderation_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          comment_id: 11,
          decision: ModerationDecision.ALLOW,
          top_category: 'HARASSMENT',
        }),
      }),
    )
    expect(tx.comment.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { status: 1 } })
    expect(activityService.create).toHaveBeenCalledTimes(1)
    expect(messageService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.COMMENT_REPLY,
        tone: MessageTone.INFO,
        receiver_id: 9,
      }),
      expect.any(Object),
    )
    expect(moderationQueue.add).not.toHaveBeenCalled()
  })

  it('sends review job in omni moderation when score is between review and block thresholds', async () => {
    const {
      processor,
      prismaService,
      openaiService,
      tx,
      moderationQueue,
      activityService,
      messageService,
    } = makeProcessor()
    prismaService.comment.findUnique.mockResolvedValue({
      id: 15,
      creator_id: 8,
      game_id: 100,
      parent_id: null,
      html: '<div>Needs review</div>',
      parent: null,
    })
    const moderation = createModeration('hate', 0.2)
    openaiService.moderate.mockResolvedValue({ results: [moderation] })

    await processor.processOmniModeration({ data: { commentId: 15 } } as any)

    expect(tx.moderation_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: ModerationDecision.REVIEW,
          top_category: 'HATE',
        }),
      }),
    )
    expect(tx.comment.update).not.toHaveBeenCalled()
    expect(activityService.create).not.toHaveBeenCalled()
    expect(messageService.send).not.toHaveBeenCalled()
    expect(moderationQueue.add).toHaveBeenCalledWith(LLM_MODERATION_JOB, { commentId: 15 })
  })

  it('blocks comment in omni moderation and sends system notice', async () => {
    const { processor, prismaService, openaiService, tx, messageService, moderationQueue } =
      makeProcessor()
    prismaService.comment.findUnique.mockResolvedValue({
      id: 21,
      creator_id: 5,
      game_id: 13,
      parent_id: null,
      html: '<p>bad</p>',
      parent: null,
    })
    const moderation = createModeration('violence', 0.95)
    openaiService.moderate.mockResolvedValue({ results: [moderation] })

    await processor.processOmniModeration({ data: { commentId: 21 } } as any)

    expect(tx.moderation_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: ModerationDecision.BLOCK,
          top_category: 'VIOLENCE',
        }),
      }),
    )
    expect(tx.comment.update).toHaveBeenCalledWith({ where: { id: 21 }, data: { status: 3 } })
    expect(messageService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.SYSTEM,
        tone: MessageTone.DESTRUCTIVE,
        receiver_id: 5,
      }),
      expect.any(Object),
    )
    expect(moderationQueue.add).not.toHaveBeenCalled()
  })

  it('skips llm moderation when comment is missing', async () => {
    const { processor, prismaService, logger, openaiService } = makeProcessor()
    prismaService.comment.findUnique.mockResolvedValue(null)

    await expect(processor.processLlmModeration({ data: { commentId: 33 } } as any)).resolves.toBe(
      undefined,
    )

    expect(logger.warn).toHaveBeenCalledWith('comment 33 not found, skip')
    expect(openaiService.parseResponse).not.toHaveBeenCalled()
  })

  it('skips llm moderation when model returns no parsed output', async () => {
    const { processor, prismaService, openaiService, logger } = makeProcessor()
    prismaService.comment.findUnique.mockResolvedValue({
      id: 40,
      creator_id: 2,
      game_id: 7,
      html: '<p>Text</p>',
      game: { title_zh: 'Zh', title_en: 'En', title_jp: 'Jp' },
      parent_id: null,
      parent: null,
    })
    openaiService.parseResponse.mockResolvedValue({ output_parsed: null })

    await expect(processor.processLlmModeration({ data: { commentId: 40 } } as any)).resolves.toBe(
      undefined,
    )

    expect(logger.warn).toHaveBeenCalledWith('moderation event for comment 40 not found, skip')
  })

  it('applies llm allow decision and emits reply message for parent author', async () => {
    const { processor, prismaService, openaiService, tx, activityService, messageService } =
      makeProcessor()
    prismaService.comment.findUnique.mockResolvedValue({
      id: 50,
      creator_id: 6,
      game_id: 8,
      html: '<p>Nice game</p>',
      game: { title_zh: 'A', title_en: 'B', title_jp: 'C' },
      parent_id: 90,
      parent: { creator_id: 77, html: '<b>Parent</b>' },
    })
    openaiService.parseResponse.mockResolvedValue({
      output_parsed: {
        decision: 'ALLOW',
        reason: 'safe',
        evidence: 'normal speech',
        top_category: 'HARASSMENT',
        categories_json: { harassment: false },
      },
    })

    const result = await processor.processLlmModeration({ data: { commentId: 50 } } as any)

    expect(result).toEqual(
      expect.objectContaining({
        decision: 'ALLOW',
        top_category: 'HARASSMENT',
      }),
    )
    expect(openaiService.parseResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: LLM_MODERATION_MODEL,
        input: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Replying to: "Parent"'),
          }),
        ]),
      }),
    )
    expect(tx.moderation_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          audit_by: 2,
          decision: 'ALLOW',
        }),
      }),
    )
    expect(tx.comment.update).toHaveBeenCalledWith({ where: { id: 50 }, data: { status: 1 } })
    expect(activityService.create).toHaveBeenCalledTimes(1)
    expect(messageService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.COMMENT_REPLY,
        receiver_id: 77,
      }),
      expect.any(Object),
    )
  })

  it('applies llm block decision and sends system moderation message', async () => {
    const { processor, prismaService, openaiService, tx, messageService } = makeProcessor()
    prismaService.comment.findUnique.mockResolvedValue({
      id: 51,
      creator_id: 18,
      game_id: 80,
      html: '<p>unsafe</p>',
      game: { title_zh: 'A', title_en: 'B', title_jp: 'C' },
      parent_id: null,
      parent: null,
    })
    openaiService.parseResponse.mockResolvedValue({
      output_parsed: {
        decision: 'BLOCK',
        reason: 'threat',
        evidence: 'violent phrase',
        top_category: 'VIOLENCE',
        categories_json: { violence: true },
      },
    })

    await processor.processLlmModeration({ data: { commentId: 51 } } as any)

    expect(tx.comment.update).toHaveBeenCalledWith({ where: { id: 51 }, data: { status: 3 } })
    expect(messageService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.SYSTEM,
        tone: MessageTone.DESTRUCTIVE,
        meta: expect.objectContaining({
          top_category: 'VIOLENCE',
          reason: 'threat',
        }),
      }),
      expect.any(Object),
    )
  })

  it('normalizes html and computes category helpers', () => {
    const { processor } = makeProcessor()
    const text = (processor as any).htmlToPureText(' <p>Hi<br/>  <b>there</b> </p> ')
    expect(text).toBe('Hi there')
    expect((processor as any).htmlToPureText(null)).toBe('')

    const moderation = createModeration('hate/threatening', 0.77)
    expect((processor as any).getMaxScore(moderation)).toBe(0.77)
    expect((processor as any).getTopCategory(moderation)).toBe('HATE_THREATENING')
  })
})
