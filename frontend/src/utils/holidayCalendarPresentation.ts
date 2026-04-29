import type {
  HolidayCalendarCell,
  HolidayEditForm,
  HolidayEntry,
  HolidayRangeForm,
  HolidayReasonType,
  HolidaySelectedDateMeta,
} from '@/types'

import { getHolidayTitle, normalizeHolidayTitle } from '@/utils/holidayCalendar'

export type HolidayCellState = 'ordinary' | 'automatic' | 'manual' | 'inactive'
export type HolidayBlockSource = 'automatic' | 'manual'

export interface HolidayBlockedRow {
  key: string
  isoDate: string
  dateLabel: string
  weekdayShort: string
  weekdayLong: string
  reasonLabel: string
  source: HolidayBlockSource
  sourceLabel: string
  sourceTone: 'info' | 'success'
  comment: string
  canDelete: boolean
  entryId: number | null
  isActive: boolean
}

export interface HolidayMonthSummary {
  manualBlockedCount: number
  automaticBlockedCount: number
  totalBlockedCount: number
}

export interface HolidayRangePreview {
  totalDays: number
  createdCount: number
  skippedCount: number
}

export interface HolidaySelectedDatePresentation {
  dateLabel: string
  weekdayLabel: string
  statusLabel: string
  statusText: string
  reasonLabel: string | null
  sourceLabel: string | null
  comment: string | null
  cellState: HolidayCellState
  canEditForm: boolean
  canDelete: boolean
  infoMessage: string | null
}

type HolidayReasonOption = {
  value: HolidayReasonType
  label: string
}

const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const WEEKDAY_LONG_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
})

const WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
})

const KNOWN_REASON_OPTIONS: HolidayReasonOption[] = [
  { value: 'vacation', label: 'Каникулы' },
  { value: 'sanitary', label: 'Санитарный день' },
  { value: 'public', label: 'Праздник' },
  { value: 'non_study', label: 'Неучебный день' },
  { value: 'other', label: 'Другое' },
]

const REASON_LABELS: Record<HolidayReasonType, string> = KNOWN_REASON_OPTIONS.reduce(
  (accumulator, option) => {
    accumulator[option.value] = option.label
    return accumulator
  },
  {} as Record<HolidayReasonType, string>,
)

const VACATION_REASON_PATTERN = /каникул/i
const SANITARY_REASON_PATTERN = /санитар/i
const PUBLIC_REASON_PATTERN = /празд|рождеств|день\s(победы|россии|народного)/i
const NON_STUDY_REASON_PATTERN = /неучеб|без\s+занятий|неучебный/i

function parseIsoDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

function buildWeekdayLabel(value: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(parseIsoDate(value)).replace('.', '')
}

function trimKnownPrefix(value: string, prefix: string): string {
  const separators = [' — ', ': ', ' - ']
  for (const separator of separators) {
    const token = `${prefix}${separator}`
    if (value.startsWith(token)) {
      return value.slice(token.length).trim()
    }
  }

  return value
}

function inferReasonTypeFromTitle(title?: string | null): HolidayReasonType {
  const normalized = normalizeHolidayTitle(title)
  if (!normalized) {
    return 'other'
  }

  if (VACATION_REASON_PATTERN.test(normalized)) {
    return 'vacation'
  }

  if (SANITARY_REASON_PATTERN.test(normalized)) {
    return 'sanitary'
  }

  if (PUBLIC_REASON_PATTERN.test(normalized)) {
    return 'public'
  }

  if (NON_STUDY_REASON_PATTERN.test(normalized)) {
    return 'non_study'
  }

  return 'other'
}

function describeStoredHolidayTitle(title?: string | null): {
  reasonType: HolidayReasonType
  comment: string
} {
  const normalized = normalizeHolidayTitle(title)
  if (!normalized) {
    return { reasonType: 'other', comment: '' }
  }

  for (const option of KNOWN_REASON_OPTIONS) {
    if (option.value === 'other') {
      continue
    }

    if (normalized === option.label) {
      return { reasonType: option.value, comment: '' }
    }

    if (normalized.startsWith(`${option.label} —`) || normalized.startsWith(`${option.label}:`)) {
      return {
        reasonType: option.value,
        comment: trimKnownPrefix(normalized, option.label),
      }
    }
  }

  const inferredReasonType = inferReasonTypeFromTitle(normalized)
  if (inferredReasonType === 'other') {
    return { reasonType: 'other', comment: normalized }
  }

  return {
    reasonType: inferredReasonType,
    comment: normalized,
  }
}

function describeAutomaticEntryReason(entry: HolidayEntry, isWeekend: boolean) {
  if (isWeekend && !normalizeHolidayTitle(entry.title)) {
    return {
      reasonLabel: 'Выходной',
      comment: 'Воскресенье',
    }
  }

  return {
    reasonLabel: 'Праздник',
    comment: getHolidayTitle(entry.title),
  }
}

