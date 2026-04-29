import { buildLocalMonthPeriod } from '@/utils/localDate'

export function getMonthPeriod(year: number, month: number) {
  return buildLocalMonthPeriod(year, month)
}

export function getNextMonth(year: number, month: number) {
  const next = new Date(year, month, 1)
  return {
    month: next.getMonth() + 1,
    year: next.getFullYear(),
  }
}

export function formatMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}
