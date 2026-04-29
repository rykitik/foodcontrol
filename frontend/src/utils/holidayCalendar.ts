const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const VACATION_TITLE_PATTERN = /каникул/i
const SANITARY_TITLE_PATTERN = /санитар/i
const PUBLIC_HOLIDAY_TITLE_PATTERN = /празд|выход|нерабоч/i

export const HOLIDAY_UNTITLED_LABEL = 'Без названия'
export type HolidayVisualTone = 'workday' | 'weekend' | 'vacation' | 'sanitary' | 'exception' | 'inactive'

export function toIsoDate(dateValue: Date): string {
  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, '0')
  const day = String(dateValue.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function monthStartIso(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-`
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value
}

export function isIsoDateInMonth(value: string, year: number, month: number): boolean {
  return isValidIsoDate(value) && value.startsWith(monthPrefix(year, month))
}

export function normalizeHolidayTitle(value?: string | null): string {
  return value?.trim() ?? ''
}

export function getHolidayTitle(value?: string | null): string {
  return normalizeHolidayTitle(value) || HOLIDAY_UNTITLED_LABEL
}

export function resolveHolidayVisualTone(options: { title?: string | null; isWeekend?: boolean; isActive?: boolean }) {
  const normalizedTitle = normalizeHolidayTitle(options.title)

  if (options.isActive === false) {
    return 'inactive' as const
  }

  if (VACATION_TITLE_PATTERN.test(normalizedTitle)) {
    return 'vacation' as const
  }

  if (SANITARY_TITLE_PATTERN.test(normalizedTitle)) {
    return 'sanitary' as const
  }

  if (options.isWeekend || PUBLIC_HOLIDAY_TITLE_PATTERN.test(normalizedTitle)) {
    return 'weekend' as const
  }

  if (normalizedTitle) {
    return 'exception' as const
  }

  return options.isWeekend ? ('weekend' as const) : ('workday' as const)
}
