import { describe, expect, test, vi } from 'vitest'

import { createUser } from './helpers/fixtures'

function createStorageMocks() {
  return {
    findLatestCashierTerminalMetaForUser: vi.fn(),
    initializeCashierStoragePartition: vi.fn().mockResolvedValue(undefined),
    loadOfflineQueueForActivePartitionSync: vi.fn(() => []),
    readOfflineGrantForPartition: vi.fn(),
    readReadinessMeta: vi.fn(),
    readSnapshotMeta: vi.fn(),
    restoreCashierStoragePartitionForUser: vi.fn().mockResolvedValue(null),
  }
}

async function loadStartupOrchestrator(dependencies: {
  getProfile?: ReturnType<typeof vi.fn>
  validateCashierOfflineGrantLocally?: ReturnType<typeof vi.fn>
  isCashierOfflineDbAvailable?: ReturnType<typeof vi.fn>
  readCashierOfflineSnapshotDatasetHealth?: ReturnType<typeof vi.fn>
  storage?: ReturnType<typeof createStorageMocks>
}) {
  const storage = dependencies.storage ?? createStorageMocks()

  vi.doMock('@/services/api', () => ({
    getProfile: dependencies.getProfile ?? vi.fn(),
  }))
  vi.doMock('@/services/cashierOfflineContext', () => ({
    getCashierOfflineContextVersion: vi.fn(() => 0),
  }))
  vi.doMock('@/services/cashierOfflineDb', () => ({
    CASHIER_OFFLINE_DB_VERSION: 4,
    isCashierOfflineDbAvailable: dependencies.isCashierOfflineDbAvailable ?? vi.fn(() => true),
  }))
  vi.doMock('@/services/cashierOfflineGrant', () => ({
    validateCashierOfflineGrantLocally:
      dependencies.validateCashierOfflineGrantLocally ?? vi.fn().mockResolvedValue({ valid: true, claims: {} }),
  }))
  vi.doMock('@/services/cashierOfflineSnapshot', () => ({
    readCashierOfflineSnapshotDatasetHealth:
      dependencies.readCashierOfflineSnapshotDatasetHealth ??
      vi.fn().mockResolvedValue({
        ready: true,
        students_count: 1,
        tickets_count: 1,
        categories_count: 1,
      }),
  }))
  vi.doMock('@/services/cashierOfflineStorage', () => storage)

  const module = await import('@/services/cashierStartupOrchestrator')
  return { ...module, storage }
}

