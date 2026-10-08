import {
  AlertDialog,
  Form,
  FormField,
  Inline,
  Input,
  PageHeader,
  Result,
  Stack,
  toast,
} from '@hina-ui/react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle } from '~/features/game'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useLeaveGuard } from '~/shared/route/use-leave-guard'
import { BBCodeEditor } from '~/shared/ui/bbcode-editor'
import { Button } from '~/shared/ui/button'
import { useWalkthroughSave } from '../use-walkthrough-save'
import { walkthroughPath, type Draft } from '../walkthrough'
import { walkthroughForm, type WalkthroughValues } from '../walkthrough.schema'

export function WalkthroughEditorPage({ draft, signedIn }: { draft: Draft; signedIn: boolean }) {
  const t = useTranslations('walkthrough')
  const issue = useTranslations('walkthrough.issue')
  const locale = useLocale()
  const navigate = useNavigate()
  const kit = useFormKit()
  const [values, setValues] = useState<WalkthroughValues>({
    title: draft.title,
    content: draft.content,
  })
  const publishing = useRef(false)
  const save = useWalkthroughSave()
  const form = useFormErrors(save.failure)
  const guard = useLeaveGuard(values.title !== draft.title || values.content !== draft.content)
  const editing = draft.walkthroughId !== undefined
  const title = t(editing ? 'editTitle' : 'writeTitle')
  const description = t('for', { game: gameTitle(draft.game, locale) })
  if (!signedIn) {
    return (
      <Stack gap="lg">
        <PageHeader title={title} description={description} />
        <Result
          status="info"
          title={t('signIn')}
          actions={<Button loginRequired>{t('signInAction')}</Button>}
        />
      </Stack>
    )
  }
  const submit = (publish: boolean) => {
    publishing.current = publish
    void form.current?.submit()
  }
  return (
    <Stack gap="lg" className="mx-auto w-full max-w-3xl">
      <PageHeader title={title} description={description} />
      <Form
        ref={form}
        values={values}
        rules={walkthroughForm(kit, issue)}
        onSubmit={async () => {
          const publish = publishing.current
          const outcome = await save.run({
            gameId: draft.game.id,
            walkthroughId: draft.walkthroughId,
            publish,
            ...values,
          })
          if (outcome.ok) {
            const { id, reviewPending } = outcome.result
            toast.success(
              t(publish ? (reviewPending ? 'sentForReview' : 'published') : 'draftSaved'),
            )
            guard.release()
            void navigate(walkthroughPath(locale, draft.game.id, id))
          }
        }}
      >
        <FormField name="title" label={t('title')} required>
          <Input
            value={values.title}
            onValueChange={next => setValues({ ...values, title: next })}
          />
        </FormField>
        <FormField name="content" label={t('content')} description={t('contentHint')} required>
          <BBCodeEditor
            document
            rows={16}
            value={values.content}
            onValueChange={content => setValues({ ...values, content })}
          />
        </FormField>
        <Inline justify="end" gap="sm">
          <Button
            variant="outline"
            tone="neutral"
            disabled={save.pending}
            onClick={() => submit(false)}
          >
            {t(draft.published ? 'backToDraft' : 'saveDraft')}
          </Button>
          <Button loading={save.pending} onClick={() => submit(true)}>
            {t('publish')}
          </Button>
        </Inline>
      </Form>
      <AlertDialog
        title={t('leaveConfirm')}
        description={t('leaveDescription')}
        confirmText={t('leave')}
        cancelText={t('stay')}
        tone="danger"
        open={guard.leaving}
        onOpenChange={open => {
          if (!open) {
            guard.stay()
          }
        }}
        onConfirm={() => guard.leave()}
      />
    </Stack>
  )
}
