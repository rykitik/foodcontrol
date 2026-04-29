import {
  CASHIER_OFFLINE_DB_VERSION,
  CASHIER_OFFLINE_STORES,
  idbDelete,
  idbDeleteMany,
  idbGet,
  idbGetAllByIndex,
  idbPut,
  idbPutMany,
  idbReplaceAllByIndex,
  isCashierOfflineDbAvailable,
} from '@/services/cashierOfflineDb'
import { getCashierOfflineContextVersion } from '@/services/cashierOfflineContext'
import type {
  CashierOfflineGrantEnvelope,
  CashierOfflineGrantRecord,
  CashierOfflineQueueRecord,
  CashierQueuePayload,
  CashierReadinessMetaRecord,
  CashierSnapshotCategoryRecord,
  CashierSnapshotHolidayRecord,
  CashierSnapshotLookupRestrictionRecord,
  CashierSnapshotMetaRecord,
  CashierSnapshotStudentRecord,
  CashierSnapshotTicketRecord,
  CashierStoragePartition,
  CashierStorageRole,
  CashierSyncStateRecord,
  CashierTerminalMetaRecord,
} from '@/types/cashierOfflineStorage'

const LEGACY_QUEUE_KEY = 'foodcontrol-cashier-queue'
const LEGACY_TERMINAL_KEY = 'foodcontrol-cashier-terminal-binding'
const LEGACY_GRANT_KEY = 'foodcontrol-cashier-offline-grant'

const STORAGE_ROLE: CashierStorageRole = 'cashier'

let activePartition: CashierStoragePartition | null = null

const queueCache = new Map<string, CashierQueuePayload[]>()
const queueHydrationPromises = new Map<string, Promise<void>>()
const terminalMetaCache = new Map<string, CashierTerminalMetaRecord>()
const grantCache = new Map<string, CashierOfflineGrantEnvelope>()

interface LegacyTerminalBinding {
  terminal_id: string
  building_id: number | null
  display_name: string
  provisioned_at: string
}

interface LegacyGrantEnvelope {
  grant: unknown
  claims: {
    sub?: string
    role?: string
    terminal_id?: string
  }
  validated_at?: string
}

interface LegacyMigrationResult {
  migrated: boolean
  idb_unavailable: boolean
}

