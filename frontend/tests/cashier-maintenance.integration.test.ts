import { describe, expect, test, vi } from 'vitest'

import { createUser } from './helpers/fixtures'

function installIndexedDbMock() {
  const idbDataByStore = new Map<string, Map<string, unknown>>()

  const ensureStore = (name: string): Map<string, unknown> => {
    const existing = idbDataByStore.get(name)
    if (existing) {
      return existing
    }

    const created = new Map<string, unknown>()
    idbDataByStore.set(name, created)
    return created
  }

  const keyForStoreRecord = (storeName: string, value: unknown): string => {
    const record = value as Record<string, unknown>

    if (
      storeName === 'terminal_meta' ||
      storeName === 'offline_grant' ||
      storeName === 'snapshot_meta' ||
      storeName === 'readiness_meta'
    ) {
      return String(record.partition_key ?? '')
    }

    if (storeName === 'offline_queue') {
      return String(record.queue_item_id ?? '')
    }

    if (storeName === 'sync_state') {
      return String(record.sync_state_id ?? '')
    }

    if (storeName === 'snapshot_students') {
      return String(record.snapshot_student_id ?? '')
    }

    if (storeName === 'snapshot_tickets') {
      return String(record.snapshot_ticket_id ?? '')
    }

    if (storeName === 'snapshot_categories') {
      return String(record.snapshot_category_id ?? '')
    }

    if (storeName === 'snapshot_holidays') {
      return String(record.snapshot_holiday_id ?? '')
    }

    if (storeName === 'snapshot_lookup_restrictions') {
      return String(record.snapshot_lookup_restriction_id ?? '')
    }

    return ''
  }

  vi.doMock('@/services/cashierOfflineDb', () => ({
    CASHIER_OFFLINE_DB_VERSION: 4,
    CASHIER_OFFLINE_STORES: {
      offline_queue: 'offline_queue',
      terminal_meta: 'terminal_meta',
      offline_grant: 'offline_grant',
      snapshot_meta: 'snapshot_meta',
      readiness_meta: 'readiness_meta',
      snapshot_students: 'snapshot_students',
      snapshot_tickets: 'snapshot_tickets',
      snapshot_categories: 'snapshot_categories',
      snapshot_holidays: 'snapshot_holidays',
      snapshot_lookup_restrictions: 'snapshot_lookup_restrictions',
      sync_state: 'sync_state',
    },
    isCashierOfflineDbAvailable: () => true,
    idbGet: vi.fn(async (storeName: string, key: string) => ensureStore(storeName).get(key)),
    idbPut: vi.fn(async (storeName: string, value: unknown) => {
      const key = keyForStoreRecord(storeName, value)
      if (!key) {
        return false
      }

      ensureStore(storeName).set(key, value)
      return true
    }),
    idbDelete: vi.fn(async (storeName: string, key: string) => ensureStore(storeName).delete(key)),
    idbGetAllByIndex: vi.fn(async (storeName: string, indexName: string, query: string) =>
      [...ensureStore(storeName).values()].filter((value) => {
        const record = value as Record<string, unknown>
        return record[indexName] === query
      }),
    ),
    idbPutMany: vi.fn(async (storeName: string, values: unknown[]) => {
      for (const value of values) {
        const key = keyForStoreRecord(storeName, value)
        if (!key) {
          return false
        }

        ensureStore(storeName).set(key, value)
      }

      return true
    }),
    idbDeleteMany: vi.fn(async (storeName: string, keys: string[]) => {
      const store = ensureStore(storeName)
      keys.forEach((key) => store.delete(key))
      return true
    }),
    idbReplaceAllByIndex: vi.fn(async (storeName: string, indexName: string, query: string, values: unknown[]) => {
      const store = ensureStore(storeName)
      for (const [existingKey, existingValue] of [...store.entries()]) {
        const record = existingValue as Record<string, unknown>
        if (record[indexName] === query) {
          store.delete(existingKey)
        }
      }

      for (const value of values) {
        const key = keyForStoreRecord(storeName, value)
        if (!key) {
          return false
        }

        store.set(key, value)
      }

      return true
    }),
  }))

  return { idbDataByStore }
}

