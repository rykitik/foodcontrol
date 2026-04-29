import type { Ref } from 'vue'

import { resolveCashierCode } from '@/services/api'
import {
  fetchAndStoreCashierOfflineSnapshot,
  hasCashierOfflineSnapshotForActivePartition,
  resolveCashierLookupOffline,
} from '@/services/cashierOfflineSnapshot'
import {
  CASHIER_OFFLINE_ERROR_CODE,
  isCashierOfflineTransportError,
} from '@/services/cashierRequestErrors'
import { isAuthHttpError, isNetworkRequestError } from '@/services/http'
import { localDateIso } from '@/utils/cashierTerminal'
import type { CashierLookupResult, MealType } from '@/types'

import type { CashierTerminalStatusController } from './status'

interface CashierTerminalLookupAuth {
  token: string | null
  isAuthenticated: boolean
  user?: {
    role?: string | null
  } | null
}

interface CashierTerminalLookupControllerOptions {
  auth: CashierTerminalLookupAuth
  isOnline: Ref<boolean>
  queryValue: Ref<string>
  lastQueryValue: Ref<string>
  lookup: Ref<CashierLookupResult | null>
  loading: Ref<boolean>
  hasOfflineSnapshot: Ref<boolean>
  snapshotRefreshing: Ref<boolean>
  hasCashierOfflineContext: () => boolean
  resetSelection: () => void
  cancelAutoReset: () => void
  notifyServerReachable: () => void
  notifyServerUnavailable: () => void
  pushEvent: (message: string, tone?: 'info' | 'success' | 'warning' | 'danger') => void
  statusController: Pick<
    CashierTerminalStatusController,
    'handleAuthFailure' | 'handleLookupResult' | 'handleLookupUnavailable' | 'handleLookupFailure'
  >
}

export interface CashierTerminalLookupController {
  loadOfflineSnapshotAvailability: () => Promise<void>
  refreshOfflineSnapshot: () => Promise<void>
  resolveLookupWithFallback: (query: string) => Promise<CashierLookupResult>
  handleTicketLookup: (query: string, onAutoCommit: (meals: MealType[]) => Promise<void>) => Promise<void>
}

export function createCashierTerminalLookupController(
  options: CashierTerminalLookupControllerOptions,
): CashierTerminalLookupController {
  function isOfflineLookupAllowed(): boolean {
    return options.hasCashierOfflineContext() && options.hasOfflineSnapshot.value
  }

  async function resolveLookupOffline(query: string): Promise<CashierLookupResult | null> {
    if (!isOfflineLookupAllowed()) {
      return null
    }

    return resolveCashierLookupOffline(query, { issueDate: localDateIso() })
  }

  async function loadOfflineSnapshotAvailability() {
    options.hasOfflineSnapshot.value =
      options.auth.user?.role === 'cashier' && options.hasCashierOfflineContext()
        ? await hasCashierOfflineSnapshotForActivePartition()
        : false
  }

  async function refreshOfflineSnapshot() {
    if (
      !options.auth.token ||
      options.auth.user?.role !== 'cashier' ||
      !options.hasCashierOfflineContext() ||
      !options.isOnline.value ||
      options.snapshotRefreshing.value
    ) {
      options.hasOfflineSnapshot.value = false
      return
    }

    options.snapshotRefreshing.value = true
    try {
      const snapshot = await fetchAndStoreCashierOfflineSnapshot(options.auth.token)
      options.hasOfflineSnapshot.value = Boolean(snapshot)
      if (snapshot) {
        options.notifyServerReachable()
        options.pushEvent(
          `Локальный снимок обновлен (${snapshot.datasets.students.length} студентов)`,
          'info',
        )
      }
    } catch (error) {
      if (isAuthHttpError(error)) {
        options.statusController.handleAuthFailure('Обновление локальных данных')
        return
      }

      if (isNetworkRequestError(error)) {
        options.notifyServerUnavailable()
      } else {
        options.pushEvent('Не удалось обновить локальный снимок', 'warning')
      }
    } finally {
      options.snapshotRefreshing.value = false
    }
  }

  async function resolveLookupWithFallback(query: string): Promise<CashierLookupResult> {
    if (!options.isOnline.value) {
      const offlineLookup = await resolveLookupOffline(query)
      if (offlineLookup) {
        return offlineLookup
      }

      throw new Error(CASHIER_OFFLINE_ERROR_CODE)
    }

    try {
      const result = await resolveCashierCode(query)
      options.notifyServerReachable()
      return result
    } catch (error) {
      if (!isCashierOfflineTransportError(error) && !isNetworkRequestError(error)) {
        throw error
      }

      options.notifyServerUnavailable()
      const offlineLookup = await resolveLookupOffline(query)
      if (offlineLookup) {
        return offlineLookup
      }

      throw new Error(CASHIER_OFFLINE_ERROR_CODE)
    }
  }

  async function handleTicketLookup(
    query: string,
    onAutoCommit: (meals: MealType[]) => Promise<void>,
  ) {
    options.loading.value = true
    options.lastQueryValue.value = query
    options.cancelAutoReset()
    options.resetSelection()

    try {
      const result = await resolveLookupWithFallback(query)
      options.lookup.value = result
      options.statusController.handleLookupResult(result)

      const hasExplicitScanHint = Boolean(result.scan_meal_hint?.length)
      const shouldAutoCommit = hasExplicitScanHint
        ? Boolean(result.remaining_meals?.length)
        : result.remaining_meals?.length === 1

      if (shouldAutoCommit) {
        const meals = [...(result.remaining_meals ?? [])]
        await onAutoCommit(meals)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка проверки'
      if (isAuthHttpError(error)) {
        options.statusController.handleAuthFailure('Проверка талона')
      } else if (
        message === CASHIER_OFFLINE_ERROR_CODE ||
        isCashierOfflineTransportError(error) ||
        isNetworkRequestError(error)
      ) {
        options.statusController.handleLookupUnavailable()
      } else {
        options.statusController.handleLookupFailure(message)
      }
    } finally {
      options.loading.value = false
      options.queryValue.value = ''
    }
  }

  return {
    loadOfflineSnapshotAvailability,
    refreshOfflineSnapshot,
    resolveLookupWithFallback,
    handleTicketLookup,
  }
}
