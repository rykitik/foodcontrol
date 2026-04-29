import type {
  HolidayCreateRequest,
  HolidayEntry,
  HolidayRangeCreateRequest,
  HolidayRangeCreateResponse,
  HolidayUpdateRequest,
} from '@/types'

import { readMockDb } from './store'
import { appendLog, clone, mutateDb, requirePrivilegedUser, toIsoDate } from './helpers'

export function listHolidays(filter?: {
  year?: number
  month?: number
  start_date?: string
  end_date?: string
  include_inactive?: boolean
}): HolidayEntry[] {
  const db = readMockDb()
  return clone(
    db.holidays
      .filter((entry) => {
        const [entryYear, entryMonth] = entry.holiday_date.split('-').map((value) => Number(value))
        const matchesYear = !filter?.year || entryYear === filter.year
        const matchesMonth = !filter?.month || entryMonth === filter.month
        const matchesStart = !filter?.start_date || entry.holiday_date >= filter.start_date
        const matchesEnd = !filter?.end_date || entry.holiday_date <= filter.end_date
        const matchesActive = filter?.include_inactive ? true : entry.is_active
        return matchesYear && matchesMonth && matchesStart && matchesEnd && matchesActive
      })
      .sort((left, right) => left.holiday_date.localeCompare(right.holiday_date)),
  )
}

export function createHoliday(request: HolidayCreateRequest, token?: string | null): HolidayEntry {
  return mutateDb((nextDb) => {
    const actor = requirePrivilegedUser(token, nextDb)
    if (nextDb.holidays.some((entry) => entry.holiday_date === request.holiday_date)) {
      throw new Error('Для этой даты запись уже существует')
    }

    const holiday: HolidayEntry = {
      id: Math.max(0, ...nextDb.holidays.map((entry) => entry.id)) + 1,
      holiday_date: request.holiday_date,
      title: request.title?.trim() || null,
      is_active: request.is_active ?? true,
      created_by: actor.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    nextDb.holidays.push(holiday)
    nextDb.holidays.sort((left, right) => left.holiday_date.localeCompare(right.holiday_date))
    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'create_holiday',
      entity_type: 'holiday',
      entity_id: String(holiday.id),
      details: { holiday_date: holiday.holiday_date },
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone(holiday)
  })
}

function parseIsoDate(value: string | undefined, fieldName: string): Date {
  if (!value) {
    throw new Error(`Не заполнено поле ${fieldName}`)
  }

  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime()) || toIsoDate(parsed) !== value) {
    throw new Error(`Некорректная дата в поле ${fieldName}, нужен YYYY-MM-DD`)
  }

  return parsed
}

export function createHolidayRange(
  request: HolidayRangeCreateRequest,
  token?: string | null,
): HolidayRangeCreateResponse {
  return mutateDb((nextDb) => {
    const actor = requirePrivilegedUser(token, nextDb)
    const startDate = parseIsoDate(request.start_date, 'start_date')
    const endDate = parseIsoDate(request.end_date, 'end_date')

    if (endDate < startDate) {
      throw new Error('Дата окончания диапазона не может быть раньше даты начала')
    }

    const normalizedTitle = request.title?.trim() || null
    const existingDates = new Set(nextDb.holidays.map((entry) => entry.holiday_date))
    const created: HolidayEntry[] = []
    const skippedDates: string[] = []
    const cursor = new Date(startDate)

    while (cursor <= endDate) {
      const isoDate = toIsoDate(cursor)

      if (existingDates.has(isoDate)) {
        skippedDates.push(isoDate)
      } else {
        const holiday: HolidayEntry = {
          id: Math.max(0, ...nextDb.holidays.map((entry) => entry.id), ...created.map((entry) => entry.id)) + 1,
          holiday_date: isoDate,
          title: normalizedTitle,
          is_active: request.is_active ?? true,
          created_by: actor.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        nextDb.holidays.push(holiday)
        created.push(holiday)
        existingDates.add(isoDate)
      }

      cursor.setDate(cursor.getDate() + 1)
    }

    nextDb.holidays.sort((left, right) => left.holiday_date.localeCompare(right.holiday_date))
    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'create_holiday_bulk',
      entity_type: 'holiday_batch',
      entity_id: null,
      details: {
        start_date: request.start_date,
        end_date: request.end_date,
        created_count: created.length,
        skipped_count: skippedDates.length,
      },
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone({
      created_count: created.length,
      skipped_count: skippedDates.length,
      created,
      skipped_dates: skippedDates,
    })
  })
}

export function updateHoliday(holidayId: number, request: HolidayUpdateRequest, token?: string | null): HolidayEntry {
  return mutateDb((nextDb) => {
    const actor = requirePrivilegedUser(token, nextDb)
    const holiday = nextDb.holidays.find((entry) => entry.id === holidayId)
    if (!holiday) {
      throw new Error('Праздничный день не найден')
    }

    const nextDate = request.holiday_date ?? holiday.holiday_date
    if (nextDb.holidays.some((entry) => entry.id !== holidayId && entry.holiday_date === nextDate)) {
      throw new Error('Для этой даты запись уже существует')
    }

    holiday.holiday_date = nextDate
    holiday.title = request.title !== undefined ? request.title?.trim() || null : holiday.title
    holiday.is_active = request.is_active ?? holiday.is_active
    holiday.updated_at = new Date().toISOString()

    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'update_holiday',
      entity_type: 'holiday',
      entity_id: String(holidayId),
      details: request as Record<string, unknown>,
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone(holiday)
  })
}

export function deleteHoliday(holidayId: number, token?: string | null): void {
  mutateDb((nextDb) => {
    const actor = requirePrivilegedUser(token, nextDb)
    const exists = nextDb.holidays.some((entry) => entry.id === holidayId)
    if (!exists) {
      throw new Error('Праздничный день не найден')
    }

    nextDb.holidays = nextDb.holidays.filter((entry) => entry.id !== holidayId)
    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'delete_holiday',
      entity_type: 'holiday',
      entity_id: String(holidayId),
      details: {},
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })
  })
}
