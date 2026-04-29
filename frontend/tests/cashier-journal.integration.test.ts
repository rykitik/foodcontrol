import { describe, expect, test, vi } from 'vitest'

import { createUser } from './helpers/fixtures'

describe('Cashier journal integration', () => {
  test('cashier journal loads server records together with local offline state', async () => {
    vi.resetModules()

    vi.doMock('@/services/api', () => ({
      getCashierJournal: vi.fn().mockResolvedValue({
        date: '2026-04-21',
        scope: {
          building_id: 1,
          building_name: 'Корпус 1',
          scope_label: 'Корпус 1',
        },
        summary: {
          records_count: 4,
          students_count: 4,
          attention_records_count: 1,
          attention_students_count: 1,
          duplicate_same_meal_count: 1,
          multiple_buildings_count: 1,
          outside_assigned_building_count: 1,
          total_amount: 640,
        },
        attention_items: [],
        records: [],
      }),
    }))
    vi.doMock('@/services/cashierOfflineMaintenance', () => ({
      runCashierOfflineMaintenance: vi.fn().mockResolvedValue(undefined),
    }))
    vi.doMock('@/services/cashierOfflineSync', () => ({
      listCashierNeedsReviewItems: vi.fn().mockResolvedValue([
        {
          request_id: 'review-1',
          payload: {
            request_id: 'review-1',
            code: 'QR-001',
            selected_meals: ['breakfast'],
            created_at: '2026-04-21T08:00:00.000Z',
            student_name: 'Test Student',
            group_name: 'A-01',
          },
          reason: 'Питание уже выдано',
          updated_at: '2026-04-21T08:05:00.000Z',
          server_status: 409,
        },
      ]),
    }))
    vi.doMock('@/services/cashierOfflineSnapshot', () => ({
      fetchAndStoreCashierOfflineSnapshot: vi.fn().mockResolvedValue(null),
      readCashierOfflineSnapshotDatasetHealth: vi.fn().mockResolvedValue({
        ready: true,
        students_count: 18,
        tickets_count: 18,
        categories_count: 3,
      }),
    }))
    vi.doMock('@/services/cashierOfflineStorage', () => ({
      restoreCashierStoragePartitionForUser: vi.fn().mockResolvedValue({
        terminal_id: 'terminal-1',
        user_id: 'cashier-1',
        role: 'cashier',
      }),
      readSnapshotMeta: vi.fn().mockResolvedValue({
        generated_at: '2026-04-21T06:45:00.000Z',
        service_date: '2026-04-21',
      }),
      readTerminalMetaForActivePartitionSync: vi.fn(() => ({
        display_name: 'Терминал столовой',
      })),
    }))
    vi.doMock('@/utils/cashierSession', () => ({
      loadCashierEvents: vi.fn(() => [
        {
          id: 'event-1',
          message: 'Синхронизация завершена',
          tone: 'success',
          created_at: '2026-04-21T06:50:00.000Z',
        },
      ]),
      loadCashierQueue: vi.fn(() => [
        {
          request_id: 'queue-1',
          code: 'QR-002',
          selected_meals: ['lunch'],
          created_at: '2026-04-21T07:00:00.000Z',
          student_name: 'Queued Student',
          group_name: 'B-02',
        },
      ]),
    }))

    const { useAuthStore } = await import('@/stores/auth')
    const { useCashierJournal } = await import('@/composables/useCashierJournal')

    useAuthStore().setSession('cashier-token', createUser('cashier', { id: 'cashier-1', building_id: 1 }))

    const journal = useCashierJournal()
    await journal.loadJournal()

    expect(journal.journal.value?.summary.records_count).toBe(4)
    expect(journal.offlineState.value.snapshot_ready).toBe(true)
    expect(journal.offlineState.value.is_online).toBe(true)
    expect(journal.offlineState.value.queue_count).toBe(1)
    expect(journal.offlineState.value.review_count).toBe(1)
    expect(journal.offlineState.value.terminal_display_name).toBe('Терминал столовой')
    expect(journal.error.value).toBeNull()
  })

  test('cashier journal reports offline server unavailability without losing local verification state', async () => {
    vi.resetModules()

    vi.doMock('@/services/api', () => ({
      getCashierJournal: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    }))
    vi.doMock('@/services/cashierOfflineMaintenance', () => ({
      runCashierOfflineMaintenance: vi.fn().mockResolvedValue(undefined),
    }))
    vi.doMock('@/services/cashierOfflineSync', () => ({
      listCashierNeedsReviewItems: vi.fn().mockResolvedValue([]),
    }))
    vi.doMock('@/services/cashierOfflineSnapshot', () => ({
      fetchAndStoreCashierOfflineSnapshot: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      readCashierOfflineSnapshotDatasetHealth: vi.fn().mockResolvedValue({
        ready: false,
        students_count: 0,
        tickets_count: 0,
        categories_count: 0,
      }),
    }))
    vi.doMock('@/services/cashierOfflineStorage', () => ({
      restoreCashierStoragePartitionForUser: vi.fn().mockResolvedValue({
        terminal_id: 'terminal-1',
        user_id: 'cashier-1',
        role: 'cashier',
      }),
      readSnapshotMeta: vi.fn().mockResolvedValue({
        generated_at: '2026-04-20T15:00:00.000Z',
        service_date: '2026-04-20',
      }),
      readTerminalMetaForActivePartitionSync: vi.fn(() => ({
        display_name: 'Терминал столовой',
      })),
    }))
    vi.doMock('@/utils/cashierSession', () => ({
      loadCashierEvents: vi.fn(() => []),
      loadCashierQueue: vi.fn(() => [
        {
          request_id: 'queue-1',
          code: 'QR-002',
          selected_meals: ['lunch'],
          created_at: '2026-04-21T07:00:00.000Z',
          student_name: 'Queued Student',
          group_name: 'B-02',
        },
      ]),
    }))

    const { useAuthStore } = await import('@/stores/auth')
    const { useCashierJournal } = await import('@/composables/useCashierJournal')

    useAuthStore().setSession('cashier-token', createUser('cashier', { id: 'cashier-1', building_id: 1 }))

    const journal = useCashierJournal()
    await journal.loadJournal()

    expect(journal.offlineUnavailable.value).toBe(true)
    expect(journal.error.value).toBe(
      'Серверная проверка журнала доступна только при подключении к сети.',
    )
    expect(journal.offlineState.value.has_partition).toBe(true)
    expect(journal.offlineState.value.queue_count).toBe(1)
    expect(journal.journal.value).toBeNull()
  })
})
