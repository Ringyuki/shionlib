import { Processor, Process, InjectQueue } from '@nestjs/bull'
import { Job, Queue } from 'bull'
import { Injectable, Logger } from '@nestjs/common'
import {
  MODERATION_QUEUE,
  OMNI_MODERATION_JOB,
  LLM_MODERATION_JOB,
  LLM_MODERATION_MODEL,
  REVIEW_THRESHOLD_SCORE,
  BLOCK_THRESHOLD_SCORE,
} from '../constants/moderation.constants'
import { OpenaiService } from '../../llms/openai/services/openai.service'
import { PrismaService } from '../../../prisma.service'
import { MessageService } from '../../message/services/message.service'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { ModerateCategoryKey, Prisma } from '@prisma/client'
import { ModerationDecision } from '../enums/decisions.enum'
import { ModerateCategory } from '../enums/categories.enum'
import type { Moderation } from 'openai/resources/moderations'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'

interface ModerationJobPayload {
  commentId: number
}

@Processor(MODERATION_QUEUE)
@Injectable()
export class ModerationProcessor {
  private readonly logger = new Logger(ModerationProcessor.name)

  constructor(
    private readonly openaiService: OpenaiService,
    private readonly prismaService: PrismaService,
    private readonly messageService: MessageService,
    private readonly activityService: ActivityService,
    @InjectQueue(MODERATION_QUEUE) private readonly moderationQueue: Queue,
  ) {}

  @Process({ name: OMNI_MODERATION_JOB, concurrency: 10 })
  async processOmniModeration(job: Job<ModerationJobPayload>) {
    const { commentId } = job.data
    const comment = await this.prismaService.comment.findUnique({
      where: { id: commentId },
      include: {
        parent: {
          select: {
            creator_id: true,
          },
        },
      },
    })
    if (!comment) {
      this.logger.warn(`comment ${commentId} not found, skip`)
      return
    }
    const { results } = await this.openaiService.moderate(
      'omni-moderation-latest',
      this.htmlToPureText(comment.html),
    )
    const moderation = results[0]

    const topCategory = this.getTopCategory(moderation)
    const maxScore = this.getMaxScore(moderation)

    const shouldBlock = maxScore >= BLOCK_THRESHOLD_SCORE
    const needsLlmReview = !shouldBlock && maxScore >= REVIEW_THRESHOLD_SCORE
    const isApproved = maxScore < REVIEW_THRESHOLD_SCORE

    const decision = shouldBlock
      ? ModerationDecision.BLOCK
      : needsLlmReview
        ? ModerationDecision.REVIEW
        : ModerationDecision.ALLOW

    await this.prismaService.$transaction(async tx => {
      await tx.moderation_events.create({
        data: {
          comment_id: commentId,
          audit_by: 1,
          model: 'omni-moderation-latest',
          decision,
          top_category: topCategory,
          categories_json: moderation.categories as unknown as Prisma.InputJsonValue,
          max_score: maxScore,
          scores_json: moderation.category_scores as unknown as Prisma.InputJsonValue,
        },
      })

      if (isApproved) {
        await tx.comment.update({
          where: { id: commentId },
          data: { status: 1 },
        })
        await this.activityService.create(
          {
            type: ActivityType.COMMENT,
            user_id: comment.creator_id,
            game_id: comment.game_id,
            comment_id: commentId,
          },
          tx,
        )
        if (
          comment.parent_id &&
          comment.parent?.creator_id &&
          comment.parent.creator_id !== comment.creator_id
        ) {
          await this.messageService.send(
            {
              type: MessageType.COMMENT_REPLY,
              tone: MessageTone.INFO,
              title: 'Messages.Comment.Reply.Title',
              content: 'Messages.Comment.Reply.Content',
              receiver_id: comment.parent.creator_id,
              comment_id: commentId,
              game_id: comment.game_id,
              sender_id: comment.creator_id,
            },
            tx,
          )
        }
      }

      if (shouldBlock) {
        await tx.comment.update({
          where: { id: commentId },
          data: { status: 3 },
        })
        await this.messageService.send(
          {
            type: MessageType.SYSTEM,
            tone: MessageTone.DESTRUCTIVE,
            title: 'Messages.System.Moderation.Comment.Block.Title',
            content: 'Messages.System.Moderation.Comment.Block.Content',
            receiver_id: comment.creator_id,
            comment_id: commentId,
            game_id: comment.game_id,
            meta: {
              top_category: topCategory,
            },
          },
          tx,
        )
      }
    })
    if (needsLlmReview) {
      await this.moderationQueue.add(LLM_MODERATION_JOB, { commentId })
    }

    return moderation
  }