function describeManualEntryReason(entry: HolidayEntry) {
  const parsed = describeStoredHolidayTitle(entry.title)
  return {
    reasonLabel: REASON_LABELS[parsed.reasonType],
    comment: parsed.comment,
  }
}

export const holidayReasonOptions = KNOWN_REASON_OPTIONS

export function formatHolidayDate(value: string): string {
  return DATE_FORMATTER.format(parseIsoDate(value))
}

export function formatHolidayWeekdayLong(value: string): string {
  return buildWeekdayLabel(value, WEEKDAY_LONG_FORMATTER)
}

export function formatHolidayWeekdayShort(value: string): string {
  return buildWeekdayLabel(value, WEEKDAY_SHORT_FORMATTER)
}

export function isAutomaticHolidayEntry(entry?: HolidayEntry | null): boolean {
  return Boolean(entry && !entry.created_by)
}

export function isManualHolidayEntry(entry?: HolidayEntry | null): boolean {
  return Boolean(entry?.created_by)
}

export function hydrateHolidayFormFields(form: HolidayEditForm, entry?: HolidayEntry | null) {
  const parsed = describeStoredHolidayTitle(entry?.title)
  form.reason_type = parsed.reasonType
  form.comment = parsed.comment
}

export function hydrateHolidayRangeFields(form: HolidayRangeForm, entry?: HolidayEntry | null) {
  const parsed = describeStoredHolidayTitle(entry?.title)
  form.reason_type = parsed.reasonType
  form.comment = parsed.comment
}

export function composeHolidayTitle(reasonType: HolidayReasonType, comment?: string | null): string {
  const normalizedComment = normalizeHolidayTitle(comment)
  if (reasonType === 'other') {
    return normalizedComment
  }

  const reasonLabel = REASON_LABELS[reasonType]
  if (!normalizedComment || normalizedComment === reasonLabel) {
    return reasonLabel
  }

  return `${reasonLabel} — ${normalizedComment}`
}

export function getHolidayCellState(cell: HolidayCalendarCell): HolidayCellState {
  if (cell.holiday) {
    if (!cell.holiday.is_active) {
      return 'inactive'
    }

    return isAutomaticHolidayEntry(cell.holiday) ? 'automatic' : 'manual'
  }

  return cell.isWeekend ? 'automatic' : 'ordinary'
}

export function getHolidayCellLabel(cell: HolidayCalendarCell): string {
  const state = getHolidayCellState(cell)

  if (state === 'inactive') {
    return 'Неактивно'
  }

  if (state === 'automatic') {
    if (!cell.holiday) {
      return 'Выходной'
    }

    return cell.isWeekend && !normalizeHolidayTitle(cell.holiday.title) ? 'Выходной' : 'Праздник'
  }

  if (state === 'manual' && cell.holiday) {
    return describeManualEntryReason(cell.holiday).reasonLabel
  }

  return ''
}

export function buildHolidayBlockedRows(
  calendarCells: Array<HolidayCalendarCell | null>,
): HolidayBlockedRow[] {
  return calendarCells.flatMap((cell) => {
    if (!cell) {
      return []
    }

    if (cell.holiday) {
      const source = isAutomaticHolidayEntry(cell.holiday) ? 'automatic' : 'manual'
      const details =
        source === 'automatic'
          ? describeAutomaticEntryReason(cell.holiday, cell.isWeekend)
          : describeManualEntryReason(cell.holiday)
      const row: HolidayBlockedRow = {
        key: `holiday-${cell.holiday.id}`,
        isoDate: cell.isoDate,
        dateLabel: formatHolidayDate(cell.isoDate),
        weekdayShort: formatHolidayWeekdayShort(cell.isoDate),
        weekdayLong: formatHolidayWeekdayLong(cell.isoDate),
        reasonLabel: details.reasonLabel,
        source,
        sourceLabel: source === 'automatic' ? 'Автоматически' : 'Вручную',
        sourceTone: source === 'automatic' ? 'info' : 'success',
        comment: details.comment,
        canDelete: source === 'manual',
        entryId: cell.holiday.id,
        isActive: cell.holiday.is_active,
      }

      return [row]
    }

    if (cell.isWeekend) {
      const row: HolidayBlockedRow = {
        key: `weekend-${cell.isoDate}`,
        isoDate: cell.isoDate,
        dateLabel: formatHolidayDate(cell.isoDate),
        weekdayShort: formatHolidayWeekdayShort(cell.isoDate),
        weekdayLong: formatHolidayWeekdayLong(cell.isoDate),
        reasonLabel: 'Выходной',
        source: 'automatic',
        sourceLabel: 'Автоматически',
        sourceTone: 'info',
        comment: 'Воскресенье',
        canDelete: false,
        entryId: null,
        isActive: true,
      }

      return [row]
    }

    return []
  })
}

