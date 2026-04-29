import { isAuthHttpError, isNetworkRequestError } from '@/services/http'
import { isCrossBuildingCashierAccessMessage } from '@/utils/cashierAccessMessages'

export const CASHIER_OFFLINE_ERROR_CODE = '__OFFLINE__'

const CASHIER_FALLBACK_AUTH_MESSAGE = 'Session expired. Please sign in again.'

const cashierMealErrorRules: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /(уже выдан|уже было выдано|already issued|already used|недоступны или уже выданы)/i,
    message: 'Питание уже выдано',
  },
  {
    pattern: /(праздн|выходн|каникул|нерабоч|serving.*closed|выдача закрыта)/i,
    message: 'Выдача закрыта',
  },
  {
    pattern: /(не найден|not found|invalid .*code|некорректн.*код)/i,
    message: 'Талон не найден',
  },
  {
    pattern: /(не положен|недоступен|неактивен|не действует|доступ .* запрещен|forbidden|access denied)/i,
    message: 'Выдача недоступна',
  },
]

function normalizeMessage(message: string | null | undefined): string | null {
  const normalized = (message ?? '').trim().replace(/\s+/g, ' ')
  return normalized || null
}

export function sanitizeCashierMealRequestMessage(
  message: string | null | undefined,
  fallbackMessage: string,
): string {
  const normalized = normalizeMessage(message)
  if (!normalized) {
    return fallbackMessage
  }

  if (isCrossBuildingCashierAccessMessage(normalized)) {
    return normalized
  }

  for (const rule of cashierMealErrorRules) {
    if (rule.pattern.test(normalized)) {
      return rule.message
    }
  }

  return fallbackMessage
}

export function sanitizeCashierSyncResultMessage(message: string | null | undefined): string | null {
  const normalized = normalizeMessage(message)
  if (!normalized) {
    return null
  }

  return sanitizeCashierMealRequestMessage(normalized, 'Требуется ручная проверка')
}

interface CashierRequestErrorOptions {
  fallbackMessage: string
  offlineOnNetwork?: boolean
  sanitizeMessage?: (message: string | null | undefined, fallbackMessage: string) => string
}

export function rethrowCashierRequestError(error: unknown, options: CashierRequestErrorOptions): never {
  if (isNetworkRequestError(error)) {
    if (options.offlineOnNetwork) {
      throw new Error(CASHIER_OFFLINE_ERROR_CODE)
    }

    if (error instanceof Error) {
      throw error
    }

    throw new TypeError('Network unavailable. Check connection and try again.')
  }

  if (isAuthHttpError(error)) {
    if (error instanceof Error) {
      throw error
    }

    throw new Error(CASHIER_FALLBACK_AUTH_MESSAGE)
  }

  const sanitizeMessage = options.sanitizeMessage ?? ((_: string | null | undefined, fallbackMessage: string) => fallbackMessage)
  const message = error instanceof Error ? error.message : null
  throw new Error(sanitizeMessage(message, options.fallbackMessage))
}

export function isCashierOfflineTransportError(error: unknown): boolean {
  return error instanceof Error && error.message === CASHIER_OFFLINE_ERROR_CODE
}
