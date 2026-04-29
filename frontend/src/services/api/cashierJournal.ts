import type { CashierJournal } from '@/types'

import { authHeaders, requestJson } from '../http'
import { createSearchParams, withQuery } from './shared'

export async function getCashierJournal(
  buildingId?: number,
  options?: { date?: string },
): Promise<CashierJournal> {
  const params = createSearchParams({
    building_id: buildingId,
    date: options?.date,
  })

  return requestJson(withQuery('/meals/cashier-journal', params), {
    method: 'GET',
    headers: authHeaders(),
  })
}
