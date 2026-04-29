import { describe, expect, test, vi } from 'vitest'

import { createUser } from './helpers/fixtures'

describe('Cashier isolation integration', () => {
  test('non-cashier users do not start cashier offline bootstrap', async () => {
    const provisionCashierTerminal = vi.fn()
    const issueCashierOfflineGrant = vi.fn()

    vi.doMock('@/services/api', () => ({
      issueCashierOfflineGrant,
      provisionCashierTerminal,
    }))

    const { ensureCashierOfflineGrantBootstrap } = await import('@/services/cashierOfflineGrant')

    await ensureCashierOfflineGrantBootstrap({
      token: 'admin-token',
      user: createUser('admin', { id: 'admin-1' }),
    })

    expect(provisionCashierTerminal).not.toHaveBeenCalled()
    expect(issueCashierOfflineGrant).not.toHaveBeenCalled()
  })

  test('role switch clears cashier-specific local context and blocks leakage to other roles', async () => {
    vi.doMock('@/services/api', () => ({
      getProfile: vi.fn(),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshSession: vi.fn(),
    }))

    const { useAuthStore } = await import('@/stores/auth')
    const {
      getActiveCashierStoragePartition,
      getLegacyStorageKeysForMigration,
      saveOfflineQueueForActivePartition,
      setActiveCashierStoragePartition,
    } = await import('@/services/cashierOfflineStorage')
    const { readCashierTerminalBinding, readStoredCashierOfflineGrant } = await import('@/services/cashierOfflineGrant')
    const { loadCashierEvents, loadCashierQueue, pushCashierEvent } = await import('@/utils/cashierSession')

    const auth = useAuthStore()
    const cashier = createUser('cashier', { id: 'cashier-1', building_id: 1 })
    const admin = createUser('admin', { id: 'admin-1', building_id: 2 })
    const storageKeys = getLegacyStorageKeysForMigration()

    auth.setSession('cashier-token', cashier)
    setActiveCashierStoragePartition({ terminal_id: 'terminal-1', user_id: cashier.id, role: 'cashier' })
    saveOfflineQueueForActivePartition([
      {
        request_id: 'request-1',
        code: 'QR-001',
        selected_meals: ['breakfast'],
        created_at: '2026-04-16T10:00:00.000Z',
        student_name: 'Test Student',
        group_name: 'A-01',
      },
    ])
    localStorage.setItem(
      storageKeys.terminal,
      JSON.stringify({
        terminal_id: 'terminal-1',
        building_id: 1,
        display_name: 'Cashier terminal',
        provisioned_at: '2026-04-16T09:00:00.000Z',
      }),
    )
    localStorage.setItem(
      storageKeys.grant,
      JSON.stringify({
        grant: { grant_token: 'token' },
        claims: { sub: cashier.id, role: 'cashier', terminal_id: 'terminal-1' },
        validated_at: '2026-04-16T09:00:00.000Z',
      }),
    )
    pushCashierEvent('offline queue ready', 'info')

    expect(getActiveCashierStoragePartition()).toEqual({
      terminal_id: 'terminal-1',
      user_id: cashier.id,
      role: 'cashier',
    })
    expect(loadCashierQueue()).toHaveLength(1)
    expect(loadCashierEvents()).toHaveLength(1)

    auth.setSession('admin-token', admin)

    expect(getActiveCashierStoragePartition()).toBeNull()
    expect(loadCashierQueue()).toEqual([])
    expect(loadCashierEvents()).toEqual([])
    expect(readCashierTerminalBinding(admin)).toBeNull()
    expect(readStoredCashierOfflineGrant(admin)).toBeNull()
    expect(localStorage.getItem(storageKeys.queue)).toBeNull()
    expect(localStorage.getItem(storageKeys.terminal)).toBeNull()
    expect(localStorage.getItem(storageKeys.grant)).toBeNull()
  })

  test('logout clears cashier-specific local context', async () => {
    vi.doMock('@/services/api', () => ({
      getProfile: vi.fn(),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshSession: vi.fn(),
    }))

    const { useAuthStore } = await import('@/stores/auth')
    const {
      getActiveCashierStoragePartition,
      getLegacyStorageKeysForMigration,
      setActiveCashierStoragePartition,
    } = await import('@/services/cashierOfflineStorage')
    const { loadCashierEvents, pushCashierEvent } = await import('@/utils/cashierSession')

    const auth = useAuthStore()
    const cashier = createUser('cashier', { id: 'cashier-1' })
    const storageKeys = getLegacyStorageKeysForMigration()

    auth.setSession('cashier-token', cashier)
    setActiveCashierStoragePartition({ terminal_id: 'terminal-1', user_id: cashier.id, role: 'cashier' })
    localStorage.setItem(storageKeys.terminal, JSON.stringify({ terminal_id: 'terminal-1' }))
    localStorage.setItem(storageKeys.grant, JSON.stringify({ claims: { sub: cashier.id } }))
    pushCashierEvent('terminal opened', 'info')

    auth.logout()

    expect(getActiveCashierStoragePartition()).toBeNull()
    expect(loadCashierEvents()).toEqual([])
    expect(localStorage.getItem(storageKeys.queue)).toBeNull()
    expect(localStorage.getItem(storageKeys.terminal)).toBeNull()
    expect(localStorage.getItem(storageKeys.grant)).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.sessionState).toBe('anonymous')
  })

  test('legacy queue fallback does not leak into another cashier partition', async () => {
    vi.resetModules()

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

    const {
      getLegacyStorageKeysForMigration,
      initializeCashierStoragePartition,
      loadOfflineQueueForActivePartitionSync,
    } = await import('@/services/cashierOfflineStorage')

    const storageKeys = getLegacyStorageKeysForMigration()
    localStorage.setItem(
      storageKeys.queue,
      JSON.stringify([
        {
          request_id: 'request-1',
          code: 'QR-001',
          selected_meals: ['breakfast'],
          created_at: '2026-04-16T10:00:00.000Z',
          student_name: 'Test Student',
          group_name: 'A-01',
        },
      ]),
    )
    localStorage.setItem(
      storageKeys.terminal,
      JSON.stringify({
        terminal_id: 'terminal-1',
        building_id: 1,
        display_name: 'Cashier terminal',
        provisioned_at: '2026-04-16T09:00:00.000Z',
      }),
    )
    localStorage.setItem(
      storageKeys.grant,
      JSON.stringify({
        grant: { grant_token: 'token' },
        claims: { sub: 'cashier-1', role: 'cashier', terminal_id: 'terminal-1' },
        validated_at: '2026-04-16T09:00:00.000Z',
      }),
    )

    await initializeCashierStoragePartition({
      terminal_id: 'terminal-1',
      user_id: 'cashier-2',
      role: 'cashier',
    })

    expect(loadOfflineQueueForActivePartitionSync()).toEqual([])
  })

  test('cold offline journal entry restores cashier partition from persisted local state', async () => {
    vi.resetModules()

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

    const cashier = createUser('cashier', { id: 'cashier-1', building_id: 1 })
    const partition = {
      terminal_id: 'terminal-1',
      user_id: cashier.id,
      role: 'cashier' as const,
    }
    const queueItem = {
      request_id: 'request-1',
      code: 'QR-001',
      selected_meals: ['breakfast'] as const,
      created_at: '2026-04-16T10:00:00.000Z',
      student_name: 'Test Student',
      group_name: 'A-01',
    }

    const {
      getActiveCashierStoragePartition,
      initializeCashierStoragePartition,
      resetCashierStoragePartitionContext,
      restoreCashierStoragePartitionForUser,
      saveOfflineQueueForActivePartition,
      upsertOfflineGrantForPartition,
      upsertTerminalMetaForPartition,
    } = await import('@/services/cashierOfflineStorage')
    const { CASHIER_OFFLINE_STORES, idbPut } = await import('@/services/cashierOfflineDb')
    const { listCashierNeedsReviewItems } = await import('@/services/cashierOfflineSync')
    const { loadCashierEvents, loadCashierQueue, pushCashierEvent } = await import('@/utils/cashierSession')

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
    saveOfflineQueueForActivePartition([queueItem])
    pushCashierEvent('offline queue ready', 'info')
    await idbPut(CASHIER_OFFLINE_STORES.sync_state, {
      sync_state_id: `${partition.terminal_id}:${partition.user_id}:${queueItem.request_id}`,
      partition_key: `${partition.terminal_id}:${partition.user_id}`,
      terminal_id: partition.terminal_id,
      user_id: partition.user_id,
      role: 'cashier',
      request_id: queueItem.request_id,
      status: 'needs_review',
      payload: queueItem,
      attempt_count: 1,
      last_attempt_at: '2026-04-16T10:02:00.000Z',
      next_retry_at: null,
      last_error: 'needs review',
      server_status: 409,
      review_reason: 'needs review',
      updated_at: '2026-04-16T10:03:00.000Z',
    })

    expect(getActiveCashierStoragePartition()).toEqual(partition)
    expect(loadCashierQueue()).toHaveLength(1)
    expect(loadCashierEvents()).toHaveLength(1)
    expect(await listCashierNeedsReviewItems()).toHaveLength(1)

    resetCashierStoragePartitionContext()

    expect(getActiveCashierStoragePartition()).toBeNull()
    expect(loadCashierQueue()).toEqual([])
    expect(loadCashierEvents()).toEqual([])
    expect(await listCashierNeedsReviewItems()).toEqual([])

    const restoredPartition = await restoreCashierStoragePartitionForUser(cashier.id)

    expect(restoredPartition).toEqual(partition)
    expect(getActiveCashierStoragePartition()).toEqual(partition)
    expect(loadCashierQueue()).toHaveLength(1)
    expect(loadCashierEvents()).toHaveLength(1)
    expect(await listCashierNeedsReviewItems()).toHaveLength(1)
  })

  test('restoring an already active cashier partition still hydrates queue data from indexeddb', async () => {
    vi.resetModules()

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

    const partition = {
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier' as const,
    }
    const queueItem = {
      request_id: 'request-1',
      code: 'QR-001',
      selected_meals: ['breakfast'] as const,
      created_at: '2026-04-16T10:00:00.000Z',
      student_name: 'Test Student',
      group_name: 'A-01',
    }

    const {
      buildCashierPartitionKey,
      loadOfflineQueueForActivePartitionSync,
      restoreCashierStoragePartitionForUser,
      setActiveCashierStoragePartition,
    } = await import('@/services/cashierOfflineStorage')
    const { CASHIER_OFFLINE_STORES, idbPut } = await import('@/services/cashierOfflineDb')

    setActiveCashierStoragePartition(partition)
    await idbPut(CASHIER_OFFLINE_STORES.offline_queue, {
      queue_item_id: `${buildCashierPartitionKey(partition.terminal_id, partition.user_id)}:${queueItem.request_id}`,
      partition_key: buildCashierPartitionKey(partition.terminal_id, partition.user_id),
      terminal_id: partition.terminal_id,
      user_id: partition.user_id,
      role: 'cashier',
      payload: queueItem,
      created_at: queueItem.created_at,
      updated_at: queueItem.created_at,
    })

    expect(loadOfflineQueueForActivePartitionSync()).toEqual([])

    const restoredPartition = await restoreCashierStoragePartitionForUser(partition.user_id)

    expect(restoredPartition).toEqual(partition)
    expect(loadOfflineQueueForActivePartitionSync()).toEqual([queueItem])
  })
})
