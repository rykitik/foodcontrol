import { createSign, generateKeyPairSync } from 'node:crypto'

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createUser } from './helpers/fixtures'

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function buildSignedGrantToken(params: {
  userId: string
  terminalId: string
  audience: string
  issuer: string
  keyId: string
  notBeforeOffsetSeconds?: number
}): { token: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const issuedAt = Math.floor(Date.now() / 1000)
  const notBeforeOffsetSeconds = params.notBeforeOffsetSeconds ?? 0

  const header = {
    alg: 'RS256',
    kid: params.keyId,
    typ: 'JWT',
  }
  const payload = {
    iss: params.issuer,
    aud: params.audience,
    sub: params.userId,
    jti: 'grant-jti-1',
    role: 'cashier',
    building_id: 1,
    terminal_id: params.terminalId,
    iat: issuedAt,
    nbf: issuedAt + notBeforeOffsetSeconds,
    exp: issuedAt + 3600,
    typ: 'cashier_offline_grant',
  }

  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  signer.end()

  const signature = signer.sign(privateKey).toString('base64url')
  const token = `${signingInput}.${signature}`
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

  return { token, publicKeyPem }
}

describe('Cashier offline grant persistence integration', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  test('local validation accepts reasonable cashier grant clock skew', async () => {
    const user = createUser('cashier', { id: 'cashier-skew-1', building_id: 1 })
    const terminalId = 'terminal-skew-1'
    const audience = 'cashier-offline'
    const issuer = 'foodcontrol'
    const keyId = 'offline-key-skew'

    const signedGrant = buildSignedGrantToken({
      userId: user.id,
      terminalId,
      audience,
      issuer,
      keyId,
      notBeforeOffsetSeconds: 240,
    })

    const { validateCashierOfflineGrantLocally } = await import('@/services/cashierOfflineGrant')

    const validation = await validateCashierOfflineGrantLocally(
      {
        grant_token: signedGrant.token,
        grant_id: 'grant-skew-1',
        jti: 'grant-jti-skew-1',
        role: 'cashier',
        terminal_id: terminalId,
        terminal_display_name: 'Cashier terminal skew',
        building_id: 1,
        building_name: 'Building 1',
        issued_at: '2026-04-16T12:00:00.000Z',
        expires_at: '2026-04-16T13:00:00.000Z',
        algorithm: 'RS256',
        key_id: keyId,
        issuer,
        audience,
        public_key: signedGrant.publicKeyPem,
      },
      {
        expectedTerminalId: terminalId,
        expectedUserId: user.id,
        expectedRole: 'cashier',
      },
    )

    expect(validation.valid).toBe(true)
    expect(validation.reason).toBeUndefined()
  }, 10000)

  test('bootstrap persists terminal_meta and offline_grant in IndexedDB after transient write failure', async () => {
    const idbDataByStore = new Map<string, Map<string, unknown>>()
    const firstWriteFailed = new Set<string>()

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
        if ((storeName === 'terminal_meta' || storeName === 'offline_grant') && !firstWriteFailed.has(storeName)) {
          firstWriteFailed.add(storeName)
          return false
        }

        const key = keyForStoreRecord(storeName, value)
        if (!key) {
          return false
        }

        ensureStore(storeName).set(key, value)
        return true
      }),
      idbDelete: vi.fn(async (storeName: string, key: string) => ensureStore(storeName).delete(key)),
      idbGetAllByIndex: vi.fn(async () => []),
      idbPutMany: vi.fn(async () => true),
      idbDeleteMany: vi.fn(async () => true),
      idbReplaceAllByIndex: vi.fn(async () => true),
    }))

    const user = createUser('cashier', { id: 'cashier-1', building_id: 1 })
    const terminalId = 'terminal-1'
    const audience = 'foodcontrol.cashier'
    const issuer = 'foodcontrol'
    const keyId = 'offline-key-v1'

    const signedGrant = buildSignedGrantToken({
      userId: user.id,
      terminalId,
      audience,
      issuer,
      keyId,
    })

    const provisionCashierTerminal = vi.fn().mockResolvedValue({
      terminal: {
        id: terminalId,
        building_id: 1,
        display_name: 'Cashier terminal #1',
        status: 'active',
        provisioning_expires_at: '2026-04-16T12:00:00.000Z',
        last_seen_at: '2026-04-16T12:00:00.000Z',
        created_at: '2026-04-16T12:00:00.000Z',
        updated_at: '2026-04-16T12:00:00.000Z',
      },
      terminal_id: terminalId,
      provisioning_code: null,
      new_terminal: false,
    })
    const issueCashierOfflineGrant = vi.fn().mockResolvedValue({
      grant_token: signedGrant.token,
      grant_id: 'grant-1',
      jti: 'grant-jti-1',
      role: 'cashier',
      terminal_id: terminalId,
      terminal_display_name: 'Cashier terminal #1',
      building_id: 1,
      building_name: 'Building 1',
      issued_at: '2026-04-16T12:00:00.000Z',
      expires_at: '2026-04-16T13:00:00.000Z',
      algorithm: 'RS256',
      key_id: keyId,
      issuer,
      audience,
      public_key: signedGrant.publicKeyPem,
    })

    vi.doMock('@/services/api', () => ({
      provisionCashierTerminal,
      issueCashierOfflineGrant,
    }))

    const { ensureCashierOfflineGrantBootstrap, readStoredCashierOfflineGrant } = await import('@/services/cashierOfflineGrant')
    const { getActiveCashierStoragePartition, readTerminalMetaForActivePartitionSync } = await import(
      '@/services/cashierOfflineStorage'
    )

    await ensureCashierOfflineGrantBootstrap({
      token: 'cashier-access-token',
      user,
    })

    expect(provisionCashierTerminal).toHaveBeenCalledTimes(1)
    expect(issueCashierOfflineGrant).toHaveBeenCalledTimes(1)

    expect(getActiveCashierStoragePartition()).toEqual({
      terminal_id: terminalId,
      user_id: user.id,
      role: 'cashier',
    })

    expect(readTerminalMetaForActivePartitionSync()).not.toBeNull()
    expect(readStoredCashierOfflineGrant(user)).not.toBeNull()

    const terminalMetaStore = idbDataByStore.get('terminal_meta')
    const offlineGrantStore = idbDataByStore.get('offline_grant')
    expect(terminalMetaStore?.size).toBe(1)
    expect(offlineGrantStore?.size).toBe(1)
  })

  test('bootstrap still persists offline_grant when immediate local validation is deferred by token nbf skew', async () => {
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
      idbGetAllByIndex: vi.fn(async () => []),
      idbPutMany: vi.fn(async () => true),
      idbDeleteMany: vi.fn(async () => true),
      idbReplaceAllByIndex: vi.fn(async () => true),
    }))

    const user = createUser('cashier', { id: 'cashier-2', building_id: 1 })
    const terminalId = 'terminal-2'
    const audience = 'foodcontrol.cashier'
    const issuer = 'foodcontrol'
    const keyId = 'offline-key-v1'

    const signedGrant = buildSignedGrantToken({
      userId: user.id,
      terminalId,
      audience,
      issuer,
      keyId,
      notBeforeOffsetSeconds: 90,
    })

    vi.doMock('@/services/api', () => ({
      provisionCashierTerminal: vi.fn().mockResolvedValue({
        terminal: {
          id: terminalId,
          building_id: 1,
          display_name: 'Cashier terminal #2',
          status: 'active',
          provisioning_expires_at: '2026-04-16T12:00:00.000Z',
          last_seen_at: '2026-04-16T12:00:00.000Z',
          created_at: '2026-04-16T12:00:00.000Z',
          updated_at: '2026-04-16T12:00:00.000Z',
        },
        terminal_id: terminalId,
        provisioning_code: null,
        new_terminal: false,
      }),
      issueCashierOfflineGrant: vi.fn().mockResolvedValue({
        grant_token: signedGrant.token,
        grant_id: 'grant-2',
        jti: 'grant-jti-2',
        role: 'cashier',
        terminal_id: terminalId,
        terminal_display_name: 'Cashier terminal #2',
        building_id: 1,
        building_name: 'Building 1',
        issued_at: '2026-04-16T12:00:00.000Z',
        expires_at: '2026-04-16T13:00:00.000Z',
        algorithm: 'RS256',
        key_id: keyId,
        issuer,
        audience,
        public_key: signedGrant.publicKeyPem,
      }),
    }))

    const { ensureCashierOfflineGrantBootstrap, readStoredCashierOfflineGrant } = await import('@/services/cashierOfflineGrant')

    await ensureCashierOfflineGrantBootstrap({
      token: 'cashier-access-token',
      user,
    })

    expect(readStoredCashierOfflineGrant(user)).not.toBeNull()
    expect(idbDataByStore.get('offline_grant')?.size).toBe(1)
  })

  test('bootstrap reuses the IndexedDB terminal partition after login clears legacy localStorage fallback', async () => {
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

    const user = createUser('cashier', { id: 'cashier-reuse-1', building_id: 1 })
    const existingTerminalId = 'terminal-existing'
    const nextTerminalId = 'terminal-new'
    const audience = 'foodcontrol.cashier'
    const issuer = 'foodcontrol'
    const keyId = 'offline-key-v1'

    const existingGrant = buildSignedGrantToken({
      userId: user.id,
      terminalId: existingTerminalId,
      audience,
      issuer,
      keyId,
    })
    const refreshedGrant = buildSignedGrantToken({
      userId: user.id,
      terminalId: existingTerminalId,
      audience,
      issuer,
      keyId,
    })
    const newTerminalGrant = buildSignedGrantToken({
      userId: user.id,
      terminalId: nextTerminalId,
      audience,
      issuer,
      keyId,
    })

    const provisionCashierTerminal = vi.fn().mockImplementation(async (request: { terminal_id?: string }) => {
      const resolvedTerminalId = request.terminal_id || nextTerminalId
      return {
        terminal: {
          id: resolvedTerminalId,
          building_id: 1,
          display_name: `Cashier terminal ${resolvedTerminalId}`,
          status: 'active',
          provisioning_expires_at: '2026-04-16T12:00:00.000Z',
          last_seen_at: '2026-04-16T12:00:00.000Z',
          created_at: '2026-04-16T12:00:00.000Z',
          updated_at: '2026-04-16T12:00:00.000Z',
        },
        terminal_id: resolvedTerminalId,
        provisioning_code: null,
        new_terminal: resolvedTerminalId !== existingTerminalId,
      }
    })
    const issueCashierOfflineGrant = vi.fn().mockImplementation(async ({ terminal_id }: { terminal_id: string }) => ({
      grant_token: terminal_id === existingTerminalId ? refreshedGrant.token : newTerminalGrant.token,
      grant_id: terminal_id === existingTerminalId ? 'grant-existing-refreshed' : 'grant-new-terminal',
      jti: terminal_id === existingTerminalId ? 'grant-jti-existing-refreshed' : 'grant-jti-new-terminal',
      role: 'cashier',
      terminal_id,
      terminal_display_name: `Cashier terminal ${terminal_id}`,
      building_id: 1,
      building_name: 'Building 1',
      issued_at: '2026-04-16T12:00:00.000Z',
      expires_at: '2026-04-16T13:00:00.000Z',
      algorithm: 'RS256',
      key_id: keyId,
      issuer,
      audience,
      public_key: terminal_id === existingTerminalId ? refreshedGrant.publicKeyPem : newTerminalGrant.publicKeyPem,
    }))

    vi.doMock('@/services/api', () => ({
      provisionCashierTerminal,
      issueCashierOfflineGrant,
    }))

    const {
      getLegacyStorageKeysForMigration,
      initializeCashierStoragePartition,
      resetCashierStoragePartitionContext,
      upsertOfflineGrantForPartition,
      upsertTerminalMetaForPartition,
    } = await import('@/services/cashierOfflineStorage')
    const { ensureCashierOfflineGrantBootstrap } = await import('@/services/cashierOfflineGrant')
    const { getActiveCashierStoragePartition, readOfflineGrantForPartition } = await import('@/services/cashierOfflineStorage')

    const partition = {
      terminal_id: existingTerminalId,
      user_id: user.id,
      role: 'cashier' as const,
    }

    await initializeCashierStoragePartition(partition)
    await upsertTerminalMetaForPartition(partition, {
      building_id: 1,
      display_name: 'Cashier terminal existing',
      provisioned_at: '2026-04-16T09:00:00.000Z',
      last_seen_at: '2026-04-16T09:30:00.000Z',
    })
    await upsertOfflineGrantForPartition(partition, {
      grant: {
        grant_token: existingGrant.token,
        grant_id: 'grant-existing',
        jti: 'grant-jti-existing',
        role: 'cashier',
        terminal_id: existingTerminalId,
        terminal_display_name: 'Cashier terminal existing',
        building_id: 1,
        building_name: 'Building 1',
        issued_at: '2026-04-16T09:00:00.000Z',
        expires_at: '2026-04-16T13:00:00.000Z',
        algorithm: 'RS256',
        key_id: keyId,
        issuer,
        audience,
        public_key: existingGrant.publicKeyPem,
      },
      claims: {
        iss: issuer,
        aud: audience,
        sub: user.id,
        jti: 'grant-jti-existing',
        role: 'cashier',
        building_id: 1,
        terminal_id: existingTerminalId,
        iat: 1,
        nbf: 1,
        exp: 9999999999,
        typ: 'cashier_offline_grant',
      },
      validated_at: '2026-04-16T09:05:00.000Z',
    })

    const legacyKeys = getLegacyStorageKeysForMigration()
    localStorage.removeItem(legacyKeys.queue)
    localStorage.removeItem(legacyKeys.terminal)
    localStorage.removeItem(legacyKeys.grant)
    resetCashierStoragePartitionContext()

    await ensureCashierOfflineGrantBootstrap({
      token: 'cashier-access-token',
      user,
    })

    expect(provisionCashierTerminal).toHaveBeenCalledTimes(1)
    expect(provisionCashierTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: expect.any(String),
        terminal_id: existingTerminalId,
      }),
      'cashier-access-token',
    )
    expect(issueCashierOfflineGrant).toHaveBeenCalledWith({ terminal_id: existingTerminalId }, 'cashier-access-token')
    expect(getActiveCashierStoragePartition()).toEqual(partition)
    expect(idbDataByStore.get('terminal_meta')?.size).toBe(1)
    expect(idbDataByStore.get('offline_grant')?.size).toBe(1)

    const storedGrant = await readOfflineGrantForPartition(partition)
    expect(storedGrant?.grant.terminal_id).toBe(existingTerminalId)
  })
})