describe('Cashier offline maintenance integration', () => {
  test('launcher ops summary restores cashier context after cold reload and reports local counts', async () => {
    vi.resetModules()
    installIndexedDbMock()

    const cashier = createUser('cashier', { id: 'cashier-ops-1', building_id: 1 })
    const partition = {
      terminal_id: 'terminal-ops-1',
      user_id: cashier.id,
      role: 'cashier' as const,
    }

    const {
      CASHIER_OFFLINE_STORES,
      idbPut,
      idbPutMany,
    } = await import('@/services/cashierOfflineDb')
    const {
      initializeCashierStoragePartition,
      resetCashierStoragePartitionContext,
      saveOfflineQueueForActivePartition,
      upsertOfflineGrantForPartition,
      upsertSnapshotMeta,
      upsertTerminalMetaForPartition,
    } = await import('@/services/cashierOfflineStorage')
    const { loadCashierOfflineOpsSummaryForUser } = await import('@/services/cashierOfflineOps')
    const { pushCashierEvent } = await import('@/utils/cashierSession')

    await initializeCashierStoragePartition(partition)
    await upsertTerminalMetaForPartition(partition, {
      building_id: 1,
      display_name: 'Cashier terminal',
      provisioned_at: '2026-04-16T09:00:00.000Z',
      last_seen_at: '2026-04-16T09:30:00.000Z',
    })
    await upsertOfflineGrantForPartition(partition, {
      grant: {
        grant_token: 'grant-token',
        grant_id: 'grant-1',
        jti: 'grant-jti-1',
        role: 'cashier',
        terminal_id: partition.terminal_id,
        terminal_display_name: 'Cashier terminal',
        building_id: 1,
        building_name: 'Building 1',
        issued_at: '2026-04-16T09:00:00.000Z',
        expires_at: '2026-04-16T13:00:00.000Z',
        algorithm: 'RS256',
        key_id: 'offline-key-v1',
        issuer: 'foodcontrol',
        audience: 'cashier-offline',
        public_key: '-----BEGIN PUBLIC KEY-----\\nZmFrZQ==\\n-----END PUBLIC KEY-----',
      },
      claims: {
        iss: 'foodcontrol',
        aud: 'cashier-offline',
        sub: cashier.id,
        jti: 'grant-jti-1',
        role: 'cashier',
        building_id: 1,
        terminal_id: partition.terminal_id,
        iat: 1,
        nbf: 1,
        exp: 9999999999,
        typ: 'cashier_offline_grant',
      },
      validated_at: '2026-04-16T09:00:00.000Z',
    })
    await upsertSnapshotMeta(partition, {
      snapshot_version: 'snapshot-v1',
      generated_at: new Date().toISOString(),
      freshness_ts: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    await idbPutMany(CASHIER_OFFLINE_STORES.snapshot_students, [
      {
        snapshot_student_id: `${partition.terminal_id}:${partition.user_id}:student-1`,
        partition_key: `${partition.terminal_id}:${partition.user_id}`,
        terminal_id: partition.terminal_id,
        user_id: partition.user_id,
        role: 'cashier',
        student_id: 'student-1',
        full_name: 'Test Student',
        full_name_lower: 'test student',
        student_card: '100001',
        student_card_lower: '100001',
        group_name: 'A-01',
        building_id: 1,
        meal_building_id: 1,
        allow_all_meal_buildings: false,
        effective_meal_building_id: 1,
        category_id: 1,
        is_active: true,
        updated_at: '2026-04-16T09:00:00.000Z',
      },
    ])
    await idbPutMany(CASHIER_OFFLINE_STORES.snapshot_tickets, [
      {
        snapshot_ticket_id: `${partition.terminal_id}:${partition.user_id}:ticket-1`,
        partition_key: `${partition.terminal_id}:${partition.user_id}`,
        terminal_id: partition.terminal_id,
        user_id: partition.user_id,
        role: 'cashier',
        ticket_id: 'ticket-1',
        ticket_id_lower: 'ticket-1',
        student_id: 'student-1',
        category_id: 1,
        status: 'active',
        qr_code: 'QR-001',
        qr_code_lower: 'qr-001',
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-16T09:00:00.000Z',
      },
    ])
    await idbPutMany(CASHIER_OFFLINE_STORES.snapshot_categories, [
      {
        snapshot_category_id: `${partition.terminal_id}:${partition.user_id}:1`,
        partition_key: `${partition.terminal_id}:${partition.user_id}`,
        terminal_id: partition.terminal_id,
        user_id: partition.user_id,
        role: 'cashier',
        category_id: 1,
        value: { id: 1, name: 'Budget', meal_types: ['breakfast'] },
        updated_at: '2026-04-16T09:00:00.000Z',
      },
    ])
    saveOfflineQueueForActivePartition([
      {
        request_id: 'pending-1',
        code: 'QR-001',
        selected_meals: ['breakfast'],
        created_at: '2026-04-16T10:00:00.000Z',
        student_name: 'Test Student',
        group_name: 'A-01',
      },
    ])
    pushCashierEvent('terminal opened', 'info')
    await idbPut(CASHIER_OFFLINE_STORES.sync_state, {
      sync_state_id: `${partition.terminal_id}:${partition.user_id}:review-1`,
      partition_key: `${partition.terminal_id}:${partition.user_id}`,
      terminal_id: partition.terminal_id,
      user_id: partition.user_id,
      role: 'cashier',
      request_id: 'review-1',
      status: 'needs_review',
      payload: {
        request_id: 'review-1',
        code: 'QR-002',
        selected_meals: ['breakfast'],
        created_at: '2026-04-16T10:05:00.000Z',
        student_name: 'Review Student',
        group_name: 'A-02',
      },
      attempt_count: 1,
      last_attempt_at: '2026-04-16T10:06:00.000Z',
      next_retry_at: null,
      last_error: 'needs review',
      server_status: 409,
      review_reason: 'needs review',
      updated_at: '2026-04-16T10:07:00.000Z',
    })

    resetCashierStoragePartitionContext()

    const summary = await loadCashierOfflineOpsSummaryForUser(cashier.id)

    expect(summary.queue_count).toBe(1)
    expect(summary.event_count).toBe(1)
    expect(summary.needs_review_count).toBe(1)
    expect(summary.snapshot_state).toBe('ready')
  })

  test('launcher warm-up refreshes missing snapshot without requiring terminal entry', async () => {
    vi.resetModules()
    installIndexedDbMock()
    const nowIso = new Date().toISOString()

    const fetchCashierOfflineSnapshot = vi.fn().mockResolvedValue({
      generated_at: nowIso,
      snapshot_version: 'snapshot-v2',
      service_date: '2026-04-16',
      building_id: 1,
      datasets: {
        students: [
          {
            id: 'student-1',
            full_name: 'Test Student',
            student_card: '100001',
            group_name: 'A-01',
            building_id: 1,
            meal_building_id: 1,
            allow_all_meal_buildings: false,
            effective_meal_building_id: 1,
            category_id: 1,
            is_active: true,
          },
        ],
        tickets: [
          {
            id: 'ticket-1',
            student_id: 'student-1',
            category_id: 1,
            status: 'active',
            qr_code: 'QR-001',
            start_date: '2026-04-01',
            end_date: '2026-04-30',
            created_at: '2026-04-01T00:00:00.000Z',
          },
        ],
        categories: [
          {
            id: 1,
            name: 'Budget',
            code: 'BUDGET',
            breakfast: true,
            lunch: false,
            meal_types: ['breakfast'],
          },
        ],
        holidays: [],
        configured_holidays: [],
        lookup_restrictions: [],
      },
      rules: {
        supported_meal_types: ['breakfast', 'lunch'],
        serving_today: true,
        serving_block_reason: null,
      },
    })

    vi.doMock('@/services/api', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/services/api')>()
      return {
        ...actual,
        fetchCashierOfflineSnapshot,
      }
    })
    vi.doMock('@/services/cashierOfflineGrant', () => ({
      ensureCashierOfflineGrantBootstrap: vi.fn(async () => undefined),
    }))

    const cashier = createUser('cashier', { id: 'cashier-ops-3', building_id: 1 })
    const partition = {
      terminal_id: 'terminal-ops-3',
      user_id: cashier.id,
      role: 'cashier' as const,
    }

    const {
      initializeCashierStoragePartition,
      upsertOfflineGrantForPartition,
      upsertSnapshotMeta,
      upsertTerminalMetaForPartition,
    } = await import('@/services/cashierOfflineStorage')
    const {
      loadCashierOfflineOpsSummaryForUser,
      warmCashierOfflineOpsForSession,
    } = await import('@/services/cashierOfflineOps')

    await initializeCashierStoragePartition(partition)
    await upsertTerminalMetaForPartition(partition, {
      building_id: 1,
      display_name: 'Cashier terminal',
      provisioned_at: '2026-04-16T09:00:00.000Z',
      last_seen_at: '2026-04-16T09:30:00.000Z',
    })
    await upsertOfflineGrantForPartition(partition, {
      grant: {
        grant_token: 'grant-token',
        grant_id: 'grant-1',
        jti: 'grant-jti-1',
        role: 'cashier',
        terminal_id: partition.terminal_id,
        terminal_display_name: 'Cashier terminal',
        building_id: 1,
        building_name: 'Building 1',
        issued_at: '2026-04-16T09:00:00.000Z',
        expires_at: '2026-04-16T13:00:00.000Z',
        algorithm: 'RS256',
        key_id: 'offline-key-v1',
        issuer: 'foodcontrol',
        audience: 'cashier-offline',
        public_key: '-----BEGIN PUBLIC KEY-----\\nZmFrZQ==\\n-----END PUBLIC KEY-----',
      },
      claims: {
        iss: 'foodcontrol',
        aud: 'cashier-offline',
        sub: cashier.id,
        jti: 'grant-jti-1',
        role: 'cashier',
        building_id: 1,
        terminal_id: partition.terminal_id,
        iat: 1,
        nbf: 1,
        exp: 9999999999,
        typ: 'cashier_offline_grant',
      },
      validated_at: '2026-04-16T09:00:00.000Z',
    })
    await upsertSnapshotMeta(partition, {
      snapshot_version: 'grant_bootstrap_v1',
      generated_at: '2026-04-16T09:00:00.000Z',
      freshness_ts: '2026-04-16T09:00:00.000Z',
      updated_at: '2026-04-16T09:00:00.000Z',
    })

    let summary = await loadCashierOfflineOpsSummaryForUser(cashier.id)
    expect(summary.snapshot_state).toBe('missing')

    await warmCashierOfflineOpsForSession({
      token: 'cashier-token',
      user: cashier,
    })

    summary = await loadCashierOfflineOpsSummaryForUser(cashier.id)

    expect(fetchCashierOfflineSnapshot).toHaveBeenCalledTimes(1)
    expect(summary.snapshot_state).toBe('ready')
  })

  test('maintenance prunes resolved queue items, deletes expired sync states, and clears stale partitions', async () => {
    vi.resetModules()
    const { idbDataByStore } = installIndexedDbMock()

    const cashier = createUser('cashier', { id: 'cashier-ops-2', building_id: 1 })
    const activePartition = {
      terminal_id: 'terminal-active',
      user_id: cashier.id,
      role: 'cashier' as const,
    }
    const stalePartition = {
      terminal_id: 'terminal-stale',
      user_id: cashier.id,
      role: 'cashier' as const,
    }

    const {
      CASHIER_OFFLINE_STORES,
      idbPut,
    } = await import('@/services/cashierOfflineDb')
    const {
      initializeCashierStoragePartition,
      loadOfflineQueueForActivePartitionSync,
      saveOfflineQueueForActivePartition,
      upsertTerminalMetaForPartition,
    } = await import('@/services/cashierOfflineStorage')
    const { runCashierOfflineMaintenance } = await import('@/services/cashierOfflineMaintenance')

    await initializeCashierStoragePartition(activePartition)
    await upsertTerminalMetaForPartition(activePartition, {
      building_id: 1,
      display_name: 'Active terminal',
      provisioned_at: '2026-04-16T09:00:00.000Z',
      last_seen_at: '2026-04-16T09:30:00.000Z',
    })
    await upsertTerminalMetaForPartition(stalePartition, {
      building_id: 1,
      display_name: 'Stale terminal',
      provisioned_at: '2026-03-01T09:00:00.000Z',
      last_seen_at: '2026-03-01T09:30:00.000Z',
    })
    saveOfflineQueueForActivePartition([
      {
        request_id: 'acked-1',
        code: 'QR-ACK',
        selected_meals: ['breakfast'],
        created_at: '2026-04-16T10:00:00.000Z',
        student_name: 'Ack Student',
        group_name: 'A-01',
      },
      {
        request_id: 'pending-1',
        code: 'QR-PENDING',
        selected_meals: ['breakfast'],
        created_at: '2026-04-16T10:01:00.000Z',
        student_name: 'Pending Student',
        group_name: 'A-02',
      },
    ])
    await idbPut(CASHIER_OFFLINE_STORES.sync_state, {
      sync_state_id: `${activePartition.terminal_id}:${activePartition.user_id}:acked-1`,
      partition_key: `${activePartition.terminal_id}:${activePartition.user_id}`,
      terminal_id: activePartition.terminal_id,
      user_id: activePartition.user_id,
      role: 'cashier',
      request_id: 'acked-1',
      status: 'acked',
      payload: null,
      attempt_count: 1,
      last_attempt_at: '2026-04-01T10:00:00.000Z',
      next_retry_at: null,
      last_error: null,
      server_status: 201,
      review_reason: null,
      updated_at: '2026-04-01T10:00:00.000Z',
    })
    await idbPut(CASHIER_OFFLINE_STORES.sync_state, {
      sync_state_id: `${activePartition.terminal_id}:${activePartition.user_id}:pending-1`,
      partition_key: `${activePartition.terminal_id}:${activePartition.user_id}`,
      terminal_id: activePartition.terminal_id,
      user_id: activePartition.user_id,
      role: 'cashier',
      request_id: 'pending-1',
      status: 'pending',
      payload: {
        request_id: 'pending-1',
        code: 'QR-PENDING',
        selected_meals: ['breakfast'],
        created_at: '2026-04-16T10:01:00.000Z',
        student_name: 'Pending Student',
        group_name: 'A-02',
      },
      attempt_count: 1,
      last_attempt_at: '2026-04-16T10:02:00.000Z',
      next_retry_at: null,
      last_error: null,
      server_status: null,
      review_reason: null,
      updated_at: '2026-04-16T10:02:00.000Z',
    })

    const report = await runCashierOfflineMaintenance({ userId: cashier.id })

    expect(report.resolved_queue_items_removed).toBe(1)
    expect(report.expired_sync_states_deleted).toBe(1)
    expect(report.stale_partitions_deleted).toBe(1)
    expect(loadOfflineQueueForActivePartitionSync().map((item) => item.request_id)).toEqual(['pending-1'])
    expect(idbDataByStore.get('terminal_meta')?.has(`${stalePartition.terminal_id}:${stalePartition.user_id}`)).toBe(false)
  })
})