describe('Cashier startup integration', () => {
  test('treats only cashier terminal entry as a startup-gated route', async () => {
    const { isCashierStartupRoutePath } = await loadStartupOrchestrator({})

    expect(isCashierStartupRoutePath('/cashier')).toBe(false)
    expect(isCashierStartupRoutePath('/cashier/summary')).toBe(false)
    expect(isCashierStartupRoutePath('/cashier/journal')).toBe(false)
    expect(isCashierStartupRoutePath('/cashier/terminal')).toBe(true)
  })

  test('returns online_ready when cashier is online but terminal binding is still missing', async () => {
    const getProfile = vi.fn().mockResolvedValue(createUser('cashier', { id: 'cashier-1' }))
    const storage = createStorageMocks()
    storage.findLatestCashierTerminalMetaForUser.mockResolvedValue(null)

    const { runCashierStartupOrchestrator } = await loadStartupOrchestrator({
      getProfile,
      storage,
    })

    const assessment = await runCashierStartupOrchestrator({
      token: 'cashier-token',
      user: createUser('cashier', { id: 'cashier-1' }),
      force: true,
    })

    expect(assessment.state).toBe('online_ready')
    expect(assessment.reason).toBeUndefined()
    expect(assessment.checks.terminal_binding.status).toBe('fail')
    expect(assessment.checks.online_probe.status).toBe('pass')
  })

  test('returns offline_ready for cashier when local grant and snapshot are valid and the network is unavailable', async () => {
    const getProfile = vi.fn().mockRejectedValue(new TypeError('Network request failed'))
    const validateCashierOfflineGrantLocally = vi.fn().mockResolvedValue({ valid: true, claims: {} })
    const storage = createStorageMocks()
    storage.findLatestCashierTerminalMetaForUser.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      building_id: 1,
      display_name: 'Cashier terminal',
      provisioned_at: '2026-04-16T09:00:00.000Z',
      last_seen_at: '2026-04-16T09:30:00.000Z',
    })
    storage.readReadinessMeta.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      schema_version: 4,
      legacy_migrated: true,
      legacy_migrated_at: '2026-04-16T09:30:00.000Z',
      updated_at: '2026-04-16T09:30:00.000Z',
    })
    storage.readOfflineGrantForPartition.mockResolvedValue({
      grant: { grant_token: 'token' },
      claims: { sub: 'cashier-1', role: 'cashier', terminal_id: 'terminal-1' },
      validated_at: '2026-04-16T09:35:00.000Z',
    })
    storage.readSnapshotMeta.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      snapshot_version: 'snapshot-v1',
      generated_at: new Date().toISOString(),
      freshness_ts: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const { runCashierStartupOrchestrator } = await loadStartupOrchestrator({
      getProfile,
      validateCashierOfflineGrantLocally,
      storage,
    })

    const assessment = await runCashierStartupOrchestrator({
      token: 'cashier-token',
      user: createUser('cashier', { id: 'cashier-1' }),
      force: true,
    })

    expect(assessment.state).toBe('offline_ready')
    expect(assessment.reason).toBeUndefined()
    expect(assessment.checks.online_probe.status).toBe('fail')
    expect(assessment.checks.offline_grant_validity.status).toBe('pass')
    expect(assessment.checks.snapshot_freshness.status).toBe('pass')
  })

  test('reuses restored cashier storage partition so terminal can open offline from launcher', async () => {
    const getProfile = vi.fn().mockRejectedValue(new TypeError('Network request failed'))
    const storage = createStorageMocks()
    storage.restoreCashierStoragePartitionForUser.mockResolvedValue({
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
    })
    storage.readReadinessMeta.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      schema_version: 4,
      legacy_migrated: true,
      legacy_migrated_at: '2026-04-16T09:30:00.000Z',
      updated_at: '2026-04-16T09:30:00.000Z',
    })
    storage.readOfflineGrantForPartition.mockResolvedValue({
      grant: { grant_token: 'token' },
      claims: { sub: 'cashier-1', role: 'cashier', terminal_id: 'terminal-1' },
      validated_at: '2026-04-16T09:35:00.000Z',
    })
    storage.readSnapshotMeta.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      snapshot_version: 'snapshot-v1',
      generated_at: new Date().toISOString(),
      freshness_ts: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const { runCashierStartupOrchestrator } = await loadStartupOrchestrator({
      getProfile,
      storage,
    })

    const assessment = await runCashierStartupOrchestrator({
      token: 'cashier-token',
      user: createUser('cashier', { id: 'cashier-1' }),
      force: true,
    })

    expect(assessment.state).toBe('offline_ready')
    expect(assessment.reason).toBeUndefined()
    expect(assessment.checks.terminal_binding.status).toBe('pass')
    expect(assessment.checks.terminal_binding.details).toBe('restored_active_partition')
    expect(storage.restoreCashierStoragePartitionForUser).toHaveBeenCalledWith('cashier-1')
    expect(storage.findLatestCashierTerminalMetaForUser).not.toHaveBeenCalled()
    expect(storage.initializeCashierStoragePartition).not.toHaveBeenCalled()
  })

  test('returns offline_unavailable when local grant validation fails with terminal mismatch', async () => {
    const getProfile = vi.fn().mockRejectedValue(new TypeError('Network request failed'))
    const validateCashierOfflineGrantLocally = vi.fn().mockResolvedValue({
      valid: false,
      reason: 'terminal_mismatch',
    })
    const storage = createStorageMocks()
    storage.findLatestCashierTerminalMetaForUser.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      building_id: 1,
      display_name: 'Cashier terminal',
      provisioned_at: '2026-04-16T09:00:00.000Z',
      last_seen_at: '2026-04-16T09:30:00.000Z',
    })
    storage.readReadinessMeta.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      schema_version: 4,
      legacy_migrated: true,
      legacy_migrated_at: '2026-04-16T09:30:00.000Z',
      updated_at: '2026-04-16T09:30:00.000Z',
    })
    storage.readOfflineGrantForPartition.mockResolvedValue({
      grant: { grant_token: 'token' },
      claims: { sub: 'cashier-1', role: 'cashier', terminal_id: 'terminal-1' },
      validated_at: '2026-04-16T09:35:00.000Z',
    })
    storage.readSnapshotMeta.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      snapshot_version: 'snapshot-v1',
      generated_at: new Date().toISOString(),
      freshness_ts: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const { runCashierStartupOrchestrator } = await loadStartupOrchestrator({
      getProfile,
      validateCashierOfflineGrantLocally,
      storage,
    })

    const assessment = await runCashierStartupOrchestrator({
      token: 'cashier-token',
      user: createUser('cashier', { id: 'cashier-1' }),
      force: true,
    })

    expect(assessment.state).toBe('offline_unavailable')
    expect(assessment.reason).toBe('offline_grant_invalid')
    expect(assessment.checks.offline_grant_validity.status).toBe('fail')
    expect(assessment.checks.offline_grant_validity.details).toBe('terminal_mismatch')
  })

  test('returns offline_unavailable when snapshot metadata exists but required dataset is incomplete', async () => {
    const getProfile = vi.fn().mockRejectedValue(new TypeError('Network request failed'))
    const storage = createStorageMocks()
    storage.findLatestCashierTerminalMetaForUser.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      building_id: 1,
      display_name: 'Cashier terminal',
      provisioned_at: '2026-04-16T09:00:00.000Z',
      last_seen_at: '2026-04-16T09:30:00.000Z',
    })
    storage.readReadinessMeta.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      schema_version: 4,
      legacy_migrated: true,
      legacy_migrated_at: '2026-04-16T09:30:00.000Z',
      updated_at: '2026-04-16T09:30:00.000Z',
    })
    storage.readOfflineGrantForPartition.mockResolvedValue({
      grant: { grant_token: 'token' },
      claims: { sub: 'cashier-1', role: 'cashier', terminal_id: 'terminal-1' },
      validated_at: '2026-04-16T09:35:00.000Z',
    })
    storage.readSnapshotMeta.mockResolvedValue({
      partition_key: 'terminal-1:cashier-1',
      terminal_id: 'terminal-1',
      user_id: 'cashier-1',
      role: 'cashier',
      snapshot_version: 'snapshot-v1',
      generated_at: new Date().toISOString(),
      freshness_ts: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const { runCashierStartupOrchestrator } = await loadStartupOrchestrator({
      getProfile,
      readCashierOfflineSnapshotDatasetHealth: vi.fn().mockResolvedValue({
        ready: false,
        students_count: 10,
        tickets_count: 0,
        categories_count: 3,
      }),
      storage,
    })

    const assessment = await runCashierStartupOrchestrator({
      token: 'cashier-token',
      user: createUser('cashier', { id: 'cashier-1' }),
      force: true,
    })

    expect(assessment.state).toBe('offline_unavailable')
    expect(assessment.reason).toBe('snapshot_missing')
    expect(assessment.checks.snapshot_freshness.status).toBe('fail')
    expect(assessment.checks.snapshot_freshness.details).toBe('students=10;tickets=0;categories=3')
  })
})
