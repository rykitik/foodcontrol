import type { MealType, TicketStatus, UserRole } from '@/types'

export const monthOptions = [
  { label: 'Январь', value: 1 },
  { label: 'Февраль', value: 2 },
  { label: 'Март', value: 3 },
  { label: 'Апрель', value: 4 },
  { label: 'Май', value: 5 },
  { label: 'Июнь', value: 6 },
  { label: 'Июль', value: 7 },
  { label: 'Август', value: 8 },
  { label: 'Сентябрь', value: 9 },
  { label: 'Октябрь', value: 10 },
  { label: 'Ноябрь', value: 11 },
  { label: 'Декабрь', value: 12 },
]

export const buildingOptions = [
  { label: 'Корпус 1, Ленина, д.9', shortLabel: '1', value: 1 },
  { label: 'Корпус 2, Яковлева, д.17', shortLabel: '2', value: 2 },
  { label: 'Корпус 3, Яковлева, д.20/1', shortLabel: '3', value: 3 },
  { label: 'Корпус 4, Пр. Мира, д.40', shortLabel: '4', value: 4 },
  { label: 'Корпус 5, пр. Тракторостроителей, д.99', shortLabel: '5', value: 5 },
]

export const mealBuildingOptions = [
  ...buildingOptions,
  { label: 'Все корпуса', shortLabel: 'Все', value: 'all' as const },
]

export const ticketStatusOptions: Array<{ label: string; value: TicketStatus }> = [
  { label: 'Действует', value: 'active' },
  { label: 'Завершён', value: 'used' },
  { label: 'Срок истёк', value: 'expired' },
  { label: 'Отменён', value: 'cancelled' },
]

export const ticketStatusFilterOptions: Array<{ label: string; value: TicketStatus | 'all' | null }> = [
  { label: 'Все статусы', value: 'all' },
  ...ticketStatusOptions,
]

export const ticketStatusLabels: Record<TicketStatus, string> = {
  active: 'Действует',
  used: 'Завершён',
  expired: 'Срок истёк',
  cancelled: 'Отменён',
}

export const ticketStatusSeverity: Record<TicketStatus, 'success' | 'contrast' | 'warn' | 'danger'> = {
  active: 'success',
  used: 'contrast',
  expired: 'warn',
  cancelled: 'danger',
}

export const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
}

export const mealTypeFilterOptions: Array<{ label: string; value: MealType | 'all' }> = [
  { label: 'Все', value: 'all' },
  { label: 'Завтрак', value: 'breakfast' },
  { label: 'Обед', value: 'lunch' },
]

export const userRoleOptions: Array<{ label: string; value: UserRole }> = [
  { label: 'Соцпедагог', value: 'social' },
  { label: 'Начальник соцпедагогов', value: 'head_social' },
  { label: 'Кассир', value: 'cashier' },
  { label: 'Бухгалтер', value: 'accountant' },
  { label: 'Администратор', value: 'admin' },
]
