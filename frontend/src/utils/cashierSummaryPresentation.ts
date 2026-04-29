const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
})

const fullDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const monthFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
})

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export function formatCashierSummaryCurrency(value: number): string {
  return currencyFormatter.format(value)
}

export function formatCashierSummaryDay(value: string): string {
  return shortDateFormatter.format(toDate(value))
}

export function formatCashierSummaryPeriod(start: string, end: string): string {
  return `${fullDateFormatter.format(toDate(start))} - ${fullDateFormatter.format(toDate(end))}`
}

export function formatCashierSummaryMonth(month: number, year: number): string {
  const label = monthFormatter.format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function parseCashierSummaryMonthValue(value: string): { month: number; year: number } {
  const [rawYear, rawMonth] = value.split('-')
  const year = Number(rawYear)
  const month = Number(rawMonth)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const fallback = new Date()
    return {
      month: fallback.getMonth() + 1,
      year: fallback.getFullYear(),
    }
  }

  return { month, year }
}
