import { Forget } from '@/components/common/auth/password/forget/Forget'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { getTranslations } from 'next-intl/server'

export default function ForgetPasswordPage() {
  return (
    <div className="md:h-[calc(100vh-160px)] w-full">
      <div className="flex justify-center items-center h-full">
        <Forget />
      </div>
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(async () => {
  const t = await getTranslations('Components.Common.Auth.Password.Forget')
  return {
    title: t('title'),
    path: '/user/password/forget',
  }
})
