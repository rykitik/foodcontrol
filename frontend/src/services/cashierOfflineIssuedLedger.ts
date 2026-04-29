import { getActiveCashierStoragePartition } from '@/services/cashierOfflineStorage'
import type { MealType } from '@/types'

const LEDGER_STORAGE_KEY = 'foodcontrol-cashier-issued-ledger'
const LEDGER_RETENTION_MS = 1000 * 60 * 60 * 24 * 7

export type CashierIssuedMealSource = 'online_confirmed' | 'offline_sync_acked'

export interface CashierOfflineIssuedMealEntry {
  ledger_entry_id: string
  partition_key: string
  terminal_id: string
  user_id: string
  issue_date: string
  meal_type: MealType
  student_id?: string
  ticket_id?: string
  request_id?: string
  source: CashierIssuedMealSource
  updated_at: string
}

interface RecordIssuedMealsParams {
  issue_date: string
  meal_types: MealType[]
  source: CashierIssuedMealSource
  student_id?: string
  ticket_id?: string
  request_id?: string
}

let ledgerCache: CashierOfflineIssuedMealEntry[] | null = null

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function nowIso(): string {
  return new Date().toISOString()
}

function buildPartitionKey(terminalId: string, userId: string): string {
  return `${terminalId.trim()}:${userId.trim()}`
}

function isRecentEntry(entry: CashierOfflineIssuedMealEntry): boolean {
  const updatedAt = Date.parse(entry.updated_at)
  if (Number.isNaN(updatedAt)) {
    return false
  }

  return updatedAt >= Date.now() - LEDGER_RETENTION_MS
}

function normalizeEntries(entries: unknown): CashierOfflineIssuedMealEntry[] {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries
    .filter((entry): entry is CashierOfflineIssuedMealEntry => {
      if (!entry || typeof entry !== 'object') {
        return false
      }

      const candidate = entry as Partial<CashierOfflineIssuedMealEntry>
      return Boolean(
        candidate.ledger_entry_id &&
          candidate.partition_key &&
          candidate.terminal_id &&
          candidate.user_id &&
          candidate.issue_date &&
          candidate.meal_type &&
          candidate.updated_at,
      )
    })
    .filter(isRecentEntry)
}

function readLedger(): CashierOfflineIssuedMealEntry[] {
  if (ledgerCache) {
    return ledgerCache
  }

  if (!canUseLocalStorage()) {
    ledgerCache = []
    return ledgerCache
  }

  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY)
    ledgerCache = normalizeEntries(raw ? JSON.parse(raw) : [])
  } catch {
    ledgerCache = []
  }

  return ledgerCache
}

function writeLedger(entries: CashierOfflineIssuedMealEntry[]): void {
  ledgerCache = normalizeEntries(entries)
  if (!canUseLocalStorage()) {
    return
  }

  localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(ledgerCache))
}

function buildLedgerEntryId(params: {
  partition_key: string
  issue_date: string
  meal_type: MealType
  student_id?: string
  ticket_id?: string
  request_id?: string
}): string {
  const subjectId = params.ticket_id || params.student_id || params.request_id || 'unknown'
  return `${params.partition_key}:${params.issue_date}:${subjectId}:${params.meal_type}`
}

export function clearCashierOfflineIssuedLedger(): void {
  ledgerCache = null
  if (!canUseLocalStorage()) {
    return
  }

  localStorage.removeItem(LEDGER_STORAGE_KEY)
}

export function listCashierIssuedMealsForActivePartition(
  options?: { issueDate?: string },
): CashierOfflineIssuedMealEntry[] {
  const partition = getActiveCashierStoragePartition()
  if (!partition || partition.role !== 'cashier') {
    return []
  }

  const key = buildPartitionKey(partition.terminal_id, partition.user_id)
  return readLedger()
    .filter((entry) => entry.partition_key === key)
    .filter((entry) => !options?.issueDate || entry.issue_date === options.issueDate)
}

export function resolveCashierIssuedMealSetForActivePartition(params: {
  issueDate: string
  studentId?: string | null
  ticketId?: string | null
}): Set<MealType> {
  const issuedMeals = new Set<MealType>()

  listCashierIssuedMealsForActivePartition({ issueDate: params.issueDate }).forEach((entry) => {
    if (params.ticketId && entry.ticket_id && entry.ticket_id === params.ticketId) {
      issuedMeals.add(entry.meal_type)
      return
    }

    if (params.studentId && entry.student_id && entry.student_id === params.studentId) {
      issuedMeals.add(entry.meal_type)
    }
  })

  return issuedMeals
}

export function recordCashierIssuedMealsForActivePartition(
  params: RecordIssuedMealsParams,
): CashierOfflineIssuedMealEntry[] {
  const partition = getActiveCashierStoragePartition()
  if (!partition || partition.role !== 'cashier' || !params.meal_types.length) {
    return []
  }

  const partitionKey = buildPartitionKey(partition.terminal_id, partition.user_id)
  const existing = readLedger()
  const nextEntries = [...existing]
  const updatedAt = nowIso()

  params.meal_types.forEach((mealType) => {
    const ledgerEntryId = buildLedgerEntryId({
      partition_key: partitionKey,
      issue_date: params.issue_date,
      meal_type: mealType,
      student_id: params.student_id,
      ticket_id: params.ticket_id,
      request_id: params.request_id,
    })

    const nextEntry: CashierOfflineIssuedMealEntry = {
      ledger_entry_id: ledgerEntryId,
      partition_key: partitionKey,
      terminal_id: partition.terminal_id,
      user_id: partition.user_id,
      issue_date: params.issue_date,
      meal_type: mealType,
      student_id: params.student_id,
      ticket_id: params.ticket_id,
      request_id: params.request_id,
      source: params.source,
      updated_at: updatedAt,
    }

    const existingIndex = nextEntries.findIndex((entry) => entry.ledger_entry_id === ledgerEntryId)
    if (existingIndex >= 0) {
      nextEntries.splice(existingIndex, 1, nextEntry)
      return
    }

    nextEntries.unshift(nextEntry)
  })

  writeLedger(nextEntries)
  return listCashierIssuedMealsForActivePartition({ issueDate: params.issue_date })
}
