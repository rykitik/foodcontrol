import { mealTypeLabels } from '@/config/options'
import type { AppIconName } from '@/components/icons/appIconRegistry'
import type { MealReportRow } from '@/types'
import type { AccountantDocumentItem } from '@/utils/accountingDocumentCatalog'

export interface AccountantSummaryRow {
  key: string
  category: string
  mealLabel: string
  count: number
  amount: number
}

export function formatAccountingMoney(value: number): string {
  return `${value.toFixed(2)} ₽`
}

export function formatAccountingPeriodLabel(periodLabel: string): string {
  const [startDate, endDate] = periodLabel.split(' - ')
  if (!startDate || !endDate) {
    return periodLabel
  }

  return `${formatIsoDate(startDate)} — ${formatIsoDate(endDate)}`
}

export function formatAccountingUpdatedAt(date: Date): string {
  return `сегодня, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function buildAccountantSummaryRows(rows: MealReportRow[]): AccountantSummaryRow[] {
  return rows.map((row) => ({
    key: `${row.category}-${row.meal_type}`,
    category: row.category,
    mealLabel: mealTypeLabels[row.meal_type],
    count: row.count,
    amount: row.amount,
  }))
}

export function getAccountantDocumentIcon(document: AccountantDocumentItem): AppIconName {
  if (document.kind === 'meal_sheet') {
    return 'reports'
  }

  if (document.kind === 'cost_calculation') {
    return 'ruble'
  }

  return 'document'
}

export function getAccountantDocumentSubtitle(document: AccountantDocumentItem): string {
  if (document.kind === 'meal_sheet') {
    return document.badgeLabel
  }

  if (document.kind === 'cost_calculation') {
    return 'Расчет'
  }

  return 'Суммы'
}

function formatIsoDate(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) {
    return value
  }

  return `${day}.${month}.${year}`
}
