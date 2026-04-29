import type { CashierDailySummary, CashierSummaryBuildingRow, CashierSummaryLineItem, MealRecord } from '@/types'

import { buildBuildingName, clone, toIsoDate } from './helpers'
import { readMockDb } from './store'

const KNOWN_BUILDING_IDS = [1, 2, 3, 4, 5]

const mealTypeLabels = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
} as const

const mealTypeOrder = {
  breakfast: 0,
  lunch: 1,
} as const

function roundAmount(value: number): number {
  return Number(value.toFixed(2))
}

function sortLineItems(left: CashierSummaryLineItem, right: CashierSummaryLineItem): number {
  const typeDelta = mealTypeOrder[left.meal_type] - mealTypeOrder[right.meal_type]
  if (typeDelta !== 0) {
    return typeDelta
  }
  return left.price - right.price
}

function buildLineItems(records: MealRecord[]): CashierSummaryLineItem[] {
  const items = new Map<string, CashierSummaryLineItem>()

  records.forEach((record) => {
    const price = roundAmount(record.price)
    const key = `${record.meal_type}:${price}`
    const current = items.get(key) ?? {
      meal_type: record.meal_type,
      meal_type_label: mealTypeLabels[record.meal_type],
      price,
      count: 0,
      amount: 0,
    }
    current.count += 1
    current.amount = roundAmount(current.amount + price)
    items.set(key, current)
  })

  return Array.from(items.values()).sort(sortLineItems)
}

function buildOverview(records: MealRecord[]) {
  return {
    count: records.length,
    breakfast_count: records.filter((record) => record.meal_type === 'breakfast').length,
    lunch_count: records.filter((record) => record.meal_type === 'lunch').length,
    amount: roundAmount(records.reduce((sum, record) => sum + record.price, 0)),
  }
}

function buildDailyRows(records: MealRecord[], periodStart: Date, periodEnd: Date) {
  const rows = []
  const cursor = new Date(periodEnd)
  while (cursor >= periodStart) {
    const issueDate = toIsoDate(cursor)
    const dayRecords = records.filter((record) => record.issue_date === issueDate)
    rows.push({
      issue_date: issueDate,
      count: dayRecords.length,
      breakfast_count: dayRecords.filter((record) => record.meal_type === 'breakfast').length,
      lunch_count: dayRecords.filter((record) => record.meal_type === 'lunch').length,
      amount: roundAmount(dayRecords.reduce((sum, record) => sum + record.price, 0)),
    })
    cursor.setDate(cursor.getDate() - 1)
  }
  return rows
}

function buildBuildingsTable(records: MealRecord[], knownBuildingIds: number[]) {
  const rows: CashierSummaryBuildingRow[] = knownBuildingIds.map((buildingId) => {
    const buildingRecords = records.filter((record) => record.building_id === buildingId)
    return {
      building_id: buildingId,
      building_name: buildBuildingName(buildingId) ?? `Корпус ${buildingId}`,
      line_items: buildLineItems(buildingRecords),
      total_count: buildingRecords.length,
      total_amount: roundAmount(buildingRecords.reduce((sum, record) => sum + record.price, 0)),
    }
  })

  return {
    rows,
    totals: {
      line_items: buildLineItems(records),
      total_count: records.length,
      total_amount: roundAmount(records.reduce((sum, record) => sum + record.price, 0)),
    },
  }
}

function resolvePeriod(days: number, options?: { month?: number; year?: number }) {
  const today = new Date()
  if (options?.month != null || options?.year != null) {
    if (options?.month == null || options?.year == null) {
      throw new Error('Для месячной сводки нужны month и year')
    }
    if (options.month < 1 || options.month > 12) {
      throw new Error('Месяц должен быть в диапазоне 1-12')
    }

    const periodStartDate = new Date(options.year, options.month - 1, 1)
    const periodEndDate = new Date(options.year, options.month, 0)
    return {
      days: periodEndDate.getDate(),
      periodStartDate,
      periodEndDate,
      filter: {
        mode: 'month' as const,
        days: null,
        month: options.month,
        year: options.year,
      },
    }
  }

  const periodEndDate = new Date(today)
  const periodStartDate = new Date(today)
  periodStartDate.setDate(today.getDate() - (days - 1))
  return {
    days,
    periodStartDate,
    periodEndDate,
    filter: {
      mode: 'days' as const,
      days,
      month: null,
      year: null,
    },
  }
}

export function getCashierDailySummary(
  days = 7,
  buildingId?: number,
  options?: { month?: number; year?: number },
): CashierDailySummary {
  const db = readMockDb()
  const { days: resolvedDays, periodStartDate, periodEndDate, filter } = resolvePeriod(days, options)
  const periodStart = toIsoDate(periodStartDate)
  const periodEnd = toIsoDate(periodEndDate)

  const records = db.mealRecords.filter((record) => record.issue_date >= periodStart && record.issue_date <= periodEnd)
  const historyRecords = buildingId ? records.filter((record) => record.building_id === buildingId) : records
  const knownBuildingIds = Array.from(
    new Set([
      ...KNOWN_BUILDING_IDS,
      ...db.students.map((student) => student.building_id),
      ...db.students.flatMap((student) => (student.meal_building_id ? [student.meal_building_id] : [])),
      ...db.users.flatMap((user) => (user.building_id ? [user.building_id] : [])),
      ...db.mealRecords.map((record) => record.building_id),
    ]),
  ).sort((left, right) => left - right)

  return clone({
    days: resolvedDays,
    period_start: periodStart,
    period_end: periodEnd,
    filter,
    scope: {
      history_building_id: buildingId ?? null,
      history_building_name: buildBuildingName(buildingId) ?? null,
      history_scope_label: buildBuildingName(buildingId) ?? 'Все корпуса',
    },
    overview: {
      history_scope: buildOverview(historyRecords),
      all_buildings: buildOverview(records),
    },
    daily_rows: buildDailyRows(historyRecords, periodStartDate, periodEndDate),
    buildings_table: buildBuildingsTable(records, knownBuildingIds),
  })
}

export function downloadCashierSummaryXlsx(days = 7, buildingId?: number, options?: { month?: number; year?: number }): Blob {
  const summary = getCashierDailySummary(days, buildingId, options)
  const content = [
    `Период: ${summary.period_start} - ${summary.period_end}`,
    `Всего выдач: ${summary.buildings_table.totals.total_count}`,
    `Всего сумма: ${summary.buildings_table.totals.total_amount.toFixed(2)}`,
  ].join('\n')

  return new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
