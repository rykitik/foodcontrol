const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const monthYearFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
})

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function parseStudentDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`)
  }

  return new Date(value)
}

export function formatTicketIssueCount(value: number | null | undefined): string {
  const count = value ?? 0

  if (count === 1) {
    return '1 выдача'
  }

  if (count >= 2 && count <= 4) {
    return `${count} выдачи`
  }

  return `${count} выдач`
}

export function formatStudentCurrency(value: number): string {
  return currencyFormatter.format(value)
}

export function formatTicketMonthYear(month: number, year: number): string {
  const label = monthYearFormatter.format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatStudentDate(value: string | null | undefined): string {
  if (!value) {
    return 'Не указано'
  }

  const parsed = parseStudentDate(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return dateFormatter.format(parsed)
}

export function formatStudentDateRange(startValue: string | null | undefined, endValue: string | null | undefined): string {
  if (!startValue && !endValue) {
    return 'Период не указан'
  }

  if (!startValue) {
    return `До ${formatStudentDate(endValue)}`
  }

  if (!endValue) {
    return `С ${formatStudentDate(startValue)}`
  }

  return `${formatStudentDate(startValue)} — ${formatStudentDate(endValue)}`
}

export function formatStudentDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Не указано'
  }

  const parsed = parseStudentDate(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return dateTimeFormatter.format(parsed)
}
