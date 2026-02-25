import { Processor, Process, InjectQueue } from '@nestjs/bull'
import { Job, Queue } from 'bull'
import { Injectable, Logger } from '@nestjs/common'
import {
  MODERATION_QUEUE,
  OMNI_COMMENT_MODERATION_JOB,
  LLM_COMMENT_MODERATION_JOB,
  LLM_WALKTHROUGH_MODERATION_JOB,
  LLM_MODERATION_MODEL,
  REVIEW_THRESHOLD_SCORE,
  BLOCK_THRESHOLD_SCORE,
} from '../constants/moderation.constants'
import { OpenaiService } from '../../llms/openai/services/openai.service'
import { PrismaService } from '../../../prisma.service'
import { MessageService } from '../../message/services/message.service'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { ModerateCategoryKey, Prisma, WalkthroughStatus } from '@prisma/client'
import { ModerationDecision } from '../enums/decisions.enum'
import { ModerateCategory } from '../enums/categories.enum'
import type { Moderation } from 'openai/resources/moderations'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'
import {
  CommentModerationJobPayload,
  WalkthroughModerationJobPayload,
  ParsedLlmModerationEvent,
} from '../interfaces/moderate.interface'

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

  @Process({ name: OMNI_COMMENT_MODERATION_JOB, concurrency: 10 })
  async processCommentOmniModeration(job: Job<CommentModerationJobPayload>) {
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
      await this.moderationQueue.add(LLM_COMMENT_MODERATION_JOB, { commentId })
    }

    return moderation
  }

  @Process({ name: LLM_COMMENT_MODERATION_JOB, concurrency: 1 })
  async processCommentLlmModeration(job: Job<CommentModerationJobPayload>) {
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

    const gameName = `${comment.game.title_zh} ${comment.game.title_en} ${comment.game.title_jp}`
    const parentComment = comment.parent ? this.htmlToPureText(comment.parent.html) : null
    const context = [
      `Game: ${gameName}`,
      parentComment ? `Replying to: "${parentComment}"` : null,
      `Comment: "${this.htmlToPureText(comment.html)}"`,
    ]
      .filter(Boolean)
      .join('\n')

    const outputParsed = await this.parseLlmModeration({
      contentType: 'comment',
      context,
    })

    if (!outputParsed) {
      this.logger.warn(`moderation event for comment ${commentId} not found, skip`)
      return
    }

    const isApproved = outputParsed.decision === 'ALLOW'

    await this.prismaService.$transaction(async tx => {
      await tx.moderation_events.create({
        data: {
          comment_id: commentId,
          audit_by: 2,
          model: LLM_MODERATION_MODEL,
          decision: outputParsed.decision,
          reason: outputParsed.reason,
          evidence: outputParsed.evidence,
          top_category: outputParsed.top_category,
          categories_json: outputParsed.categories_json,
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
              top_category: outputParsed.top_category,
              reason: outputParsed.reason,
              evidence: outputParsed.evidence,
            },
          },
          tx,
        )
      }
    })

    return outputParsed
  }

  @Process({ name: LLM_WALKTHROUGH_MODERATION_JOB, concurrency: 1 })
  async processWalkthroughLlmModeration(job: Job<WalkthroughModerationJobPayload>) {
    const { walkthroughId } = job.data
    const walkthrough = await this.prismaService.walkthrough.findUnique({
      where: { id: walkthroughId },
      include: {
        game: {
          select: {
            title_jp: true,
            title_zh: true,
            title_en: true,
          },
        },
      },
    })

    if (!walkthrough || walkthrough.status === WalkthroughStatus.DELETED) {
      this.logger.warn(`walkthrough ${walkthroughId} not found, skip`)
      return
    }

    const gameName = `${walkthrough.game.title_zh} ${walkthrough.game.title_en} ${walkthrough.game.title_jp}`
    const context = [
      `Game: ${gameName}`,
      `Walkthrough title: "${walkthrough.title}"`,
      `Walkthrough content: "${this.htmlToPureText(walkthrough.html)}"`,
    ].join('\n')

    const outputParsed = await this.parseLlmModeration({
      contentType: 'walkthrough',
      context,
    })

    if (!outputParsed) {
      this.logger.warn(`moderation event for walkthrough ${walkthroughId} not found, skip`)
      return
    }

    await this.prismaService.$transaction(async tx => {
      await tx.moderation_events.create({
        data: {
          walkthrough_id: walkthroughId,
          audit_by: 2,
          model: LLM_MODERATION_MODEL,
          decision: outputParsed.decision,
          reason: outputParsed.reason,
          evidence: outputParsed.evidence,
          top_category: outputParsed.top_category,
          categories_json: outputParsed.categories_json,
        },
      })

      if (outputParsed.decision === 'BLOCK') {
        await tx.walkthrough.updateMany({
          where: { id: walkthroughId, status: { not: WalkthroughStatus.DELETED } },
          data: { status: WalkthroughStatus.HIDDEN },
        })
        await this.messageService.send(
          {
            type: MessageType.SYSTEM,
            tone: MessageTone.DESTRUCTIVE,
            title: 'Messages.System.Moderation.Walkthrough.Block.Title',
            content: 'Messages.System.Moderation.Walkthrough.Block.ReviewContent',
            receiver_id: walkthrough.creator_id,
            game_id: walkthrough.game_id,
            link_text: 'Messages.System.Moderation.Walkthrough.Block.LinkText',
            link_url: `/game/${walkthrough.game_id}/walkthrough/${walkthroughId}`,
            meta: {
              top_category: outputParsed.top_category,
              reason: outputParsed.reason,
              evidence: outputParsed.evidence,
              walkthrough_title: walkthrough.title,
              walkthrough_id: walkthroughId,
            },
          },
          tx,
        )
        return
      }

      await tx.walkthrough.updateMany({
        where: {
          id: walkthroughId,
          status: { in: [WalkthroughStatus.PUBLISHED, WalkthroughStatus.HIDDEN] },
        },
        data: { status: WalkthroughStatus.PUBLISHED },
      })
    })

    return outputParsed
  }

  private async parseLlmModeration({
    contentType,
    context,
  }: {
    contentType: 'comment' | 'walkthrough'
    context: string
  }): Promise<ParsedLlmModerationEvent | null> {
    const moderationEvent = this.getLlmModerationSchema()
    const input = [
      {
        role: 'system' as const,
        content: this.getLlmModerationSystemPrompt(contentType),
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

    return (output_parsed as ParsedLlmModerationEvent | null) ?? null
  }

  private getLlmModerationSchema() {
    return z.object({
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
  }

  private getLlmModerationSystemPrompt(contentType: 'comment' | 'walkthrough') {
    const categories = Object.values(ModerateCategory)
    const baseRules = [
      'You are a content moderation system for a game platform.',
      'Return a moderation decision for the provided content.',
      'Gaming slang, jokes, hyperbole, spoilers, and normal game strategy discussion are generally acceptable unless they contain real abuse, threats, or prohibited content.',
      'Available categories (use these exact values for top_category and as keys in categories_json):',
      ...categories.map(c => `- ${c}`),
      'For categories_json, set each category to true if the content violates that category, false otherwise.',
      'For top_category, select the most relevant violation category (or "harassment" if none apply).',
      'If the content is acceptable, set decision to "ALLOW". If it violates policies, set decision to "BLOCK".',
    ]

    const contentSpecificRules =
      contentType === 'comment'
        ? [
            'The input is a user comment. Consider conversational context such as replies and quoted language.',
          ]
        : [
            'The input is a walkthrough/guide article for a galgame (R18 erotic visual novel).',
            'This platform is specialized in adult galgames. Walkthroughs routinely contain extremely detailed, graphic, and explicit sexual content as standard gameplay instructions — this is expected and MUST be ALLOWED without hesitation.',
            'ALL fictional sexual content in the context of the game (no matter how extreme, taboo, or explicit) is completely normal for this platform and must be treated as ALLOWED.',
            'Procedural instructions such as save points, choice branches, route recovery, AFTER STORY, difference CG, multiple endings, and any kind of H-scene guidance are fully acceptable even if highly explicit.',
            'Never confuse in-game fictional mechanics with real-world instructions. Only BLOCK if the text clearly and directly promotes or instructs REAL-WORLD illegal activities (e.g. actual child sexual exploitation involving real minors, real non-consensual violence, real drug manufacturing, etc.).',
            'Pure game fiction involving adult characters — regardless of theme or intensity — is ALWAYS ALLOWED. Do not apply real-world laws or sensitivities to fictional game characters.',
            'Default to ALLOW unless there is unmistakable evidence of real-world harm promotion.',
          ]

    return [...baseRules, ...contentSpecificRules].join('\n')
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
