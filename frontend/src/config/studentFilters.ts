import type { StudentStatusFilter } from '@/types'

export const studentStatusFilterOptions: Array<{ label: string; value: StudentStatusFilter }> = [
  { label: 'Все статусы', value: 'all' },
  { label: 'Только активные', value: 'active' },
  { label: 'Только выключенные', value: 'inactive' },
]