export function buildHolidayMonthSummary(rows: HolidayBlockedRow[]): HolidayMonthSummary {
  return rows.reduce<HolidayMonthSummary>(
    (summary, row) => {
      if (!row.isActive) {
        return summary
      }

      if (row.source === 'manual') {
        summary.manualBlockedCount += 1
      } else {
        summary.automaticBlockedCount += 1
      }

      summary.totalBlockedCount += 1
      return summary
    },
    {
      manualBlockedCount: 0,
      automaticBlockedCount: 0,
      totalBlockedCount: 0,
    },
  )
}

export function buildHolidayRangePreview(
  form: HolidayRangeForm,
  allEntries: HolidayEntry[],
): HolidayRangePreview {
  const startDate = form.start_date.trim()
  const endDate = form.end_date.trim()

  if (!startDate || !endDate) {
    return { totalDays: 0, createdCount: 0, skippedCount: 0 }
  }

  const startValue = parseIsoDate(startDate)
  const endValue = parseIsoDate(endDate)
  if (Number.isNaN(startValue.getTime()) || Number.isNaN(endValue.getTime()) || endValue < startValue) {
    return { totalDays: 0, createdCount: 0, skippedCount: 0 }
  }

  const existingDates = new Set(allEntries.map((entry) => entry.holiday_date))
  const cursor = new Date(startValue)
  let totalDays = 0
  let skippedCount = 0

  while (cursor <= endValue) {
    totalDays += 1
    const isoDate = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, '0'),
      String(cursor.getDate()).padStart(2, '0'),
    ].join('-')
    const isSunday = cursor.getDay() === 0
    if (existingDates.has(isoDate) || isSunday) {
      skippedCount += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return {
    totalDays,
    createdCount: totalDays - skippedCount,
    skippedCount,
  }
}

export function buildSelectedDatePresentation(
  selectedDate: string,
  selectedDateMeta: HolidaySelectedDateMeta,
  canEdit: boolean,
): HolidaySelectedDatePresentation {
  const entry = selectedDateMeta.holiday
  const dateLabel = formatHolidayDate(selectedDate)
  const weekdayLabel = formatHolidayWeekdayLong(selectedDate)

  if (entry) {
    const source = isAutomaticHolidayEntry(entry) ? 'automatic' : 'manual'
    const details =
      source === 'automatic'
        ? describeAutomaticEntryReason(entry, selectedDateMeta.weekend)
        : describeManualEntryReason(entry)

    if (!entry.is_active) {
      return {
        dateLabel,
        weekdayLabel,
        statusLabel: 'Обычный день',
        statusText: 'Питание выдается в этот день',
        reasonLabel: details.reasonLabel,
        sourceLabel: source === 'automatic' ? 'Автоматически' : 'Вручную',
        comment: details.comment || 'Блокировка отключена',
        cellState: 'inactive',
        canEditForm: canEdit && source === 'manual',
        canDelete: canEdit && source === 'manual',
        infoMessage: source === 'automatic' ? 'Эту дату нельзя удалить вручную.' : null,
      }
    }

    return {
      dateLabel,
      weekdayLabel,
      statusLabel: 'Питание не выдается',
      statusText:
        source === 'automatic'
          ? 'Дата заблокирована автоматически.'
          : 'Дата заблокирована вручную.',
      reasonLabel: details.reasonLabel,
      sourceLabel: source === 'automatic' ? 'Автоматически' : 'Вручную',
      comment: details.comment,
      cellState: source === 'automatic' ? 'automatic' : 'manual',
      canEditForm: canEdit && source === 'manual',
      canDelete: canEdit && source === 'manual',
      infoMessage: source === 'automatic' ? 'Эту дату нельзя удалить вручную.' : null,
    }
  }

  if (selectedDateMeta.weekend) {
    return {
      dateLabel,
      weekdayLabel,
      statusLabel: 'Питание не выдается',
      statusText: 'Дата заблокирована автоматически.',
      reasonLabel: 'Выходной',
      sourceLabel: 'Автоматически',
      comment: 'Воскресенье',
      cellState: 'automatic',
      canEditForm: false,
      canDelete: false,
      infoMessage: 'Эту дату нельзя удалить вручную.',
    }
  }

  return {
    dateLabel,
    weekdayLabel,
    statusLabel: 'Обычный день',
    statusText: 'Питание выдается в этот день',
    reasonLabel: null,
    sourceLabel: null,
    comment: null,
    cellState: 'ordinary',
    canEditForm: canEdit,
    canDelete: false,
    infoMessage: canEdit ? null : 'Для вашей роли доступен только просмотр календаря.',
  }
}

export function downloadHolidayRowsCsv(rows: HolidayBlockedRow[], monthLabel: string): void {
  const header = ['Дата', 'Тип причины', 'Способ блокировки', 'Комментарий']
  const csvRows = [
    header,
    ...rows.map((row) => [
      `${row.dateLabel} (${row.weekdayShort})`,
      row.reasonLabel,
      row.sourceLabel,
      row.comment,
    ]),
  ]

  const csvContent = csvRows
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `calendar-${monthLabel.toLowerCase().replace(/\s+/g, '-')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
