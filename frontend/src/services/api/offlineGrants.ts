import type { CashierOfflineGrantIssueRequest, CashierOfflineGrantIssueResponse } from '@/types'

import { rethrowCashierRequestError } from '@/services/cashierRequestErrors'
import { authHeaders, requestJson } from '../http'

export async function issueCashierOfflineGrant(
  request: CashierOfflineGrantIssueRequest,
  token?: string | null,
): Promise<CashierOfflineGrantIssueResponse> {
  try {
    return await requestJson('/auth/offline-grant/issue', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    })
  } catch (error) {
    rethrowCashierRequestError(error, {
      fallbackMessage: 'Не удалось выпустить офлайн-доступ кассира.',
    })
  }
}
