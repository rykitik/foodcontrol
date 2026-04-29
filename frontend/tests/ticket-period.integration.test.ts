import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTicketPeriod } from '@/composables/useTicketPeriod'
import { getMonthPeriod } from '@/utils/socialPedagogMonth'

describe('ticket period boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 24, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns local month boundaries without shifting to previous UTC day', () => {
    expect(getMonthPeriod(2026, 4)).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    })
  })

  it('allows the last day of the selected month for partial issuance', () => {
    const period = useTicketPeriod({
      month: ref(4),
      year: ref(2026),
    })

    period.setPeriodType('partial')
    period.setEndDate('2026-04-30')

    expect(period.startDateMin.value).toBe('2026-04-24')
    expect(period.endDateMax.value).toBe('2026-04-30')
    expect(period.endDate.value).toBe('2026-04-30')
    expect(period.validationMessage.value).toBe('')
  })

  it('keeps month mode inside the selected month when building the request', () => {
    const period = useTicketPeriod({
      month: ref(4),
      year: ref(2026),
    })

    expect(period.requestPeriod.value).toEqual({
      start_date: '2026-04-24',
      end_date: '2026-04-30',
    })
  })
})
