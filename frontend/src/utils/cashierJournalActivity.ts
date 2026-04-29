import type {
  CashierJournalRepeatedScan,
  CashierJournalScanActivity,
  CashierJournalScanAttempt,
  CashierJournalScanOutcome,
} from '@/types'
import type { CashierEventEntry } from '@/utils/cashierSession'

type EventTone = CashierEventEntry['tone']

interface ParsedScanAttemptSeed {
  outcome: CashierJournalScanOutcome
  title: string
  subject: string
  description: string
  tone: EventTone
}

const PREFIX_PATTERNS: Array<{
  prefix: string
  build: (payload: string, tone: EventTone) => ParsedScanAttemptSeed
}> = [
  {
    prefix: 'Талон подтвержден:',
    build: (payload, tone) => ({
      outcome: 'success',
      title: 'Доступен к выдаче',
      subject: payload || 'Студент',
      description: 'Талон успешно найден и допущен к выдаче.',
      tone,
    }),
  },
  {
    prefix: 'Уже выдано:',
    build: (payload, tone) => ({
      outcome: 'already_used',
      title: 'Питание уже выдано',
      subject: payload || 'Студент',
      description: 'Повторная попытка сканирования после выдачи.',
      tone,
    }),
  },
  {
    prefix: 'Талон не найден:',
    build: (payload, tone) => ({
      outcome: 'not_found',
      title: 'Код не найден',
      subject: payload || 'Неизвестный код',
      description: 'Сканирование не нашло студента или талон.',
      tone,
    }),
  },
  {
    prefix: 'Нет талона:',
    build: (payload, tone) => ({
      outcome: 'blocked',
      title: 'Нет активного талона',
      subject: payload || 'Студент',
      description: 'Талон для выдачи не найден или неактивен.',
      tone,
    }),
  },
  {
    prefix: 'Неактивный талон:',
    build: (payload, tone) => ({
      outcome: 'blocked',
      title: 'Талон неактивен',
      subject: payload || 'Студент',
      description: 'Попытка сканирования по неактивному талону.',
      tone,
    }),
  },
  {
    prefix: 'Студент выключен:',
    build: (payload, tone) => ({
      outcome: 'blocked',
      title: 'Студент выключен',
      subject: payload || 'Студент',
      description: 'Выдача по студенту недоступна.',
      tone,
    }),
  },
  {
    prefix: 'Выдача закрыта:',
    build: (payload, tone) => ({
      outcome: 'blocked',
      title: 'Выдача закрыта',
      subject: payload || 'Студент',
      description: 'Сканирование выполнено вне дня выдачи.',
      tone,
    }),
  },
  {
    prefix: 'Ошибка проверки:',
    build: (payload, tone) => {
      const normalized = payload.toLowerCase()
      if (normalized.includes('выдача недоступна')) {
        return {
          outcome: 'blocked',
          title: 'Выдача недоступна',
          subject: payload || 'Запрос отклонён',
          description: 'Попытка сканирования отклонена по правилам доступа.',
          tone,
        }
      }

      return {
        outcome: 'error',
        title: 'Ошибка проверки',
        subject: payload || 'Ошибка',
        description: payload || 'Не удалось проверить талон.',
        tone,
      }
    },
  },
  {
    prefix: 'Проверка отклонена:',
    build: (payload, tone) => ({
      outcome: 'offline',
      title: 'Проверка не завершена',
      subject: payload || 'Нет связи',
      description: payload || 'Проверка талона не завершена.',
      tone,
    }),
  },
]

function normalizeSpace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function parseLegacyScanAttempt(event: CashierEventEntry): ParsedScanAttemptSeed | null {
  const message = normalizeSpace(event.message)
  for (const pattern of PREFIX_PATTERNS) {
    if (!message.startsWith(pattern.prefix)) {
      continue
    }

    const payload = normalizeSpace(message.slice(pattern.prefix.length))
    return pattern.build(payload, event.tone)
  }

  return null
}

function parseScanAttempt(event: CashierEventEntry): CashierJournalScanAttempt | null {
  const parsed = parseLegacyScanAttempt(event)
  if (!parsed) {
    return null
  }

  return {
    id: event.id,
    created_at: event.created_at,
    outcome: parsed.outcome,
    title: parsed.title,
    subject: parsed.subject,
    description: parsed.description,
    tone: parsed.tone,
  }
}

function buildRepeatId(attempt: CashierJournalScanAttempt): string {
  return `${attempt.outcome}:${attempt.title}:${attempt.subject}:${attempt.description}`
}

export function buildCashierJournalScanActivity(events: CashierEventEntry[]): CashierJournalScanActivity {
  const attempts = events
    .map((event) => parseScanAttempt(event))
    .filter((attempt): attempt is CashierJournalScanAttempt => attempt !== null)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))

  const grouped = new Map<string, CashierJournalRepeatedScan>()
  attempts.forEach((attempt) => {
    const id = buildRepeatId(attempt)
    const current = grouped.get(id)
    if (current) {
      current.count += 1
      if (attempt.created_at > current.last_at) {
        current.last_at = attempt.created_at
      }
      return
    }

    grouped.set(id, {
      id,
      outcome: attempt.outcome,
      title: attempt.title,
      subject: attempt.subject,
      description: attempt.description,
      count: 1,
      last_at: attempt.created_at,
      tone: attempt.tone,
    })
  })

  return {
    attempts_count: attempts.length,
    success_count: attempts.filter((attempt) => attempt.outcome === 'success').length,
    blocked_count: attempts.filter((attempt) => attempt.outcome === 'blocked' || attempt.outcome === 'already_used').length,
    not_found_count: attempts.filter((attempt) => attempt.outcome === 'not_found').length,
    offline_count: attempts.filter((attempt) => attempt.outcome === 'offline').length,
    error_count: attempts.filter((attempt) => attempt.outcome === 'error').length,
    latest_attempts: attempts.slice(0, 8),
    repeated_attempts: [...grouped.values()]
      .filter((entry) => entry.count > 1)
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count
        }
        return right.last_at.localeCompare(left.last_at)
      })
      .slice(0, 6),
  }
}
