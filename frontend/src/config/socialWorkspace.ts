import type { AppIconName } from '@/components/icons/appIconRegistry'

export type SocialWorkspaceKey = 'students' | 'issuance' | 'categories' | 'holidays' | 'reports' | 'settings'

type SocialWorkspaceSection = {
  key: SocialWorkspaceKey
  label: string
  to: string
  icon: AppIconName
  description: string
}

export const socialWorkspaceSections: Record<SocialWorkspaceKey, SocialWorkspaceSection> = {
  students: {
    key: 'students',
    label: 'Студенты',
    to: '/social',
    icon: 'students',
    description: 'Списки по корпусам, назначение корпуса питания и выпуск по студентам.',
  },
  issuance: {
    key: 'issuance',
    label: 'Выпуск и печать',
    to: '/social/issuance',
    icon: 'documentPrint',
    description: 'Месячный выпуск талонов, A4-листы талонов и ведомости получения.',
  },
  categories: {
    key: 'categories',
    label: 'Категории',
    to: '/categories-settings',
    icon: 'category',
    description: 'Настройка приемов пищи и стоимости завтрака и обеда.',
  },
  holidays: {
    key: 'holidays',
    label: 'Календарь',
    to: '/holidays',
    icon: 'calendar',
    description: 'Праздничные и каникулярные дни, когда питание блокируется.',
  },
  reports: {
    key: 'reports',
    label: 'Отчеты',
    to: '/reports',
    icon: 'reports',
    description: 'Итоговые ведомости и печатные формы за период.',
  },
  settings: {
    key: 'settings',
    label: 'Настройки',
    to: '/admin',
    icon: 'settings',
    description: 'Пользователи, системные настройки и импорт данных.',
  },
}

export const socialWorkspacePrimaryKeys = ['students', 'issuance', 'categories', 'holidays'] as const satisfies readonly SocialWorkspaceKey[]
export const socialWorkspaceSecondaryKeys = ['reports', 'settings'] as const satisfies readonly SocialWorkspaceKey[]
export const headSocialDashboardKeys = ['students', 'issuance', 'categories', 'holidays', 'reports'] as const satisfies readonly SocialWorkspaceKey[]
