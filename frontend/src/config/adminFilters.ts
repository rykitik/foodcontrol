import type { User } from '@/types'

export type UserStatusFilter = 'all' | 'active' | 'inactive'

export const userStatusFilterOptions: Array<{ label: string; value: UserStatusFilter }> = [
  { label: 'Все статусы', value: 'all' },
  { label: 'Только активные', value: 'active' },
  { label: 'Только отключенные', value: 'inactive' },
]

export const studentPageSizeOptions: Array<{ label: string; value: number }> = [
  { label: '25 на странице', value: 25 },
  { label: '50 на странице', value: 50 },
  { label: '100 на странице', value: 100 },
]

export function matchesUserStatus(user: User, filter: UserStatusFilter): boolean {
  if (filter === 'all') {
    return true
  }
  return filter === 'active' ? user.is_active : !user.is_active
}

export function sortUsersByDisplayPriority(users: User[]): User[] {
  return [...users].sort((left, right) => {
    if (left.is_active !== right.is_active) {
      return left.is_active ? -1 : 1
    }
    return left.full_name.localeCompare(right.full_name, 'ru-RU')
  })
}
