import type {
  CashierLookupResult,
  CashierOfflineSnapshotResponse,
  CashierOfflineSyncRequestItem,
  CashierOfflineSyncResponse,
  CashierDailySummary,
  DashboardStats,
  MealReport,
  MealSelectionRequest,
  MealSelectionResponse,
} from '@/types'

import * as mock from '../mock'
import { authHeaders, requestBlob, requestJson } from '../http'
import {
  rethrowCashierRequestError,
  sanitizeCashierMealRequestMessage,
} from '@/services/cashierRequestErrors'
import { createSearchParams, withQuery } from './shared'

export async function resolveCashierCode(query: string): Promise<CashierLookupResult> {
  try {
    return await requestJson(
      `/meals/resolve?query=${encodeURIComponent(query)}`,
      { method: 'GET', headers: authHeaders() },
      () => mock.resolveCashierCode(query),
    )
  } catch (error) {
    rethrowCashierRequestError(error, {
      fallbackMessage: 'Не удалось проверить талон.',
      offlineOnNetwork: true,
      sanitizeMessage: sanitizeCashierMealRequestMessage,
    })
  }
}

export async function confirmMealSelection(
  request: MealSelectionRequest,
  token?: string | null,
): Promise<MealSelectionResponse> {
  try {
    return await requestJson(
      '/meals/confirm-selection',
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(request),
      },
      () => mock.confirmMealSelection(request, token),
    )
  } catch (error) {
    rethrowCashierRequestError(error, {
      fallbackMessage: 'Не удалось подтвердить выдачу.',
      offlineOnNetwork: true,
      sanitizeMessage: sanitizeCashierMealRequestMessage,
    })
  }
}

export async function fetchCashierOfflineSnapshot(token?: string | null): Promise<CashierOfflineSnapshotResponse> {
  try {
    return await requestJson('/meals/offline-snapshot', { method: 'GET', headers: authHeaders(token) })
  } catch (error) {
    rethrowCashierRequestError(error, {
      fallbackMessage: 'Не удалось обновить локальные данные кассы.',
    })
  }
}

export async function syncCashierOfflineSelections(
  items: CashierOfflineSyncRequestItem[],
  token?: string | null,
): Promise<CashierOfflineSyncResponse> {
  try {
    return await requestJson('/meals/offline-sync', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ items }),
    })
  } catch (error) {
    rethrowCashierRequestError(error, {
      fallbackMessage: 'Не удалось синхронизировать офлайн-очередь.',
    })
  }
}

export async function getTodayStats(buildingId?: number): Promise<DashboardStats> {
  const query = buildingId ? `?building_id=${buildingId}` : ''
  return requestJson(`/meals/today-stats${query}`, { method: 'GET', headers: authHeaders() }, () =>
    mock.getTodayStats(buildingId),
  )
}

export async function getCashierDailySummary(
  days = 7,
  buildingId?: number,
  options?: { month?: number; year?: number },
): Promise<CashierDailySummary> {
  const params = createSearchParams({ days, building_id: buildingId, month: options?.month, year: options?.year })
  try {
    return await requestJson(
      withQuery('/meals/daily-summary', params),
      { method: 'GET', headers: authHeaders() },
      () => mock.getCashierDailySummary(days, buildingId, options),
    )
  } catch (error) {
    rethrowCashierRequestError(error, {
      fallbackMessage: 'Не удалось загрузить дневную сводку.',
    })
  }
}

export async function downloadCashierSummaryXlsx(
  days = 7,
  buildingId?: number,
  options?: { month?: number; year?: number },
): Promise<Blob> {
  const params = createSearchParams({ days, building_id: buildingId, month: options?.month, year: options?.year })
  try {
    return await requestBlob(
      withQuery('/meals/daily-summary/xlsx', params),
      { method: 'GET', headers: authHeaders() },
      () => mock.downloadCashierSummaryXlsx(days, buildingId, options),
    )
  } catch (error) {
    rethrowCashierRequestError(error, {
      fallbackMessage: 'Не удалось выгрузить сводку кассы.',
    })
  }
}

export async function getMealReport(
  periodStart: string,
  periodEnd: string,
  options?: { category_id?: number; building_id?: number; status?: string },
): Promise<MealReport> {
  const params = createSearchParams({
    period_start: periodStart,
    period_end: periodEnd,
    category_id: options?.category_id,
    building_id: options?.building_id,
    status: options?.status,
  })
  return requestJson(withQuery('/meals/report', params), { method: 'GET', headers: authHeaders() }, () =>
    mock.getMealReport(periodStart, periodEnd, options),
  )
}
