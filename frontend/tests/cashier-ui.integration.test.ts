import { createApp, nextTick, ref } from 'vue'
import { describe, expect, test, vi } from 'vitest'

import { createCashierLookupResult, createUser, jsonResponse } from './helpers/fixtures'

function createLookupStatusController() {
  return {
    handleAuthFailure: vi.fn(),
    handleLookupFailure: vi.fn(),
    handleLookupResult: vi.fn(),
    handleLookupUnavailable: vi.fn(),
  }
}

function createQueueStatusController() {
  return {
    setStatus: vi.fn(),
    handleAuthFailure: vi.fn(),
    handleSelectionUpdated: vi.fn(),
    handleSelectionWithoutLookup: vi.fn(),
    handleMealUnavailable: vi.fn(),
    handleEmptySelection: vi.fn(),
    handleOfflineModeUnavailable: vi.fn(),
    handleQueueDuplicate: vi.fn(),
    handleQueueEnqueued: vi.fn(),
    handleSelectionApplied: vi.fn(),
    handleConfirmFailure: vi.fn(),
  }
}

describe('Cashier UI integration', () => {
  test('lookup keeps a success state when part of the meal allowance is already used but another meal remains', async () => {
    vi.resetModules()

    const { createCashierTerminalStatusController } = await import('@/composables/cashierTerminal/status')
    const status = ref({ kind: 'ready', title: '', text: '' })
    const controller = createCashierTerminalStatusController({
      status,
      pushEvent: vi.fn(),
      scheduleAutoReset: vi.fn(),
    })

    controller.handleLookupResult(
      createCashierLookupResult({
        allowed_meals: ['breakfast', 'lunch'],
        remaining_meals: ['lunch'],
        today_statuses: [
          { meal_type: 'breakfast', issued: true, price: 120 },
          { meal_type: 'lunch', issued: false, price: 165 },
        ],
      }),
    )

    expect(status.value.kind).toBe('success')
    expect(status.value.title).toBe('Часть питания уже выдана')
    expect(status.value.text).toContain('Обед')
    expect(status.value.text).toContain('Завтрак')
  })

  test('lookup does not fall into fully-used messaging when remaining meals can be derived from today statuses', async () => {
    vi.resetModules()

    const { createCashierTerminalStatusController } = await import('@/composables/cashierTerminal/status')
    const status = ref({ kind: 'ready', title: '', text: '' })
    const controller = createCashierTerminalStatusController({
      status,
      pushEvent: vi.fn(),
      scheduleAutoReset: vi.fn(),
    })

    controller.handleLookupResult(
      createCashierLookupResult({
        allowed_meals: ['breakfast', 'lunch'],
        remaining_meals: [],
        today_statuses: [
          { meal_type: 'breakfast', issued: true, price: 120 },
          { meal_type: 'lunch', issued: false, price: 165 },
        ],
      }),
    )

    expect(status.value.kind).toBe('success')
    expect(status.value.title).toBe('Часть питания уже выдана')
    expect(status.value.text).not.toContain('доступных приемов пищи больше нет')
  })

  test('lookup blocks an inactive student before cashier success flow starts', async () => {
    vi.resetModules()

    const { createCashierTerminalStatusController } = await import('@/composables/cashierTerminal/status')
    const status = ref({ kind: 'ready', title: '', text: '' })
    const controller = createCashierTerminalStatusController({
      status,
      pushEvent: vi.fn(),
      scheduleAutoReset: vi.fn(),
    })

    controller.handleLookupResult(
      createCashierLookupResult({
        student: {
          id: 'student-1',
          full_name: 'Inactive Student',
          student_card: '100001',
          group_name: 'A-01',
          building_id: 1,
          category: {
            id: 1,
            name: 'Default',
            code: 'DEFAULT',
            breakfast: true,
            lunch: true,
            meal_types: ['breakfast', 'lunch'],
          },
          category_id: 1,
          is_active: false,
        },
        allowed_meals: [],
        remaining_meals: [],
      }),
    )

    expect(status.value.kind).toBe('blocked')
    expect(status.value.title).toBe('Студент выключен')
  })

  test('lookup failure keeps the assigned meal building in the cashier denial state', async () => {
    vi.resetModules()

    const { createCashierTerminalStatusController } = await import('@/composables/cashierTerminal/status')
    const status = ref({ kind: 'ready', title: '', text: '' })
    const controller = createCashierTerminalStatusController({
      status,
      pushEvent: vi.fn(),
      scheduleAutoReset: vi.fn(),
    })

    controller.handleLookupFailure('Студент питается в другом корпусе. Питание назначено в: Корпус 2, Яковлева, д.17.')

    expect(status.value.kind).toBe('blocked')
    expect(status.value.title).toBe('Питание в другом корпусе')
    expect(status.value.text).toBe('Питание назначено в: Корпус 2, Яковлева, д.17')
  })

  test('status board uses a dedicated headline for cross-building denial', async () => {
    vi.resetModules()

    const CashierTerminalStatusBoard = (await import('@/components/cashier/CashierTerminalStatusBoard.vue')).default
    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp(CashierTerminalStatusBoard, {
      statusClass: 'terminal-status',
      statusKind: 'blocked',
      statusTitle: 'Питание в другом корпусе',
      statusText: 'Питание назначено в: Корпус 2, Яковлева, д.17',
      lastQueryValue: '100001',
      lookupStatuses: [],
      selectedMeals: [],
      remainingMeals: [],
      allowedMealsLabel: '—',
      selectionLabel: '',
      showManualMealControls: false,
      autoResetActive: false,
      autoResetKey: 0,
      autoResetDelayMs: 6000,
      queryValue: '',
      queueCount: 0,
      loading: false,
    })
    app.mount(container)
    await nextTick()

    expect(container.querySelector('.terminal-state-chip')?.textContent).toBe('ДРУГОЙ КОРПУС')
    expect(container.querySelector('.terminal-result-card h1')?.textContent).toBe('Другой корпус питания')

    app.unmount()
    container.remove()
  })

  test('lookup auth failures go to the cashier auth path instead of business errors', async () => {
    vi.doMock('@/services/api', async () => {
      const { HttpRequestError } = await import('@/services/http')
      return {
        resolveCashierCode: vi.fn().mockRejectedValue(new HttpRequestError(401, 'Session expired. Please sign in again.')),
      }
    })
    vi.doMock('@/services/cashierOfflineSnapshot', () => ({
      fetchAndStoreCashierOfflineSnapshot: vi.fn(),
      hasCashierOfflineSnapshotForActivePartition: vi.fn().mockResolvedValue(false),
      resolveCashierLookupOffline: vi.fn().mockResolvedValue(null),
    }))

    const { createCashierTerminalLookupController } = await import('@/composables/cashierTerminal/lookup')
    const statusController = createLookupStatusController()

    const controller = createCashierTerminalLookupController({
      auth: { token: 'cashier-token', isAuthenticated: true, user: { role: 'cashier' } },
      isOnline: ref(true),
      queryValue: ref(''),
      lastQueryValue: ref(''),
      lookup: ref(null),
      loading: ref(false),
      hasOfflineSnapshot: ref(false),
      snapshotRefreshing: ref(false),
      hasCashierOfflineContext: () => true,
      resetSelection: vi.fn(),
      cancelAutoReset: vi.fn(),
      notifyServerReachable: vi.fn(),
      notifyServerUnavailable: vi.fn(),
      pushEvent: vi.fn(),
      statusController,
    })

    await controller.handleTicketLookup('QR-001', vi.fn())

    expect(statusController.handleAuthFailure).toHaveBeenCalledWith('Проверка талона')
    expect(statusController.handleLookupFailure).not.toHaveBeenCalled()
    expect(statusController.handleLookupUnavailable).not.toHaveBeenCalled()
  })

  test('lookup network failures go through the controlled cashier unavailable path', async () => {
    vi.doMock('@/services/api', () => ({
      resolveCashierCode: vi.fn().mockRejectedValue(new TypeError('Network unavailable. Check connection and try again.')),
    }))
    vi.doMock('@/services/cashierOfflineSnapshot', () => ({
      fetchAndStoreCashierOfflineSnapshot: vi.fn(),
      hasCashierOfflineSnapshotForActivePartition: vi.fn().mockResolvedValue(false),
      resolveCashierLookupOffline: vi.fn().mockResolvedValue(null),
    }))

    const { createCashierTerminalLookupController } = await import('@/composables/cashierTerminal/lookup')
    const statusController = createLookupStatusController()

    const controller = createCashierTerminalLookupController({
      auth: { token: 'cashier-token', isAuthenticated: true, user: { role: 'cashier' } },
      isOnline: ref(true),
      queryValue: ref(''),
      lastQueryValue: ref(''),
      lookup: ref(null),
      loading: ref(false),
      hasOfflineSnapshot: ref(false),
      snapshotRefreshing: ref(false),
      hasCashierOfflineContext: () => true,
      resetSelection: vi.fn(),
      cancelAutoReset: vi.fn(),
      notifyServerReachable: vi.fn(),
      notifyServerUnavailable: vi.fn(),
      pushEvent: vi.fn(),
      statusController,
    })

    await controller.handleTicketLookup('QR-001', vi.fn())

    expect(statusController.handleLookupUnavailable).toHaveBeenCalled()
    expect(statusController.handleAuthFailure).not.toHaveBeenCalled()
    expect(statusController.handleLookupFailure).not.toHaveBeenCalled()
  })

  test('offline lookup preserves another-building denial instead of masking it as unavailable', async () => {
    vi.doMock('@/services/api', () => ({
      resolveCashierCode: vi.fn(),
    }))
    vi.doMock('@/services/cashierOfflineSnapshot', () => ({
      fetchAndStoreCashierOfflineSnapshot: vi.fn(),
      hasCashierOfflineSnapshotForActivePartition: vi.fn().mockResolvedValue(true),
      resolveCashierLookupOffline: vi
        .fn()
        .mockRejectedValue(
          new Error('Студент питается в другом корпусе. Питание назначено в: Корпус 2, Яковлева, д.17.'),
        ),
    }))

    const { createCashierTerminalLookupController } = await import('@/composables/cashierTerminal/lookup')
    const statusController = createLookupStatusController()

    const controller = createCashierTerminalLookupController({
      auth: { token: 'cashier-token', isAuthenticated: true, user: { role: 'cashier' } },
      isOnline: ref(false),
      queryValue: ref(''),
      lastQueryValue: ref(''),
      lookup: ref(null),
      loading: ref(false),
      hasOfflineSnapshot: ref(true),
      snapshotRefreshing: ref(false),
      hasCashierOfflineContext: () => true,
      resetSelection: vi.fn(),
      cancelAutoReset: vi.fn(),
      notifyServerReachable: vi.fn(),
      notifyServerUnavailable: vi.fn(),
      pushEvent: vi.fn(),
      statusController,
    })

    await controller.handleTicketLookup('REMOTE-QR-001', vi.fn())

    expect(statusController.handleLookupFailure).toHaveBeenCalledWith(
      'Студент питается в другом корпусе. Питание назначено в: Корпус 2, Яковлева, д.17.',
    )
    expect(statusController.handleLookupUnavailable).not.toHaveBeenCalled()
    expect(statusController.handleAuthFailure).not.toHaveBeenCalled()
  })

  test('lookup forbidden by meal building is shown as business denial instead of expired session', async () => {
    vi.doUnmock('@/services/api')
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(
          { error: 'Студент питается в другом корпусе. Питание назначено в: Корпус 2, Яковлева, д.17.' },
          403,
        ),
      )
    vi.doMock('@/services/cashierOfflineSnapshot', () => ({
      fetchAndStoreCashierOfflineSnapshot: vi.fn(),
      hasCashierOfflineSnapshotForActivePartition: vi.fn().mockResolvedValue(false),
      resolveCashierLookupOffline: vi.fn().mockResolvedValue(null),
    }))

    const { createCashierTerminalLookupController } = await import('@/composables/cashierTerminal/lookup')
    const statusController = createLookupStatusController()

    const controller = createCashierTerminalLookupController({
      auth: { token: 'cashier-token', isAuthenticated: true, user: { role: 'cashier' } },
      isOnline: ref(true),
      queryValue: ref(''),
      lastQueryValue: ref(''),
      lookup: ref(null),
      loading: ref(false),
      hasOfflineSnapshot: ref(false),
      snapshotRefreshing: ref(false),
      hasCashierOfflineContext: () => true,
      resetSelection: vi.fn(),
      cancelAutoReset: vi.fn(),
      notifyServerReachable: vi.fn(),
      notifyServerUnavailable: vi.fn(),
      pushEvent: vi.fn(),
      statusController,
    })

    await controller.handleTicketLookup('QR-001', vi.fn())

    expect(statusController.handleLookupFailure).toHaveBeenCalledWith(
      'Студент питается в другом корпусе. Питание назначено в: Корпус 2, Яковлева, д.17.',
    )
    expect(statusController.handleAuthFailure).not.toHaveBeenCalled()
    expect(statusController.handleLookupUnavailable).not.toHaveBeenCalled()
  })

  test('confirm auth failures are not masked as ordinary cashier business errors', async () => {
    vi.doMock('@/services/api', async () => {
      const { HttpRequestError } = await import('@/services/http')
      return {
        confirmMealSelection: vi.fn().mockRejectedValue(new HttpRequestError(401, 'Session expired. Please sign in again.')),
      }
    })

    const { createCashierTerminalQueueController } = await import('@/composables/cashierTerminal/queue')
    const statusController = createQueueStatusController()
    const syncController = {
      enqueuePendingSelection: vi.fn(),
      hasPendingMealConflict: vi.fn(() => false),
    }

    const controller = createCashierTerminalQueueController({
      auth: { token: 'cashier-token' },
      isOnline: ref(true),
      lookup: ref(createCashierLookupResult()),
      selectedMeals: ref(['breakfast']),
      loading: ref(false),
      lastQueryValue: ref('QR-001'),
      hasCashierOfflineContext: () => true,
      cancelAutoReset: vi.fn(),
      refreshStats: vi.fn().mockResolvedValue(undefined),
      resolveLookupWithFallback: vi.fn().mockResolvedValue(createCashierLookupResult()),
      notifyServerReachable: vi.fn(),
      notifyServerUnavailable: vi.fn(),
      statusController,
      syncController,
    })

    await controller.confirmCurrentSelection()

    expect(statusController.handleAuthFailure).toHaveBeenCalledWith('Выдача питания')
    expect(statusController.handleConfirmFailure).not.toHaveBeenCalled()
    expect(syncController.enqueuePendingSelection).not.toHaveBeenCalled()
  })

  test('confirm does not send inactive student selections to the API', async () => {
    const confirmMealSelection = vi.fn()
    vi.doMock('@/services/api', () => ({
      confirmMealSelection,
    }))

    const { createCashierTerminalQueueController } = await import('@/composables/cashierTerminal/queue')
    const statusController = createQueueStatusController()
    const syncController = {
      enqueuePendingSelection: vi.fn(),
      hasPendingMealConflict: vi.fn(() => false),
    }

    const controller = createCashierTerminalQueueController({
      auth: { token: 'cashier-token' },
      isOnline: ref(true),
      lookup: ref(
        createCashierLookupResult({
          student: {
            id: 'student-1',
            full_name: 'Inactive Student',
            student_card: '100001',
            group_name: 'A-01',
            building_id: 1,
            category: {
              id: 1,
              name: 'Default',
              code: 'DEFAULT',
              breakfast: true,
              lunch: true,
              meal_types: ['breakfast', 'lunch'],
            },
            category_id: 1,
            is_active: false,
          },
          allowed_meals: [],
          remaining_meals: [],
        }),
      ),
      selectedMeals: ref(['breakfast']),
      loading: ref(false),
      lastQueryValue: ref('QR-001'),
      hasCashierOfflineContext: () => true,
      cancelAutoReset: vi.fn(),
      refreshStats: vi.fn().mockResolvedValue(undefined),
      resolveLookupWithFallback: vi.fn().mockResolvedValue(createCashierLookupResult()),
      notifyServerReachable: vi.fn(),
      notifyServerUnavailable: vi.fn(),
      statusController,
      syncController,
    })

    await controller.confirmCurrentSelection()

    expect(confirmMealSelection).not.toHaveBeenCalled()
    expect(statusController.handleConfirmFailure).toHaveBeenCalledWith('Студент выключен. Выдача питания недоступна')
    expect(syncController.enqueuePendingSelection).not.toHaveBeenCalled()
  })

  test('confirm network failures enqueue the selection into the controlled offline path', async () => {
    vi.doMock('@/services/api', () => ({
      confirmMealSelection: vi.fn().mockRejectedValue(new TypeError('Network unavailable. Check connection and try again.')),
    }))

    const { createCashierTerminalQueueController } = await import('@/composables/cashierTerminal/queue')
    const statusController = createQueueStatusController()
    const syncController = {
      enqueuePendingSelection: vi.fn().mockResolvedValue(undefined),
      hasPendingMealConflict: vi.fn(() => false),
    }

    const controller = createCashierTerminalQueueController({
      auth: { token: 'cashier-token' },
      isOnline: ref(true),
      lookup: ref(createCashierLookupResult()),
      selectedMeals: ref(['breakfast']),
      loading: ref(false),
      lastQueryValue: ref('QR-001'),
      hasCashierOfflineContext: () => true,
      cancelAutoReset: vi.fn(),
      refreshStats: vi.fn().mockResolvedValue(undefined),
      resolveLookupWithFallback: vi.fn().mockResolvedValue(createCashierLookupResult()),
      notifyServerReachable: vi.fn(),
      notifyServerUnavailable: vi.fn(),
      statusController,
      syncController,
    })

    await controller.confirmCurrentSelection()

    expect(syncController.enqueuePendingSelection).toHaveBeenCalledTimes(1)
    expect(statusController.handleQueueEnqueued).toHaveBeenCalledTimes(1)
    expect(statusController.handleAuthFailure).not.toHaveBeenCalled()
    expect(statusController.handleConfirmFailure).not.toHaveBeenCalled()
  })

  test('cashier summary hides raw backend payloads behind safe UI text', async () => {
    vi.doUnmock('@/services/api')

    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ msg: 'internal backend trace: summary failed' }, 500))

    const { useAuthStore } = await import('@/stores/auth')
    const { useCashierSummary } = await import('@/composables/useCashierSummary')

    useAuthStore().setSession('cashier-token', createUser('cashier', { id: 'cashier-1', building_id: 1 }))

    const summary = useCashierSummary()
    await summary.loadSummary()

    expect(summary.error.value).toBe('Не удалось загрузить дневную сводку.')
    expect(summary.error.value).not.toContain('internal backend trace')
  }, 10000)

  test('cashier summary explicitly reports that it is unavailable offline', async () => {
    vi.doUnmock('@/services/api')

    globalThis.fetch = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))

    const { useAuthStore } = await import('@/stores/auth')
    const { useCashierSummary } = await import('@/composables/useCashierSummary')

    useAuthStore().setSession('cashier-token', createUser('cashier', { id: 'cashier-1', building_id: 1 }))

    const summary = useCashierSummary()
    await summary.loadSummary()

    expect(summary.offlineUnavailable.value).toBe(true)
    expect(summary.error.value).toBe('Сводка доступна только при подключении к сети.')
  })

  test('cashier journal review reasons are sanitized before they reach the UI', async () => {
    const syncStates = new Map<string, Record<string, unknown>>()
    let queue = [
      {
        request_id: 'request-1',
        code: 'QR-001',
        selected_meals: ['breakfast'],
        created_at: '2026-04-16T10:00:00.000Z',
        student_name: 'Test Student',
        group_name: 'A-01',
      },
    ]

    vi.doMock('@/services/api', () => ({
      syncCashierOfflineSelections: vi.fn().mockResolvedValue({
        results: [
          {
            client_item_id: 'request-1',
            request_id: 'request-1',
            status: 'needs_review',
            http_status: 409,
            message: '{"msg":"already issued on backend"}',
          },
        ],
        summary: {
          acked: 0,
          rejected: 0,
          needs_review: 1,
        },
      }),
    }))
    vi.doMock('@/services/cashierOfflineStorage', () => ({
      getActiveCashierStoragePartition: vi.fn(() => ({
        terminal_id: 'terminal-1',
        user_id: 'cashier-1',
        role: 'cashier',
      })),
      loadOfflineQueueForActivePartitionSync: vi.fn(() => queue),
      persistOfflineQueueForActivePartition: vi.fn(async (nextQueue) => {
        queue = [...nextQueue]
        return true
      }),
      saveOfflineQueueForActivePartition: vi.fn((nextQueue) => {
        queue = [...nextQueue]
      }),
    }))
    vi.doMock('@/services/cashierOfflineDb', () => ({
      CASHIER_OFFLINE_STORES: {
        sync_state: 'sync_state',
      },
      idbDelete: vi.fn(async (_store: string, key: string) => {
        syncStates.delete(key)
        return true
      }),
      idbGet: vi.fn(async (_store: string, key: string) => syncStates.get(key)),
      idbGetAllByIndex: vi.fn(async (_store: string, indexName: string, query: string) => {
        if (indexName !== 'partition_key') {
          return []
        }

        return [...syncStates.values()].filter((value) => value.partition_key === query)
      }),
      idbPut: vi.fn(async (_store: string, value: Record<string, unknown>) => {
        syncStates.set(String(value.sync_state_id), value)
        return true
      }),
      isCashierOfflineDbAvailable: vi.fn(() => true),
    }))

    const { listCashierNeedsReviewItems, runCashierOfflineQueueSync } = await import('@/services/cashierOfflineSync')

    const result = await runCashierOfflineQueueSync({ token: 'cashier-token' })
    const reviewItems = await listCashierNeedsReviewItems()

    expect(result.needs_review_count).toBe(1)
    expect(reviewItems).toHaveLength(1)
    expect(reviewItems[0]?.reason).toBe('Питание уже выдано')
    expect(reviewItems[0]?.reason).not.toContain('already issued on backend')
  })
  test('resolved terminal sync states are not resent when stale queue entries survive a reload', async () => {
    vi.resetModules()

    const syncStates = new Map<string, Record<string, unknown>>()
    let queue = [
      {
        request_id: 'request-1',
        code: 'QR-001',
        selected_meals: ['breakfast'],
        created_at: '2026-04-16T10:00:00.000Z',
        student_name: 'Test Student',
        group_name: 'A-01',
      },
    ]
    const syncCashierOfflineSelections = vi.fn()

    syncStates.set('terminal-1:cashier-1:request-1', {
      sync_state_id: 'terminal-1:cashier-1:request-1',
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      request_id: 'request-1',
      status: 'needs_review',
      payload: queue[0],
      attempt_count: 1,
      last_attempt_at: '2026-04-16T10:05:00.000Z',
      next_retry_at: null,
      last_error: 'manual review required',
      server_status: 409,
      review_reason: 'manual review required',
      updated_at: '2026-04-16T10:05:00.000Z',
    })

    vi.doMock('@/services/api', () => ({
      syncCashierOfflineSelections,
    }))
    vi.doMock('@/services/cashierOfflineStorage', () => ({
      getActiveCashierStoragePartition: vi.fn(() => ({
        terminal_id: 'terminal-1',
        user_id: 'cashier-1',
        role: 'cashier',
      })),
      loadOfflineQueueForActivePartitionSync: vi.fn(() => queue),
      persistOfflineQueueForActivePartition: vi.fn(async (nextQueue) => {
        queue = [...nextQueue]
        return true
      }),
    }))
    vi.doMock('@/services/cashierOfflineDb', () => ({
      CASHIER_OFFLINE_STORES: {
        sync_state: 'sync_state',
      },
      idbDelete: vi.fn(async (_store: string, key: string) => {
        syncStates.delete(key)
        return true
      }),
      idbGet: vi.fn(async (_store: string, key: string) => syncStates.get(key)),
      idbGetAllByIndex: vi.fn(async (_store: string, indexName: string, query: string) => {
        if (indexName !== 'partition_key') {
          return []
        }

        return [...syncStates.values()].filter((value) => value.partition_key === query)
      }),
      idbPut: vi.fn(async (_store: string, value: Record<string, unknown>) => {
        syncStates.set(String(value.sync_state_id), value)
        return true
      }),
      isCashierOfflineDbAvailable: vi.fn(() => true),
    }))

    const { runCashierOfflineQueueSync } = await import('@/services/cashierOfflineSync')

    const result = await runCashierOfflineQueueSync({ token: 'cashier-token' })

    expect(syncCashierOfflineSelections).not.toHaveBeenCalled()
    expect(result.processed_count).toBe(0)
    expect(result.pending_count).toBe(1)
    expect(result.needs_review_count).toBe(0)
  })
})
