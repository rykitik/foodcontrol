import type { TicketBulkCreateRequest } from '@/types'

import { toIsoDate } from './helpers'

export interface MockTicketPeriodSegment {
  month: number
  year: number
  start_date: string
  end_date: string
}

interface MockResolvedTicketPeriod {
  startDate: string
  endDate: string
}

type MockCreationPeriodRequest = Pick<TicketBulkCreateRequest, 'month' | 'year' | 'start_date' | 'end_date'>

function parseIsoDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

function todayIsoDate(): string {
  return toIsoDate(new Date())
}

function resolveMonthRange(month: number, year: number): MockResolvedTicketPeriod {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDateValue = new Date(year, month, 0)
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDateValue.getDate()).padStart(2, '0')}`
  return { startDate, endDate }
}

export function resolveMockTicketCreationPeriod(request: MockCreationPeriodRequest): MockResolvedTicketPeriod {
  if (request.start_date || request.end_date) {
    if (!request.start_date || !request.end_date) {
      throw new Error('Нужны start_date и end_date')
    }

    if (request.end_date < request.start_date) {
      throw new Error('Дата окончания не может быть раньше даты начала')
    }

    if (request.start_date < todayIsoDate()) {
      throw new Error('При создании талона дата начала не может быть раньше сегодняшнего дня')
    }

    return {
      startDate: request.start_date,
      endDate: request.end_date,
    }
  }

  if (!request.month || !request.year) {
    throw new Error('Нужно указать месяц и год или start_date/end_date')
  }

  const monthRange = resolveMonthRange(request.month, request.year)
  const startDate = monthRange.startDate < todayIsoDate() ? todayIsoDate() : monthRange.startDate
  if (startDate > monthRange.endDate) {
    throw new Error('Нельзя выпускать талоны за прошедшие месяцы')
  }

  return {
    startDate,
    endDate: monthRange.endDate,
  }
}

export function resolveMockTicketCreationSegments(request: MockCreationPeriodRequest): {
  startDate: string
  endDate: string
  segments: MockTicketPeriodSegment[]
} {
  const period = resolveMockTicketCreationPeriod(request)
  return {
    ...period,
    segments: splitTicketPeriodByMonth(period.startDate, period.endDate),
  }
}

export function splitTicketPeriodByMonth(startDate: string, endDate: string): MockTicketPeriodSegment[] {
  const segments: MockTicketPeriodSegment[] = []
  let current = parseIsoDate(startDate)
  const targetEnd = parseIsoDate(endDate)

  while (current <= targetEnd) {
    const month = current.getMonth() + 1
    const year = current.getFullYear()
    const monthEnd = new Date(year, month, 0)
    const segmentEnd = monthEnd <= targetEnd ? monthEnd : targetEnd

    segments.push({
      month,
      year,
      start_date: toIsoDate(current),
      end_date: toIsoDate(segmentEnd),
    })

    current = new Date(segmentEnd)
    current.setDate(current.getDate() + 1)
  }

  return segments
}
