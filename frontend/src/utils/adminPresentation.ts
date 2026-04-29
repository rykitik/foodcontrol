import { roleLabels } from '@/config/navigation'
import type { UserRole } from '@/types'

export type AdminRoleTone = 'blue' | 'violet' | 'orange' | 'green' | 'slate'

export const adminRoleTone: Record<UserRole, AdminRoleTone> = {
  admin: 'blue',
  head_social: 'violet',
  accountant: 'orange',
  cashier: 'green',
  social: 'slate',
}

export function getAdminRoleLabel(role: UserRole): string {
  return roleLabels[role]
}

export function formatAdminDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}
