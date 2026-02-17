import {
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  QuoteIcon,
  TextIcon,
} from 'lucide-react'

import { useTranslations } from 'next-intl'

export const blockTypeToBlockName: Record<
  string,
  { label: string | ((t: (k: string, v?: any) => string) => string); icon: React.ReactNode }
> = {
  paragraph: {
    label: (t: any) => t('Components.Editor.Picker.paragraph'),
    icon: <TextIcon className="size-4" />,
  },
  h1: {
    label: (t: any) => t('Components.Editor.Picker.headingN', { n: 1 }),
    icon: <Heading1Icon className="size-4" />,
  },
  h2: {
    label: (t: any) => t('Components.Editor.Picker.headingN', { n: 2 }),
    icon: <Heading2Icon className="size-4" />,
  },
  h3: {
    label: (t: any) => t('Components.Editor.Picker.headingN', { n: 3 }),
    icon: <Heading3Icon className="size-4" />,
  },
  number: {
    label: (t: any) => t('Components.Editor.Picker.numberedList'),
    icon: <ListOrderedIcon className="size-4" />,
  },
  bullet: {
    label: (t: any) => t('Components.Editor.Picker.bulletedList'),
    icon: <ListIcon className="size-4" />,
  },
  check: {
    label: (t: any) => t('Components.Editor.Picker.checkList'),
    icon: <ListTodoIcon className="size-4" />,
  },
  code: {
    label: (t: any) => t('Components.Editor.Picker.code'),
    icon: <CodeIcon className="size-4" />,
  },
  quote: {
    label: (t: any) => t('Components.Editor.Picker.quote'),
    icon: <QuoteIcon className="size-4" />,
  },
}
