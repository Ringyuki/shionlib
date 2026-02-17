'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Save, WandSparkles } from 'lucide-react'
import { useRouter } from '@/i18n/navigation.client'
import { Button } from '@/components/shionui/Button'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { jsonSchema } from 'codemirror-json-schema'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { updateGameScalar } from '@/components/admin/hooks/useAdminContent'
import { normalizeScalar, GAME_SCALAR_JSON_SCHEMA } from './constant/game'
import { useTheme } from 'next-themes'

interface AdminGameScalarEditorProps {
  gameId: number
  data: Partial<GameScalar>
}

const isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function AdminGameScalarEditor({ gameId, data }: AdminGameScalarEditorProps) {
  const t = useTranslations('Admin.Games')
  const router = useRouter()
  const initialJson = useMemo(() => JSON.stringify(normalizeScalar(data), null, 2), [data])
  const [jsonText, setJsonText] = useState(initialJson)
  const [initialText, setInitialText] = useState(initialJson)
  const [parseError, setParseError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const hasChanges = jsonText !== initialText
  const { systemTheme } = useTheme()

  const parsePayload = (source: string) => {
    const parsed = JSON.parse(source) as unknown
    if (!isRecord(parsed)) {
      throw new Error(t('jsonObjectOnly'))
    }
    return parsed
  }

  const handleFormat = () => {
    try {
      const parsed = parsePayload(jsonText)
      const formatted = JSON.stringify(parsed, null, 2)
      setJsonText(formatted)
      setParseError(null)
      toast.success(t('jsonFormatted'))
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('jsonInvalid')
      setParseError(msg)
      toast.error(t('jsonInvalid'))
    }
  }

  const onSubmit = async () => {
    try {
      setLoading(true)
      const parsed = parsePayload(jsonText)
      setParseError(null)
      await updateGameScalar(gameId, parsed)
      const formatted = JSON.stringify(parsed, null, 2)
      setJsonText(formatted)
      setInitialText(formatted)
      toast.success(t('editSaved'))
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof Error) {
        const msg = error.message || t('jsonInvalid')
        setParseError(msg)
      }
      toast.error(t('editFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('editTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('rawEditDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            intent="neutral"
            appearance="ghost"
            renderIcon={<WandSparkles className="size-4" />}
            onClick={handleFormat}
          >
            {t('formatJson')}
          </Button>
          <Button
            intent="neutral"
            appearance="ghost"
            renderIcon={<ArrowLeft className="size-4" />}
            onClick={() => router.back()}
          >
            {t('backToList')}
          </Button>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border [&_.cm-editor]:w-full [&_.cm-editor]:max-w-full [&_.cm-editor]:min-w-0 [&_.cm-content]:max-w-full [&_.cm-line]:[overflow-wrap:anywhere] [&_.cm-scroller]:overflow-x-hidden [&_.cm-scroller]:overflow-y-auto">
        <CodeMirror
          theme={systemTheme}
          value={jsonText}
          height="62vh"
          className="w-full max-w-full min-w-0"
          extensions={[...jsonSchema(GAME_SCALAR_JSON_SCHEMA as any), EditorView.lineWrapping]}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            autocompletion: true,
            highlightActiveLine: true,
            bracketMatching: true,
          }}
          onChange={value => {
            setJsonText(value)
            if (parseError) {
              setParseError(null)
            }
          }}
        />
      </div>
      {parseError && (
        <p className="text-sm text-destructive">
          {t('jsonInvalid')}: {parseError}
        </p>
      )}

      <Button
        type="button"
        className="mt-10 w-full"
        loading={loading}
        disabled={!hasChanges}
        renderIcon={<Save className="size-4" />}
        onClick={onSubmit}
      >
        {t('save')}
      </Button>
    </div>
  )
}
