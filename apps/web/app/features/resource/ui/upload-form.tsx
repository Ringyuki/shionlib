import { Form, FormField, Inline } from '@hina-ui/react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslations } from 'use-intl'
import type { GameHeader } from '~/features/game'
import { GamePicker } from '~/features/search'
import { admit, type Allowance } from '~/features/upload'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { uploadForm, type UploadValues } from '../resource.schema'
import { useStartUpload } from '../use-start-upload'
import { ResourceFields } from './resource-fields'
import { UploadFilesField } from './upload-files-field'
import { UploadGame } from './upload-game'

const blank: UploadValues = { platform: [], language: [], simulator: '', note: '', files: [] }

export function UploadForm({ game, allowance }: { game: GameHeader | null; allowance: Allowance }) {
  const t = useTranslations('resource')
  const issue = useTranslations('resource.issue')
  const kit = useFormKit()
  const [values, setValues] = useState<UploadValues>(blank)
  const [, setSearchParams] = useSearchParams()
  const start = useStartUpload()
  const admission = admit(allowance, values.files)
  return (
    <Form
      values={values}
      rules={uploadForm(kit, issue)}
      onSubmit={() => {
        if (game !== null && admission === undefined) {
          start.create(game, values)
        }
      }}
    >
      <FormField name="game" label={t('uploadGame')} required>
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
        onValuesChange={fields => setValues({ ...values, ...fields })}
      />
      <Inline justify="end">
        <Button type="submit" disabled={game === null}>
          {t('uploadStart')}
        </Button>
      </Inline>
    </Form>
  )
}