interface IdbPersistenceOptions {
  requireIndexedDb?: boolean
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function readLocalStorage<T>(key: string): T | null {
  if (!canUseLocalStorage()) {
    return null
  }

  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeLocalStorage<T>(key: string, value: T): void {
  if (!canUseLocalStorage()) {
    return
  }

  localStorage.setItem(key, JSON.stringify(value))
}

function removeLocalStorage(key: string): void {
  if (!canUseLocalStorage()) {
    return
  }

  localStorage.removeItem(key)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isCashierPartition(value: CashierStoragePartition | null | undefined): value is CashierStoragePartition {
  return Boolean(value && isNonEmptyString(value.terminal_id) && isNonEmptyString(value.user_id) && value.role === STORAGE_ROLE)
}

function normalizePartition(partition: CashierStoragePartition): CashierStoragePartition {
  return {
    terminal_id: partition.terminal_id.trim(),
    user_id: partition.user_id.trim(),
    role: STORAGE_ROLE,
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

export function buildCashierPartitionKey(terminalId: string, userId: string): string {
  return `${terminalId.trim()}:${userId.trim()}`
}

function partitionKey(partition: CashierStoragePartition): string {
  return buildCashierPartitionKey(partition.terminal_id, partition.user_id)
}

function samePartition(left: CashierStoragePartition | null | undefined, right: CashierStoragePartition | null | undefined): boolean {
  if (!isCashierPartition(left) || !isCashierPartition(right)) {
    return false
  }

  return (
    left.terminal_id === right.terminal_id &&
    left.user_id === right.user_id &&
    left.role === right.role
  )
}

function coerceQueuePayload(value: unknown): CashierQueuePayload | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (!isNonEmptyString(candidate.request_id) || !isNonEmptyString(candidate.code)) {
    return null
  }
  if (!Array.isArray(candidate.selected_meals)) {
    return null
  }
  if (!isNonEmptyString(candidate.created_at) || !isNonEmptyString(candidate.student_name) || !isNonEmptyString(candidate.group_name)) {
    return null
  }

  return {
    request_id: candidate.request_id,
    code: candidate.code,
    selected_meals: candidate.selected_meals as CashierQueuePayload['selected_meals'],
    student_id: typeof candidate.student_id === 'string' ? candidate.student_id : undefined,
    ticket_id: typeof candidate.ticket_id === 'string' ? candidate.ticket_id : undefined,
    issue_date: typeof candidate.issue_date === 'string' ? candidate.issue_date : undefined,
    notes: typeof candidate.notes === 'string' ? candidate.notes : undefined,
    created_at: candidate.created_at,
    student_name: candidate.student_name,
    group_name: candidate.group_name,
  }
}

function readLegacyQueue(): CashierQueuePayload[] {
  const parsed = readLocalStorage<unknown[]>(LEGACY_QUEUE_KEY)
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed
    .map((item) => coerceQueuePayload(item))
    .filter((item): item is CashierQueuePayload => item !== null)
}

function readLegacyTerminalBinding(): LegacyTerminalBinding | null {
  const parsed = readLocalStorage<LegacyTerminalBinding>(LEGACY_TERMINAL_KEY)
  if (!parsed || !isNonEmptyString(parsed.terminal_id)) {
    return null
  }
  return parsed
}

function readLegacyGrantEnvelope(): LegacyGrantEnvelope | null {
  const parsed = readLocalStorage<LegacyGrantEnvelope>(LEGACY_GRANT_KEY)
  if (!parsed || typeof parsed !== 'object') {
    return null
  }
  return parsed
}

function readLegacyQueueForPartition(partition: CashierStoragePartition): CashierQueuePayload[] {
  const legacyQueue = readLegacyQueue()
  if (!legacyQueue.length) {
    return []
  }

  const legacyTerminal = readLegacyTerminalBinding()
  const legacyGrant = readLegacyGrantEnvelope()
  if (
    legacyTerminal?.terminal_id !== partition.terminal_id ||
    legacyGrant?.claims?.role !== STORAGE_ROLE ||
    legacyGrant.claims?.sub !== partition.user_id ||
    legacyGrant.claims?.terminal_id !== partition.terminal_id
  ) {
    return []
  }

  return legacyQueue
}

function queueRecordId(partition: CashierStoragePartition, payload: CashierQueuePayload, index: number): string {
  const base = `${partitionKey(partition)}:${payload.request_id}`
  return index === 0 ? base : `${base}:${index}`
}

function toQueueRecords(partition: CashierStoragePartition, queue: CashierQueuePayload[]): CashierOfflineQueueRecord[] {
  const now = nowIso()
  return queue.map((payload, index) => ({
    queue_item_id: queueRecordId(partition, payload, index),
    partition_key: partitionKey(partition),
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    payload,
    created_at: payload.created_at || now,
    updated_at: now,
  }))
}

function fromQueueRecords(records: CashierOfflineQueueRecord[]): CashierQueuePayload[] {
  return records
    .filter((record) => record.role === STORAGE_ROLE)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((record) => record.payload)
}

async function readPartitionQueueFromIdb(partition: CashierStoragePartition): Promise<CashierQueuePayload[]> {
  const records = await idbGetAllByIndex<CashierOfflineQueueRecord>(
    CASHIER_OFFLINE_STORES.offline_queue,
    'partition_key',
    partitionKey(partition),
  )
  return fromQueueRecords(records)
}

async function persistPartitionQueueToIdb(partition: CashierStoragePartition, queue: CashierQueuePayload[]): Promise<void> {
  const persisted = await idbReplaceAllByIndex<CashierOfflineQueueRecord>(
    CASHIER_OFFLINE_STORES.offline_queue,
    'partition_key',
    partitionKey(partition),
    toQueueRecords(partition, queue),
  )
  if (!persisted) {
    throw new Error('offline_queue_indexeddb_replace_failed')
  }
}

async function ensureQueueHydrated(partition: CashierStoragePartition): Promise<void> {
  const contextVersion = getCashierOfflineContextVersion()
  const key = partitionKey(partition)
  if (queueCache.has(key) || !isCashierOfflineDbAvailable()) {
    return
  }

  const existingPromise = queueHydrationPromises.get(key)
  if (existingPromise) {
    return existingPromise
  }

  const nextPromise = (async () => {
    const queue = await readPartitionQueueFromIdb(partition)
    if (contextVersion !== getCashierOfflineContextVersion()) {
      return
    }
    if (queueCache.has(key)) {
      return
    }
    if (queue.length > 0) {
      queueCache.set(key, queue)
      return
    }

    const fallbackQueue = readLegacyQueueForPartition(partition)
    if (contextVersion !== getCashierOfflineContextVersion()) {
      return
    }
    if (queueCache.has(key)) {
      return
    }
    if (fallbackQueue.length > 0) {
      queueCache.set(key, fallbackQueue)
    }
  })().finally(() => {
    queueHydrationPromises.delete(key)
  })

  queueHydrationPromises.set(key, nextPromise)
  return nextPromise
}

async function upsertReadinessMeta(record: CashierReadinessMetaRecord): Promise<void> {
  await idbPut(CASHIER_OFFLINE_STORES.readiness_meta, record)
}

export function getActiveCashierStoragePartition(): CashierStoragePartition | null {
  return activePartition
}

export function resetCashierStoragePartitionContext(): void {
  activePartition = null
  queueCache.clear()
  queueHydrationPromises.clear()
  terminalMetaCache.clear()
  grantCache.clear()
}

export function setActiveCashierStoragePartition(partition: CashierStoragePartition | null): void {
  if (!partition) {
    activePartition = null
    return
  }

  if (!isCashierPartition(partition)) {
    return
  }

  activePartition = normalizePartition(partition)
}

export async function initializeCashierStoragePartition(partition: CashierStoragePartition): Promise<void> {
  if (!isCashierPartition(partition)) {
    return
  }

  const contextVersion = getCashierOfflineContextVersion()
  const normalized = normalizePartition(partition)
  if (contextVersion !== getCashierOfflineContextVersion()) {
    return
  }
  setActiveCashierStoragePartition(normalized)

  if (!isCashierOfflineDbAvailable()) {
    return
  }

  const readiness = await idbGet<CashierReadinessMetaRecord>(
    CASHIER_OFFLINE_STORES.readiness_meta,
    partitionKey(normalized),
  )

  if (!readiness || readiness.schema_version !== CASHIER_OFFLINE_DB_VERSION) {
    await upsertReadinessMeta({
      partition_key: partitionKey(normalized),
      terminal_id: normalized.terminal_id,
      user_id: normalized.user_id,
      role: STORAGE_ROLE,
      schema_version: CASHIER_OFFLINE_DB_VERSION,
      legacy_migrated: false,
      legacy_migrated_at: null,
      updated_at: nowIso(),
    })
  }

  if (contextVersion !== getCashierOfflineContextVersion()) {
    return
  }

  await ensureLegacyCashierStorageMigrated(normalized)
  if (contextVersion !== getCashierOfflineContextVersion()) {
    return
  }

  await ensureQueueHydrated(normalized)
}

export async function ensureLegacyCashierStorageMigrated(partition: CashierStoragePartition): Promise<LegacyMigrationResult> {
  if (!isCashierPartition(partition)) {
    return { migrated: false, idb_unavailable: false }
  }

  const contextVersion = getCashierOfflineContextVersion()
  const normalized = normalizePartition(partition)

  if (!isCashierOfflineDbAvailable()) {
    return { migrated: false, idb_unavailable: true }
  }

  const key = partitionKey(normalized)
  const readiness = await idbGet<CashierReadinessMetaRecord>(CASHIER_OFFLINE_STORES.readiness_meta, key)
  if (readiness?.legacy_migrated) {
    return { migrated: false, idb_unavailable: false }
  }

  const migratedAt = nowIso()

  const legacyTerminal = readLegacyTerminalBinding()
  if (legacyTerminal && legacyTerminal.terminal_id === normalized.terminal_id) {
    if (contextVersion !== getCashierOfflineContextVersion()) {
      return { migrated: false, idb_unavailable: false }
    }
    await idbPut<CashierTerminalMetaRecord>(CASHIER_OFFLINE_STORES.terminal_meta, {
      partition_key: key,
      terminal_id: normalized.terminal_id,
      user_id: normalized.user_id,
      role: STORAGE_ROLE,
      building_id: legacyTerminal.building_id ?? null,
      display_name: legacyTerminal.display_name || 'Cashier terminal',
      provisioned_at: legacyTerminal.provisioned_at || migratedAt,
      last_seen_at: migratedAt,
    })
    if (contextVersion !== getCashierOfflineContextVersion()) {
      return { migrated: false, idb_unavailable: false }
    }
  }

  const legacyGrant = readLegacyGrantEnvelope()
  if (
    legacyGrant &&
    legacyGrant.claims?.role === STORAGE_ROLE &&
    legacyGrant.claims?.sub === normalized.user_id &&
    legacyGrant.claims?.terminal_id === normalized.terminal_id
  ) {
    if (contextVersion !== getCashierOfflineContextVersion()) {
      return { migrated: false, idb_unavailable: false }
    }
    await idbPut<CashierOfflineGrantRecord>(CASHIER_OFFLINE_STORES.offline_grant, {
      partition_key: key,
      terminal_id: normalized.terminal_id,
      user_id: normalized.user_id,
      role: STORAGE_ROLE,
      value: {
        grant: legacyGrant.grant as CashierOfflineGrantEnvelope['grant'],
        claims: legacyGrant.claims as CashierOfflineGrantEnvelope['claims'],
        validated_at: legacyGrant.validated_at || migratedAt,
      },
      updated_at: migratedAt,
    })
    if (contextVersion !== getCashierOfflineContextVersion()) {
      return { migrated: false, idb_unavailable: false }
    }
  }

  const existingQueueRecords = await idbGetAllByIndex<CashierOfflineQueueRecord>(
    CASHIER_OFFLINE_STORES.offline_queue,
    'partition_key',
    key,
  )
  if (existingQueueRecords.length === 0) {
    const legacyQueue = readLegacyQueueForPartition(normalized)
    if (legacyQueue.length > 0) {
      if (contextVersion !== getCashierOfflineContextVersion()) {
        return { migrated: false, idb_unavailable: false }
      }
      await idbPutMany<CashierOfflineQueueRecord>(
        CASHIER_OFFLINE_STORES.offline_queue,
        toQueueRecords(normalized, legacyQueue),
      )
      if (contextVersion !== getCashierOfflineContextVersion()) {
        return { migrated: false, idb_unavailable: false }
      }
      queueCache.set(key, legacyQueue)
    }
  }

  if (contextVersion !== getCashierOfflineContextVersion()) {
    return { migrated: false, idb_unavailable: false }
  }

  await upsertReadinessMeta({
    partition_key: key,
    terminal_id: normalized.terminal_id,
    user_id: normalized.user_id,
    role: STORAGE_ROLE,
    schema_version: CASHIER_OFFLINE_DB_VERSION,
    legacy_migrated: true,
    legacy_migrated_at: migratedAt,
    updated_at: migratedAt,
  })

  return { migrated: true, idb_unavailable: false }
}

export function loadOfflineQueueForActivePartitionSync(): CashierQueuePayload[] {
  const partition = getActiveCashierStoragePartition()
  if (!partition) {
    return []
  }

  const key = partitionKey(partition)
  const cached = queueCache.get(key)
  if (cached) {
    return [...cached]
  }

  void ensureQueueHydrated(partition)
  return readLegacyQueueForPartition(partition)
}

function stageOfflineQueueForPartition(partition: CashierStoragePartition, queue: CashierQueuePayload[]): void {
  const key = partitionKey(partition)
  queueCache.set(key, [...queue])
  writeLocalStorage(LEGACY_QUEUE_KEY, queue)
}

async function persistOfflineQueueForPartition(partition: CashierStoragePartition, queue: CashierQueuePayload[]): Promise<boolean> {
  stageOfflineQueueForPartition(partition, queue)

  if (!isCashierOfflineDbAvailable()) {
    return false
  }

  await persistPartitionQueueToIdb(partition, queue)
  return true
}

export function saveOfflineQueueForActivePartition(queue: CashierQueuePayload[]): void {
  const partition = getActiveCashierStoragePartition()
  if (!partition) {
    return
  }

  stageOfflineQueueForPartition(partition, queue)
  if (!isCashierOfflineDbAvailable()) {
    return
  }

  void persistPartitionQueueToIdb(partition, queue).catch((error) => {
    console.warn('Failed to persist offline queue in IndexedDB:', error)
  })
}

export async function persistOfflineQueueForActivePartition(queue: CashierQueuePayload[]): Promise<boolean> {
  const partition = getActiveCashierStoragePartition()
  if (!partition) {
    return false
  }

  try {
    return await persistOfflineQueueForPartition(partition, queue)
  } catch (error) {
    console.warn('Failed to durably persist offline queue in IndexedDB:', error)
    return false
  }
}

export function readTerminalMetaForActivePartitionSync(): CashierTerminalMetaRecord | null {
  const partition = getActiveCashierStoragePartition()
  if (!partition) {
    return null
  }

  const key = partitionKey(partition)
  const cached = terminalMetaCache.get(key)
  if (cached) {
    return cached
  }

  const legacy = readLegacyTerminalBinding()
  if (!legacy || legacy.terminal_id !== partition.terminal_id) {
    return null
  }

  const fallback: CashierTerminalMetaRecord = {
    partition_key: key,
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    building_id: legacy.building_id ?? null,
    display_name: legacy.display_name,
    provisioned_at: legacy.provisioned_at,
    last_seen_at: null,
  }
  terminalMetaCache.set(key, fallback)
  return fallback
}

export async function findLatestCashierTerminalMetaForUser(userId: string): Promise<CashierTerminalMetaRecord | null> {
  const contextVersion = getCashierOfflineContextVersion()
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) {
    return null
  }

  if (isCashierOfflineDbAvailable()) {
    const records = await idbGetAllByIndex<CashierTerminalMetaRecord>(
      CASHIER_OFFLINE_STORES.terminal_meta,
      'user_id',
      normalizedUserId,
    )

    const terminal = records
      .filter((item) => item.role === STORAGE_ROLE && item.user_id === normalizedUserId)
      .sort((left, right) => {
        const leftTimestamp = Date.parse(left.last_seen_at || left.provisioned_at || '')
        const rightTimestamp = Date.parse(right.last_seen_at || right.provisioned_at || '')
        const leftValue = Number.isNaN(leftTimestamp) ? 0 : leftTimestamp
        const rightValue = Number.isNaN(rightTimestamp) ? 0 : rightTimestamp
        return rightValue - leftValue
      })[0]

    if (terminal) {
      if (contextVersion !== getCashierOfflineContextVersion()) {
        return null
      }
      terminalMetaCache.set(terminal.partition_key, terminal)
      return terminal
    }
  }

  const legacy = readLegacyTerminalBinding()
  if (!legacy) {
    return null
  }

  const partition: CashierStoragePartition = {
    terminal_id: legacy.terminal_id,
    user_id: normalizedUserId,
    role: STORAGE_ROLE,
  }
  const key = partitionKey(partition)
  const fallback: CashierTerminalMetaRecord = {
    partition_key: key,
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    building_id: legacy.building_id ?? null,
    display_name: legacy.display_name,
    provisioned_at: legacy.provisioned_at,
    last_seen_at: null,
  }
  if (contextVersion !== getCashierOfflineContextVersion()) {
    return null
  }
  terminalMetaCache.set(key, fallback)
  return fallback
}

export async function restoreCashierStoragePartitionForUser(userId: string): Promise<CashierStoragePartition | null> {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) {
    return null
  }

  const currentPartition = getActiveCashierStoragePartition()
  if (currentPartition?.role === STORAGE_ROLE && currentPartition.user_id === normalizedUserId) {
    await initializeCashierStoragePartition(currentPartition)
    const restoredCurrentPartition = getActiveCashierStoragePartition()
    if (
      restoredCurrentPartition?.role === STORAGE_ROLE &&
      restoredCurrentPartition.user_id === normalizedUserId &&
      restoredCurrentPartition.terminal_id === currentPartition.terminal_id
    ) {
      return restoredCurrentPartition
    }
    return null
  }

  const terminalMeta = await findLatestCashierTerminalMetaForUser(normalizedUserId)
  if (!terminalMeta || terminalMeta.role !== STORAGE_ROLE || terminalMeta.user_id !== normalizedUserId) {
    return null
  }

  const partition: CashierStoragePartition = {
    terminal_id: terminalMeta.terminal_id,
    user_id: normalizedUserId,
    role: STORAGE_ROLE,
  }

  await initializeCashierStoragePartition(partition)
  const restoredPartition = getActiveCashierStoragePartition()
  if (
    restoredPartition?.role === STORAGE_ROLE &&
    restoredPartition.user_id === normalizedUserId &&
    restoredPartition.terminal_id === partition.terminal_id
  ) {
    return restoredPartition
  }

  return null
}

export async function upsertTerminalMetaForPartition(
  partition: CashierStoragePartition,
  payload: Omit<CashierTerminalMetaRecord, 'partition_key' | 'terminal_id' | 'user_id' | 'role'>,
  options?: IdbPersistenceOptions,
): Promise<void> {
  if (!isCashierPartition(partition)) {
    return
  }

  const normalized = normalizePartition(partition)
  const key = partitionKey(normalized)
  const nextRecord: CashierTerminalMetaRecord = {
    partition_key: key,
    terminal_id: normalized.terminal_id,
    user_id: normalized.user_id,
    role: STORAGE_ROLE,
    building_id: payload.building_id,
    display_name: payload.display_name,
    provisioned_at: payload.provisioned_at,
    last_seen_at: payload.last_seen_at ?? null,
  }

  terminalMetaCache.set(key, nextRecord)

  writeLocalStorage<LegacyTerminalBinding>(LEGACY_TERMINAL_KEY, {
    terminal_id: normalized.terminal_id,
    building_id: payload.building_id,
    display_name: payload.display_name,
    provisioned_at: payload.provisioned_at,
  })

  if (!isCashierOfflineDbAvailable()) {
    if (options?.requireIndexedDb) {
      throw new Error('terminal_meta_indexeddb_unavailable')
    }
    return
  }

  const persisted = await idbPut<CashierTerminalMetaRecord>(CASHIER_OFFLINE_STORES.terminal_meta, nextRecord)
  if (persisted || !options?.requireIndexedDb) {
    return
  }

  const retriedPersisted = await idbPut<CashierTerminalMetaRecord>(CASHIER_OFFLINE_STORES.terminal_meta, nextRecord)
  if (!retriedPersisted) {
    throw new Error('terminal_meta_indexeddb_write_failed')
  }
}

export function readOfflineGrantForActivePartitionSync(): CashierOfflineGrantEnvelope | null {
  const partition = getActiveCashierStoragePartition()
  if (!partition) {
    return null
  }

  const key = partitionKey(partition)
  const cached = grantCache.get(key)
  if (cached) {
    return cached
  }

  const legacy = readLegacyGrantEnvelope()
  if (
    !legacy ||
    legacy.claims?.role !== STORAGE_ROLE ||
    legacy.claims?.sub !== partition.user_id ||
    legacy.claims?.terminal_id !== partition.terminal_id
  ) {
    return null
  }

  const fallback: CashierOfflineGrantEnvelope = {
    grant: legacy.grant as CashierOfflineGrantEnvelope['grant'],
    claims: legacy.claims as CashierOfflineGrantEnvelope['claims'],
    validated_at: legacy.validated_at || nowIso(),
  }
  grantCache.set(key, fallback)
  return fallback
}

export async function readOfflineGrantForPartition(partition: CashierStoragePartition): Promise<CashierOfflineGrantEnvelope | null> {
  if (!isCashierPartition(partition)) {
    return null
  }

  const contextVersion = getCashierOfflineContextVersion()
  const normalized = normalizePartition(partition)
  const key = partitionKey(normalized)
  const cached = grantCache.get(key)
  if (cached) {
    return cached
  }

  if (isCashierOfflineDbAvailable()) {
    const stored = await idbGet<CashierOfflineGrantRecord>(CASHIER_OFFLINE_STORES.offline_grant, key)
    if (stored?.role === STORAGE_ROLE) {
      if (contextVersion !== getCashierOfflineContextVersion()) {
        return null
      }
      grantCache.set(key, stored.value)
      return stored.value
    }
  }

  const legacy = readLegacyGrantEnvelope()
  if (
    !legacy ||
    legacy.claims?.role !== STORAGE_ROLE ||
    legacy.claims?.sub !== normalized.user_id ||
    legacy.claims?.terminal_id !== normalized.terminal_id
  ) {
    return null
  }

  const fallback: CashierOfflineGrantEnvelope = {
    grant: legacy.grant as CashierOfflineGrantEnvelope['grant'],
    claims: legacy.claims as CashierOfflineGrantEnvelope['claims'],
    validated_at: legacy.validated_at || nowIso(),
  }
  if (contextVersion !== getCashierOfflineContextVersion()) {
    return null
  }
  grantCache.set(key, fallback)
  return fallback
}

export async function upsertOfflineGrantForPartition(
  partition: CashierStoragePartition,
  value: CashierOfflineGrantEnvelope,
  options?: IdbPersistenceOptions,
): Promise<void> {
  if (!isCashierPartition(partition)) {
    return
  }

  const normalized = normalizePartition(partition)
  const key = partitionKey(normalized)
  grantCache.set(key, value)
  writeLocalStorage(LEGACY_GRANT_KEY, value)

  if (!isCashierOfflineDbAvailable()) {
    if (options?.requireIndexedDb) {
      throw new Error('offline_grant_indexeddb_unavailable')
    }
    return
  }

  const persisted = await idbPut<CashierOfflineGrantRecord>(CASHIER_OFFLINE_STORES.offline_grant, {
    partition_key: key,
    terminal_id: normalized.terminal_id,
    user_id: normalized.user_id,
    role: STORAGE_ROLE,
    value,
    updated_at: nowIso(),
  })
  if (persisted || !options?.requireIndexedDb) {
    return
  }

  const retriedPersisted = await idbPut<CashierOfflineGrantRecord>(CASHIER_OFFLINE_STORES.offline_grant, {
    partition_key: key,
    terminal_id: normalized.terminal_id,
    user_id: normalized.user_id,
    role: STORAGE_ROLE,
    value,
    updated_at: nowIso(),
  })
  if (!retriedPersisted) {
    throw new Error('offline_grant_indexeddb_write_failed')
  }
}

export async function clearOfflineGrantForPartition(partition: CashierStoragePartition): Promise<void> {
  if (!isCashierPartition(partition)) {
    return
  }

  const normalized = normalizePartition(partition)
  const key = partitionKey(normalized)
  grantCache.delete(key)

  removeLocalStorage(LEGACY_GRANT_KEY)

  if (!isCashierOfflineDbAvailable()) {
    return
  }

  await idbDelete(CASHIER_OFFLINE_STORES.offline_grant, key)
}

export async function readSnapshotMeta(partition: CashierStoragePartition): Promise<CashierSnapshotMetaRecord | null> {
  if (!isCashierPartition(partition) || !isCashierOfflineDbAvailable()) {
    return null
  }

  return (
    (await idbGet<CashierSnapshotMetaRecord>(
      CASHIER_OFFLINE_STORES.snapshot_meta,
      partitionKey(normalizePartition(partition)),
    )) ?? null
  )
}

export async function upsertSnapshotMeta(
  partition: CashierStoragePartition,
  patch: Omit<CashierSnapshotMetaRecord, 'partition_key' | 'terminal_id' | 'user_id' | 'role'>,
): Promise<void> {
  if (!isCashierPartition(partition) || !isCashierOfflineDbAvailable()) {
    return
  }

  const normalized = normalizePartition(partition)
  const key = partitionKey(normalized)
  await idbPut<CashierSnapshotMetaRecord>(CASHIER_OFFLINE_STORES.snapshot_meta, {
    partition_key: key,
    terminal_id: normalized.terminal_id,
    user_id: normalized.user_id,
    role: STORAGE_ROLE,
    snapshot_version: patch.snapshot_version ?? null,
    generated_at: patch.generated_at ?? null,
    freshness_ts: patch.freshness_ts ?? null,
    service_date: patch.service_date ?? null,
    updated_at: patch.updated_at || nowIso(),
  })
}

export async function readReadinessMeta(partition: CashierStoragePartition): Promise<CashierReadinessMetaRecord | null> {
  if (!isCashierPartition(partition) || !isCashierOfflineDbAvailable()) {
    return null
  }

  return (
    (await idbGet<CashierReadinessMetaRecord>(
      CASHIER_OFFLINE_STORES.readiness_meta,
      partitionKey(normalizePartition(partition)),
    )) ?? null
  )
}

export async function clearCashierStoragePartition(partition: CashierStoragePartition): Promise<void> {
  if (!isCashierPartition(partition)) {
    return
  }

  const normalized = normalizePartition(partition)
  const key = partitionKey(normalized)
  const isActivePartition = samePartition(getActiveCashierStoragePartition(), normalized)
  if (isActivePartition) {
    activePartition = null
  }
  queueCache.delete(key)
  terminalMetaCache.delete(key)
  grantCache.delete(key)

  if (isActivePartition) {
    removeLocalStorage(LEGACY_QUEUE_KEY)
  }

  const legacyTerminal = readLegacyTerminalBinding()
  if (legacyTerminal?.terminal_id === normalized.terminal_id) {
    removeLocalStorage(LEGACY_TERMINAL_KEY)
  }

  const legacyGrant = readLegacyGrantEnvelope()
  if (
    legacyGrant?.claims?.role === STORAGE_ROLE &&
    legacyGrant.claims?.sub === normalized.user_id &&
    legacyGrant.claims?.terminal_id === normalized.terminal_id
  ) {
    removeLocalStorage(LEGACY_GRANT_KEY)
  }

  if (!isCashierOfflineDbAvailable()) {
    return
  }

  const queueRecords = await idbGetAllByIndex<CashierOfflineQueueRecord>(
    CASHIER_OFFLINE_STORES.offline_queue,
    'partition_key',
    key,
  )
  if (queueRecords.length > 0) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.offline_queue,
      queueRecords.map((record) => record.queue_item_id),
    )
  }

