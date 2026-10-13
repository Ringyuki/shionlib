import { Heading, Link, Stack, Stepper } from '@hina-ui/react'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { sponsorPaths } from '../sponsor'

type CheckoutFrameProps = {
  step: 1 | 2 | 3
  children: ReactNode
}

const stay = () => false

export function CheckoutFrame({ step, children }: CheckoutFrameProps) {
  const t = useTranslations('sponsor.checkout')
  const locale = useLocale()
  return (
    <Stack gap="lg" className="mx-auto w-full max-w-260 grow">
      <Stack gap="sm">
        <Link
          asChild
          tone="neutral"
          className="inline-flex items-center gap-1.5 self-start text-sm"
        >
          <RouterLink to={sponsorPaths(locale).wall} prefetch="intent">
            <ArrowLeft aria-hidden className="size-4" />
            {t('back')}
          </RouterLink>
        </Link>
        <Heading level={1} size="2xl">
          {t('title')}
        </Heading>
      </Stack>
      <Stepper
        value={step}
        beforeChange={stay}
        items={[
          { title: t('step.content') },
          { title: t('step.pay') },
          { title: t('step.done'), completed: step === 3 },
        ]}
      />
      {children}
    </Stack>
  )
}
