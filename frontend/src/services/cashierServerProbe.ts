import { CASHIER_STARTUP_ONLINE_PROBE_TIMEOUT_MS } from '@/config/runtime'
import { getProfile } from '@/services/api'
import { isAuthHttpError, isNetworkRequestError } from '@/services/http'

export type CashierServerProbeStatus = 'online' | 'network_unreachable' | 'auth_failed'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  return new Promise<T>((resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new TypeError('Network request failed'))
    }, timeoutMs)

    promise
      .then((value) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }
        resolve(value)
      })
      .catch((error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }
        reject(error)
      })
  })
}

export async function probeCashierServerConnection(
  token: string | null,
): Promise<CashierServerProbeStatus> {
  if (!token) {
    return 'auth_failed'
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'network_unreachable'
  }

  try {
    await withTimeout(getProfile(token), CASHIER_STARTUP_ONLINE_PROBE_TIMEOUT_MS)
    return 'online'
  } catch (error) {
    if (isAuthHttpError(error)) {
      return 'auth_failed'
    }

    if (isNetworkRequestError(error)) {
      return 'network_unreachable'
    }

    return 'network_unreachable'
  }
}