  const snapshotStudentRecords = await idbGetAllByIndex<CashierSnapshotStudentRecord>(
    CASHIER_OFFLINE_STORES.snapshot_students,
    'partition_key',
    key,
  )
  if (snapshotStudentRecords.length > 0) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_students,
      snapshotStudentRecords.map((record) => record.snapshot_student_id),
    )
  }

  const snapshotTicketRecords = await idbGetAllByIndex<CashierSnapshotTicketRecord>(
    CASHIER_OFFLINE_STORES.snapshot_tickets,
    'partition_key',
    key,
  )
  if (snapshotTicketRecords.length > 0) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_tickets,
      snapshotTicketRecords.map((record) => record.snapshot_ticket_id),
    )
  }

  const snapshotCategoryRecords = await idbGetAllByIndex<CashierSnapshotCategoryRecord>(
    CASHIER_OFFLINE_STORES.snapshot_categories,
    'partition_key',
    key,
  )
  if (snapshotCategoryRecords.length > 0) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_categories,
      snapshotCategoryRecords.map((record) => record.snapshot_category_id),
    )
  }

  const snapshotHolidayRecords = await idbGetAllByIndex<CashierSnapshotHolidayRecord>(
    CASHIER_OFFLINE_STORES.snapshot_holidays,
    'partition_key',
    key,
  )
  if (snapshotHolidayRecords.length > 0) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_holidays,
      snapshotHolidayRecords.map((record) => record.snapshot_holiday_id),
    )
  }

  const snapshotLookupRestrictionRecords = await idbGetAllByIndex<CashierSnapshotLookupRestrictionRecord>(
    CASHIER_OFFLINE_STORES.snapshot_lookup_restrictions,
    'partition_key',
    key,
  )
  if (snapshotLookupRestrictionRecords.length > 0) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_lookup_restrictions,
      snapshotLookupRestrictionRecords.map((record) => record.snapshot_lookup_restriction_id),
    )
  }

  const syncStateRecords = await idbGetAllByIndex<CashierSyncStateRecord>(
    CASHIER_OFFLINE_STORES.sync_state,
    'partition_key',
    key,
  )
  if (syncStateRecords.length > 0) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.sync_state,
      syncStateRecords.map((record) => record.sync_state_id),
    )
  }

  await Promise.all([
    idbDelete(CASHIER_OFFLINE_STORES.terminal_meta, key),
    idbDelete(CASHIER_OFFLINE_STORES.offline_grant, key),
    idbDelete(CASHIER_OFFLINE_STORES.snapshot_meta, key),
    idbDelete(CASHIER_OFFLINE_STORES.readiness_meta, key),
  ])
}

export function getLegacyStorageKeysForMigration(): { queue: string; terminal: string; grant: string } {
  return {
    queue: LEGACY_QUEUE_KEY,
    terminal: LEGACY_TERMINAL_KEY,
    grant: LEGACY_GRANT_KEY,
  }
}
