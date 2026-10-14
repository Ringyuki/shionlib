import { Form, FormField, Inline } from '@hina-ui/react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslations } from 'use-intl'
import type { GameHeader } from '~/features/game'
import { GamePicker } from '~/features/search'
import { admit, type Allowance } from '~/features/upload'
import { useFormKit } from '~/shared/form/use-form-kit'
import { blankDocument } from '~/shared/richtext/rich-text'
import { Button } from '~/shared/ui/button'
import { blankInfo } from '../resource-info'
import { filledFrom } from '../resource-name'
import { uploadForm, type UploadValues } from '../resource.schema'
import { useNameReading } from '../use-name-reading'
import { useResourceIssue } from '../use-resource-issue'
import { useStartUpload } from '../use-start-upload'
import { ResourceFields } from './resource-fields'
import { UploadFilesField } from './upload-files-field'
import { UploadGame } from './upload-game'

const blank: UploadValues = {
  platform: [],
  language: [],
  simulator: '',
  note: blankDocument,
  files: [],
  ...blankInfo,
}

export function UploadForm({ game, allowance }: { game: GameHeader | null; allowance: Allowance }) {
  const t = useTranslations('resource')
  const issue = useResourceIssue()
  const kit = useFormKit()
  const [values, setValues] = useState<UploadValues>(blank)
  const [, setSearchParams] = useSearchParams()
  const start = useStartUpload()
  const admission = admit(allowance, values.files)
  const chosen = values.files[0]?.name
  useNameReading(chosen, reading =>
    setValues(current => ({ ...current, ...filledFrom(current, reading) })),
  )
  return (
    <Form
      values={values}
      rules={uploadForm(kit, issue)}
      onSubmit={() => {
        if (game !== null && admission === undefined && !start.leaving) {
          start.create(game, values)
        }
      }}
    >
      {({ errors }) => (
        <>
          <FormField
            name="game"
            label={t('uploadGame')}
            description={game === null ? t('uploadGameHint') : undefined}
            required
          >
            {game === null ? (
              <GamePicker onPick={id => setSearchParams({ game: String(id) })} />
            ) : (
              <UploadGame game={game} onChange={() => setSearchParams({})} />
            )}
          </FormField>
          <UploadFilesField
            allowance={allowance}
            admission={admission}
            multiple
            files={values.files}
            onFilesChange={files => setValues({ ...values, files })}
          />
          <ResourceFields
            values={values}
            complete
            named={game === null ? undefined : { gameId: game.id, fileName: chosen ?? '' }}
            errors={errors}
            onValuesChange={fields => setValues({ ...values, ...fields })}
          />
          <Inline justify="end">
            <Button
              type="submit"
              loading={start.leaving}
              disabled={game === null || admission !== undefined}
            >
              {t('uploadStart')}
            </Button>
          </Inline>
        </>
      )}
    </Form>
  )
}
