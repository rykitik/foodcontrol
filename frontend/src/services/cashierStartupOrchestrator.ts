import {
  CASHIER_OFFLINE_QUEUE_MAX_ITEMS,
  CASHIER_SNAPSHOT_FRESH_MS,
  CASHIER_SNAPSHOT_STALE_MAX_MS,
  CASHIER_STARTUP_CACHE_TTL_MS,
} from '@/config/runtime'
import { validateCashierOfflineGrantLocally } from '@/services/cashierOfflineGrant'
import { getCashierOfflineContextVersion } from '@/services/cashierOfflineContext'
import { CASHIER_OFFLINE_DB_VERSION, isCashierOfflineDbAvailable } from '@/services/cashierOfflineDb'
import { probeCashierServerConnection } from '@/services/cashierServerProbe'
import {
  findLatestCashierTerminalMetaForUser,
  initializeCashierStoragePartition,
  loadOfflineQueueForActivePartitionSync,
  readOfflineGrantForPartition,
  readReadinessMeta,
  readSnapshotMeta,
  restoreCashierStoragePartitionForUser,
} from '@/services/cashierOfflineStorage'
import { readCashierOfflineSnapshotDatasetHealth } from '@/services/cashierOfflineSnapshot'
import { parseCashierSnapshotTimestamp } from '@/utils/cashierSnapshotTime'
import type { CashierStoragePartition } from '@/types/cashierOfflineStorage'
import type {
  CashierStartupAssessment,
  CashierStartupCheckResult,
  CashierStartupChecks,
  CashierStartupContext,
  CashierStartupFailureReason,
  CashierStartupState,
} from '@/types/cashierStartup'

const CASHIER_ROLE = 'cashier' as const
const CASHIER_STARTUP_PATHS = new Set(['/cashier/terminal'])

let cachedAssessment: CashierStartupAssessment | null = null
let cachedAt = 0
let inFlightAssessment: Promise<CashierStartupAssessment> | null = null

function nowIso(): string {
  return new Date().toISOString()
}

function createCheck(status: CashierStartupCheckResult['status'], details?: string): CashierStartupCheckResult {
  return { status, details }
}

function createDefaultChecks(): CashierStartupChecks {
  return {
    shell_presence: createCheck('skip'),
    schema_version_compatibility: createCheck('skip'),
    terminal_binding: createCheck('skip'),
    offline_grant_validity: createCheck('skip'),
    snapshot_freshness: createCheck('skip'),
    queue_health: createCheck('skip'),
    online_probe: createCheck('skip'),
  }
}

function hasShellPresence(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof navigator !== 'undefined'
}

function resolveMessage(
  state: CashierStartupState,
  reason: CashierStartupFailureReason | undefined,
): { message: string; requiredAction?: string } {
  if (state === 'online_ready') {
    return {
      message: 'Терминал подключен и готов к работе.',
    }
  }

  if (state === 'offline_ready') {
    return {
      message: 'Терминал готов к работе без интернета.',
      requiredAction: 'Можно продолжать работу. Подключитесь к интернету, когда появится связь.',
    }
  }

  if (state === 'offline_stale_warning') {
    return {
      message: 'Терминал может работать без интернета, но локальные данные устарели.',
      requiredAction: 'Продолжайте только при необходимости и обновите данные при первой возможности.',
    }
  }

  switch (reason) {
    case 'terminal_binding_missing':
      return {
        message: 'Терминал кассира не подготовлен на этом устройстве.',
        requiredAction: 'Подключитесь к интернету и заново откройте терминал, чтобы подготовить устройство.',
      }
    case 'offline_grant_missing':
      return {
        message: 'Для этого терминала не подготовлен офлайн-доступ.',
        requiredAction: 'Подключитесь к интернету и обновите данные терминала.',
      }
    case 'offline_grant_invalid':
      return {
        message: 'Оффлайн-доступ истёк или повреждён.',
        requiredAction: 'Подключитесь к интернету и заново обновите данные терминала.',
      }
    case 'snapshot_missing':
      return {
        message: 'Локальные офлайн-данные отсутствуют.',
        requiredAction: 'Подключитесь к интернету и дождитесь загрузки данных терминала.',
      }
    case 'snapshot_too_stale':
      return {
        message: 'Локальные офлайн-данные слишком старые для безопасной работы.',
        requiredAction: 'Подключитесь к интернету и обновите данные перед продолжением.',
      }
    case 'schema_incompatible':
      return {
        message: 'Локальные данные терминала нужно обновить.',
        requiredAction: 'Подключитесь к интернету и снова откройте терминал.',
      }
    case 'queue_unhealthy':
      return {
        message: 'Локальная очередь терминала требует синхронизации.',
        requiredAction: 'Подключитесь к интернету и дождитесь обработки очереди.',
      }
    case 'online_probe_auth_failed':
      return {
        message: 'Сессия кассира истекла.',
        requiredAction: 'Подключитесь к интернету и войдите снова.',
      }
    case 'shell_missing':
      return {
        message: 'Оффлайн-режим недоступен в текущем окне приложения.',
        requiredAction: 'Сначала откройте терминал при подключении к интернету.',
      }
    case 'not_cashier':
      return {
        message: 'Оффлайн-режим доступен только кассиру.',
        requiredAction: 'Для этой роли используйте работу с интернетом.',
      }
    default:
      return {
        message: 'Оффлайн-запуск недоступен для текущей смены.',
        requiredAction: 'Подключитесь к интернету и повторите подготовку терминала.',
      }
  }
}

