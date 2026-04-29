import { describe, expect, test } from 'vitest'

import { buildCashierJournalScanActivity } from '@/utils/cashierJournalActivity'

describe('Cashier journal activity', () => {
  test('groups repeated scan attempts separately from successful checks', () => {
    const activity = buildCashierJournalScanActivity([
      {
        id: 'event-1',
        message: 'Ошибка проверки: Выдача недоступна',
        tone: 'danger',
        created_at: '2026-04-21T10:00:00.000Z',
      },
      {
        id: 'event-2',
        message: 'Ошибка проверки: Выдача недоступна',
        tone: 'danger',
        created_at: '2026-04-21T10:05:00.000Z',
      },
      {
        id: 'event-3',
        message: 'Талон подтвержден: Иванов И.И.',
        tone: 'success',
        created_at: '2026-04-21T10:10:00.000Z',
      },
      {
        id: 'event-4',
        message: 'Талон не найден: 100999',
        tone: 'danger',
        created_at: '2026-04-21T10:15:00.000Z',
      },
    ])

    expect(activity.attempts_count).toBe(4)
    expect(activity.success_count).toBe(1)
    expect(activity.blocked_count).toBe(2)
    expect(activity.not_found_count).toBe(1)
    expect(activity.repeated_attempts).toHaveLength(1)
    expect(activity.repeated_attempts[0]).toMatchObject({
      title: 'Выдача недоступна',
      count: 2,
    })
    expect(activity.latest_attempts[0]).toMatchObject({
      title: 'Код не найден',
      subject: '100999',
    })
  })
})