  @Process({ name: LLM_MODERATION_JOB, concurrency: 1 })
  async processLlmModeration(job: Job<ModerationJobPayload>) {
    const { commentId } = job.data
    const comment = await this.prismaService.comment.findUnique({
      where: { id: commentId },
      include: {
        game: {
          select: {
            title_jp: true,
            title_zh: true,
            title_en: true,
          },
        },
        parent: {
          select: {
            creator_id: true,
            html: true,
          },
        },
      },
    })
    if (!comment) {
      this.logger.warn(`comment ${commentId} not found, skip`)
      return
    }

    const categories = Object.values(ModerateCategory)
    const moderationEvent = z.object({
      decision: z.enum(['ALLOW', 'BLOCK']),
      reason: z.string().max(2550),
      evidence: z.string().max(1000),
      top_category: z.enum(Object.values(ModerateCategoryKey)),
      // categories_json: z.record(z.enum(Object.values(ModerateCategory)), z.boolean()),
      /* some third party api may not support propertyNames generated by z.record()
       * {
       *   "type": "object",
       *   "additionalProperties": { "type": "boolean" },
       *   "propertyNames": { "type": "string" }
       * }
       * so we use z.object({}).catchall(z.boolean()) here:
       * {
       *   "type": "object",
       *   "properties": {},
       *   "additionalProperties": { "type": "boolean" }
       * }
       */
      categories_json: z.object({}).catchall(z.boolean()),
    })

    const gameName = `${comment.game.title_zh} ${comment.game.title_en} ${comment.game.title_jp}`
    const parentComment = comment.parent ? this.htmlToPureText(comment.parent.html) : null
    const context = [
      `Game: ${gameName}`,
      parentComment ? `Replying to: "${parentComment}"` : null,
      `Comment: "${this.htmlToPureText(comment.html)}"`,
    ]
      .filter(Boolean)
      .join('\n')

    const input = [
      {
        role: 'system' as const,
        content: `You are a content moderation system for a game review platform. Analyze the given comment in context and return a moderation decision.
                  Context matters: Gaming slang, hyperbolic expressions (e.g., "I'm dying" meaning frustration), and game-related discussions are generally acceptable.
                  Available categories (use these exact values for top_category and as keys in categories_json):
                  ${categories.map(c => `- ${c}`).join('\n')}
                  For categories_json, set each category to true if the content violates that category, false otherwise.
                  For top_category, select the most relevant violation category (or "harassment" if none apply).
                  If the content is acceptable, set decision to "ALLOW". If it violates policies, set decision to "BLOCK".`,
      },
      {
        role: 'user' as const,
        content: context,
      },
    ]
    const { output_parsed } = await this.openaiService.parseResponse({
      model: LLM_MODERATION_MODEL,
      input,
      text: { format: zodTextFormat(moderationEvent, 'moderationEvent') },
      reasoning: { effort: 'medium' },
    })

    if (!output_parsed) {
      this.logger.warn(`moderation event for comment ${commentId} not found, skip`)
      return
    }

    const isApproved = output_parsed.decision === 'ALLOW'

    await this.prismaService.$transaction(async tx => {
      await tx.moderation_events.create({
        data: {
          comment_id: commentId,
          audit_by: 2,
          model: LLM_MODERATION_MODEL,
          decision: output_parsed.decision,
          reason: output_parsed.reason,
          evidence: output_parsed.evidence,
          top_category: output_parsed.top_category,
          categories_json: output_parsed.categories_json,
        },
      })

      if (isApproved) {
        await tx.comment.update({
          where: { id: commentId },
          data: { status: 1 },
        })
        await this.activityService.create(
          {
            type: ActivityType.COMMENT,
            user_id: comment.creator_id,
            game_id: comment.game_id,
            comment_id: commentId,
          },
          tx,
        )
        if (
          comment.parent_id &&
          comment.parent?.creator_id &&
          comment.parent.creator_id !== comment.creator_id
        ) {
          await this.messageService.send(
            {
              type: MessageType.COMMENT_REPLY,
              tone: MessageTone.INFO,
              title: 'Messages.Comment.Reply.Title',
              content: 'Messages.Comment.Reply.Content',
              receiver_id: comment.parent.creator_id,
              comment_id: commentId,
              game_id: comment.game_id,
              sender_id: comment.creator_id,
            },
            tx,
          )
        }
      } else {
        await tx.comment.update({
          where: { id: commentId },
          data: { status: 3 },
        })
        await this.messageService.send(
          {
            type: MessageType.SYSTEM,
            tone: MessageTone.DESTRUCTIVE,
            title: 'Messages.System.Moderation.Comment.Block.Title',
            content: 'Messages.System.Moderation.Comment.Block.ReviewContent',
            receiver_id: comment.creator_id,
            comment_id: commentId,
            game_id: comment.game_id,
            meta: {
              top_category: output_parsed.top_category,
              reason: output_parsed.reason,
              evidence: output_parsed.evidence,
            },
          },
          tx,
        )
      }
    })

    return output_parsed
  }

  private htmlToPureText(html: string | null): string {
    if (!html) return ''

    return html
      .replace(/<\s*br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private getMaxScore(moderation: Moderation): number {
    return Object.values(moderation.category_scores).reduce((max, score) => Math.max(max, score), 0)
  }

  private getTopCategory(moderation: Moderation): keyof typeof ModerateCategory {
    const scores = moderation.category_scores
    let topCategory = 'harassment'
    let maxScore = -1

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score
        topCategory = category
      }
    }
    const categoryToEnumKey: Record<keyof Moderation['categories'], keyof typeof ModerateCategory> =
      {
        harassment: 'HARASSMENT',
        'harassment/threatening': 'HARASSMENT_THREATENING',
        sexual: 'SEXUAL',
        hate: 'HATE',
        'hate/threatening': 'HATE_THREATENING',
        illicit: 'ILLICIT',
        'illicit/violent': 'ILLICIT_VIOLENT',
        'self-harm/intent': 'SELF_HARM_INTENT',
        'self-harm/instructions': 'SELF_HARM_INSTRUCTIONS',
        'self-harm': 'SELF_HARM',
        'sexual/minors': 'SEXUAL_MINORS',
        violence: 'VIOLENCE',
        'violence/graphic': 'VIOLENCE_GRAPHIC',
      }

    return categoryToEnumKey[topCategory]
  }
}