function buildAssessment(params: {
  state: CashierStartupState
  reason?: CashierStartupFailureReason
  checks: CashierStartupChecks
  terminalId?: string | null
  userId?: string | null
  snapshotAgeMs?: number | null
  queueSize?: number
}): CashierStartupAssessment {
  const info = resolveMessage(params.state, params.reason)
  return {
    state: params.state,
    reason: params.reason,
    message: info.message,
    required_action: info.requiredAction,
    checks: params.checks,
    evaluated_at: nowIso(),
    terminal_id: params.terminalId ?? null,
    user_id: params.userId ?? null,
    snapshot_age_ms: params.snapshotAgeMs ?? null,
    queue_size: params.queueSize ?? 0,
  }
}

export function isCashierStartupRoutePath(path: string): boolean {
  return CASHIER_STARTUP_PATHS.has(path)
}

export function getCachedCashierStartupAssessment(): CashierStartupAssessment | null {
  return cachedAssessment
}

export function clearCashierStartupAssessmentCache(): void {
  cachedAssessment = null
  cachedAt = 0
  inFlightAssessment = null
}

async function evaluateCashierStartupInternal(context: CashierStartupContext): Promise<CashierStartupAssessment> {
  const contextVersion = getCashierOfflineContextVersion()
  const isStaleContext = () => contextVersion !== getCashierOfflineContextVersion()
  const checks = createDefaultChecks()

  if (!context.user || context.user.role !== CASHIER_ROLE) {
    checks.shell_presence = createCheck('fail', 'cashier_role_required')
    return buildAssessment({
      state: 'offline_unavailable',
      reason: 'not_cashier',
      checks,
      userId: context.user?.id ?? null,
    })
  }

  const shellPresence = hasShellPresence()
  checks.shell_presence = shellPresence ? createCheck('pass') : createCheck('fail', 'window_or_document_missing')
  if (!shellPresence) {
    return buildAssessment({
      state: 'offline_unavailable',
      reason: 'shell_missing',
      checks,
      userId: context.user.id,
    })
  }

  const restoredPartition = await restoreCashierStoragePartitionForUser(context.user.id)
  let partition = restoredPartition

  if (!partition) {
    const terminalMeta = await findLatestCashierTerminalMetaForUser(context.user.id)
    if (!terminalMeta) {
      checks.terminal_binding = createCheck('fail', 'terminal_binding_missing')
      checks.schema_version_compatibility = createCheck('skip', 'terminal_binding_required')
      checks.offline_grant_validity = createCheck('skip', 'terminal_binding_required')
      checks.snapshot_freshness = createCheck('skip', 'terminal_binding_required')
      checks.queue_health = createCheck('skip', 'terminal_binding_required')

      const onlineProbe = await probeCashierServerConnection(context.token)
      checks.online_probe =
        onlineProbe === 'online'
          ? createCheck('pass')
          : createCheck('fail', onlineProbe === 'auth_failed' ? 'auth_failed' : 'network_unreachable')

      if (onlineProbe === 'online') {
        return buildAssessment({
          state: 'online_ready',
          checks,
          userId: context.user.id,
        })
      }

      return buildAssessment({
        state: 'offline_unavailable',
        reason: 'terminal_binding_missing',
        checks,
        userId: context.user.id,
      })
    }

    partition = {
      terminal_id: terminalMeta.terminal_id,
      user_id: context.user.id,
      role: CASHIER_ROLE,
    }
  }

  if (isStaleContext()) {
    return buildAssessment({
      state: 'offline_unavailable',
      reason: 'not_cashier',
      checks,
      terminalId: partition.terminal_id,
      userId: partition.user_id,
    })
  }

  if (!restoredPartition) {
    await initializeCashierStoragePartition(partition)
    if (isStaleContext()) {
      return buildAssessment({
        state: 'offline_unavailable',
        reason: 'not_cashier',
        checks,
        terminalId: partition.terminal_id,
        userId: partition.user_id,
      })
    }
  }

  checks.terminal_binding = createCheck('pass', restoredPartition ? 'restored_active_partition' : undefined)

  const readinessMeta = await readReadinessMeta(partition)
  const schemaCompatible = Boolean(
    isCashierOfflineDbAvailable() &&
      readinessMeta &&
      readinessMeta.role === CASHIER_ROLE &&
      readinessMeta.schema_version === CASHIER_OFFLINE_DB_VERSION,
  )
  checks.schema_version_compatibility = schemaCompatible
    ? createCheck('pass')
    : createCheck('fail', readinessMeta ? `schema_version=${readinessMeta.schema_version}` : 'readiness_meta_missing')

  const storedGrant = await readOfflineGrantForPartition(partition)
  if (!storedGrant) {
    checks.offline_grant_validity = createCheck('fail', 'offline_grant_missing')
  } else {
    try {
      const grantValidation = await validateCashierOfflineGrantLocally(storedGrant.grant, {
        expectedTerminalId: partition.terminal_id,
        expectedUserId: partition.user_id,
        expectedRole: context.user.role,
      })

      checks.offline_grant_validity = grantValidation.valid
        ? createCheck('pass')
        : createCheck('fail', grantValidation.reason || 'offline_grant_invalid')
    } catch (error) {
      checks.offline_grant_validity = createCheck(
        'fail',
        error instanceof Error ? error.message || 'offline_grant_validation_failed' : 'offline_grant_validation_failed',
      )
    }
  }

  const snapshotMeta = await readSnapshotMeta(partition)
  const freshnessMarker = snapshotMeta?.freshness_ts || snapshotMeta?.generated_at || storedGrant?.validated_at || null
  let snapshotAgeMs: number | null = null
  const snapshotDataset = await readCashierOfflineSnapshotDatasetHealth(partition)

  if (!freshnessMarker || !snapshotDataset.ready) {
    const datasetDetails = `students=${snapshotDataset.students_count};tickets=${snapshotDataset.tickets_count};categories=${snapshotDataset.categories_count}`
    checks.snapshot_freshness = createCheck('fail', 'snapshot_freshness_missing')
    if (snapshotDataset.students_count || snapshotDataset.tickets_count || snapshotDataset.categories_count) {
      checks.snapshot_freshness = createCheck('fail', datasetDetails)
    }
  } else {
    const freshnessTs = parseCashierSnapshotTimestamp(freshnessMarker)
    if (freshnessTs === null) {
      checks.snapshot_freshness = createCheck('fail', 'snapshot_freshness_invalid')
    } else {
      snapshotAgeMs = Math.max(0, Date.now() - freshnessTs)
      if (snapshotAgeMs <= CASHIER_SNAPSHOT_FRESH_MS) {
        checks.snapshot_freshness = createCheck('pass', `age_ms=${snapshotAgeMs}`)
      } else if (snapshotAgeMs <= CASHIER_SNAPSHOT_STALE_MAX_MS) {
        checks.snapshot_freshness = createCheck('warn', `age_ms=${snapshotAgeMs}`)
      } else {
        checks.snapshot_freshness = createCheck('fail', `age_ms=${snapshotAgeMs}`)
      }
    }
  }

  const queue = loadOfflineQueueForActivePartitionSync()
  const queueHealthy = queue.length <= CASHIER_OFFLINE_QUEUE_MAX_ITEMS
  checks.queue_health = queueHealthy
    ? createCheck('pass', `size=${queue.length}`)
    : createCheck('fail', `size=${queue.length};max=${CASHIER_OFFLINE_QUEUE_MAX_ITEMS}`)

  const onlineProbe = await probeCashierServerConnection(context.token)
  checks.online_probe =
    onlineProbe === 'online'
      ? createCheck('pass')
      : createCheck('fail', onlineProbe === 'auth_failed' ? 'auth_failed' : 'network_unreachable')

  if (onlineProbe === 'online') {
    return buildAssessment({
      state: 'online_ready',
      checks,
      terminalId: partition.terminal_id,
      userId: partition.user_id,
      snapshotAgeMs,
      queueSize: queue.length,
    })
  }

  if (onlineProbe === 'auth_failed') {
    return buildAssessment({
      state: 'offline_unavailable',
      reason: 'online_probe_auth_failed',
      checks,
      terminalId: partition.terminal_id,
      userId: partition.user_id,
      snapshotAgeMs,
      queueSize: queue.length,
    })
  }

  if (checks.schema_version_compatibility.status === 'fail') {
    return buildAssessment({
      state: 'offline_unavailable',
      reason: 'schema_incompatible',
      checks,
      terminalId: partition.terminal_id,
      userId: partition.user_id,
      snapshotAgeMs,
      queueSize: queue.length,
    })
  }

  if (checks.offline_grant_validity.status === 'fail') {
    return buildAssessment({
      state: 'offline_unavailable',
      reason: checks.offline_grant_validity.details?.includes('missing') ? 'offline_grant_missing' : 'offline_grant_invalid',
      checks,
      terminalId: partition.terminal_id,
      userId: partition.user_id,
      snapshotAgeMs,
      queueSize: queue.length,
    })
  }

  if (checks.snapshot_freshness.status === 'fail') {
    return buildAssessment({
      state: 'offline_unavailable',
      reason: freshnessMarker && snapshotDataset.ready ? 'snapshot_too_stale' : 'snapshot_missing',
      checks,
      terminalId: partition.terminal_id,
      userId: partition.user_id,
      snapshotAgeMs,
      queueSize: queue.length,
    })
  }

  if (checks.queue_health.status === 'fail') {
    return buildAssessment({
      state: 'offline_unavailable',
      reason: 'queue_unhealthy',
      checks,
      terminalId: partition.terminal_id,
      userId: partition.user_id,
      snapshotAgeMs,
      queueSize: queue.length,
    })
  }

  if (checks.snapshot_freshness.status === 'warn') {
    return buildAssessment({
      state: 'offline_stale_warning',
      checks,
      terminalId: partition.terminal_id,
      userId: partition.user_id,
      snapshotAgeMs,
      queueSize: queue.length,
    })
  }

  return buildAssessment({
    state: 'offline_ready',
    checks,
    terminalId: partition.terminal_id,
    userId: partition.user_id,
    snapshotAgeMs,
    queueSize: queue.length,
  })
}

export async function runCashierStartupOrchestrator(context: CashierStartupContext): Promise<CashierStartupAssessment> {
  const now = Date.now()
  const sameUser = cachedAssessment?.user_id && context.user?.id === cachedAssessment.user_id
  const contextVersion = getCashierOfflineContextVersion()

  if (!context.force && cachedAssessment && sameUser && now - cachedAt <= CASHIER_STARTUP_CACHE_TTL_MS) {
    return cachedAssessment
  }

  if (!context.force && inFlightAssessment) {
    return inFlightAssessment
  }

  inFlightAssessment = evaluateCashierStartupInternal(context)
    .then((assessment) => {
      if (contextVersion === getCashierOfflineContextVersion()) {
        cachedAssessment = assessment
        cachedAt = Date.now()
      }
      return assessment
    })
    .finally(() => {
      inFlightAssessment = null
    })

  return inFlightAssessment
}
