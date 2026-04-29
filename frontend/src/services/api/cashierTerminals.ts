import type { CashierTerminalProvisionRequest, CashierTerminalProvisionResponse } from '@/types'

import { rethrowCashierRequestError } from '@/services/cashierRequestErrors'
import { authHeaders, requestJson } from '../http'

export async function provisionCashierTerminal(
  request: CashierTerminalProvisionRequest,
  token?: string | null,
): Promise<CashierTerminalProvisionResponse> {
  try {
    return await requestJson('/cashier-terminals/provision', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    })
  } catch (error) {
    rethrowCashierRequestError(error, {
      fallbackMessage: 'Не удалось привязать терминал кассы.',
    })
  }
}
