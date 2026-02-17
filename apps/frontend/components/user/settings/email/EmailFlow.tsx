import { defineStepper } from '@/components/shionui/Stepper'
import { useTranslations } from 'next-intl'
import { VerfiyCurrent } from '@/components/user/settings/email/VerfiyCurrent'
import { VerifyNew } from '@/components/user/settings/email/VerifyNew'
import { Button } from '@/components/shionui/Button'
import { useMemo, useState } from 'react'
import { verifyCodeSchemaInterface } from '@/components/user/settings/email/VerfiyCurrent'
import { verifyNewSchemaInterface } from '@/components/user/settings/email/VerifyNew'
import { z } from 'zod'
import { useRef } from 'react'

interface EmailFlowProps {
  currentEmail: string
  className?: string
  variant?: 'vertical' | 'horizontal'
  onSubmit: (data: {
    currentCode: string
    newEmail: string
    newEmailCodeUuid: string
    newEmailCode: string
  }) => void
  isSubmitting: boolean
}

export const EmailFlow = ({
  currentEmail,
  className,
  variant = 'horizontal',
  onSubmit,
  isSubmitting,
}: EmailFlowProps) => {
  const t = useTranslations('Components.User.Settings.EmailFlow')
  const [currentCode, setCurrentCode] = useState<string | null>(null)
  const step1Ref = useRef<{ submitForm: () => void }>(null)
  const step2Ref = useRef<{ submitForm: () => void }>(null)

  const { Stepper } = useMemo(
    () =>
      defineStepper(
        {
          id: '1',
          title: t('step1.title'),
          description: t('step1.description'),
        },
        { id: '2', title: t('step2.title'), description: t('step2.description') },
      ),
    [t],
  )

  const handleStep1Next = () => {
    step1Ref.current?.submitForm()
  }
  const handleStep1Submit = (data: z.infer<typeof verifyCodeSchemaInterface>, next: () => void) => {
    setCurrentCode(data.verify_code)
    next()
  }

  const handleStep2Next = () => {
    step2Ref.current?.submitForm()
  }
  const handleStep2Submit = (data: z.infer<typeof verifyNewSchemaInterface>) => {
    onSubmit({
      currentCode: currentCode ?? '',
      newEmail: data.new_email,
      newEmailCodeUuid: data.new_email_code_uuid,
      newEmailCode: data.verify_code,
    })
  }

  return (
    <Stepper.Provider variant={variant}>
      {({ methods }) => (
        <div className={className}>
          <Stepper.Navigation>
            {methods.all.map(step => (
              <Stepper.Step of={step.id} key={step.id}>
                <Stepper.Title>{step.title}</Stepper.Title>
                <Stepper.Description>{step.description}</Stepper.Description>
              </Stepper.Step>
            ))}
          </Stepper.Navigation>
          <Stepper.Panel className="w-full pt-4 space-y-4">
            {methods.switch({
              '1': () => (
                <VerfiyCurrent
                  currentEmail={currentEmail}
                  onSubmit={data => handleStep1Submit(data, methods.next)}
                  ref={step1Ref}
                />
              ),
              '2': () => <VerifyNew onSubmit={handleStep2Submit} ref={step2Ref} />,
            })}
          </Stepper.Panel>
          <Stepper.Controls className="mt-4">
            {methods.all.length > 1 && (
              <Button intent="secondary" onClick={() => methods.prev()} disabled={methods.isFirst}>
                {t('previous')}
              </Button>
            )}
            <Button
              intent="primary"
              onClick={methods.isLast ? () => handleStep2Next() : () => handleStep1Next()}
              loading={isSubmitting}
            >
              {methods.isLast ? t('done') : t('next')}
            </Button>
          </Stepper.Controls>
        </div>
      )}
    </Stepper.Provider>
  )
}
