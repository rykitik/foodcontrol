function parseIsoDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

export function currentIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatCashierJournalDate(value: string): string {
  const parsed = parseIsoDate(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

export function formatCashierJournalTime(value: string): string {
  const normalized = value.trim()
  if (/^\d{2}:\d{2}/.test(normalized)) {
    return normalized.slice(0, 5)
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

export function formatCashierJournalDateTime(value?: string | null): string {
  if (!value) {
    return 'Нет данных'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}
