import { fetchCashierOfflineSnapshot } from '@/services/api'
import { getCashierOfflineContextVersion } from '@/services/cashierOfflineContext'
import { CASHIER_OFFLINE_STORES, idbDeleteMany, idbGetAllByIndex, idbPutMany, isCashierOfflineDbAvailable } from '@/services/cashierOfflineDb'
import { resolveCashierIssuedMealSetForActivePartition } from '@/services/cashierOfflineIssuedLedger'
import {
  getActiveCashierStoragePartition,
  loadOfflineQueueForActivePartitionSync,
  readSnapshotMeta,
  upsertSnapshotMeta,
} from '@/services/cashierOfflineStorage'
import { buildCrossBuildingCashierAccessMessage } from '@/utils/cashierAccessMessages'
import type {
  CashierLookupResult,
  CashierOfflineSnapshotResponse,
  Category,
  MealType,
  Student,
  TicketStatus,
} from '@/types'
import type {
  CashierQueuePayload,
  CashierSnapshotCategoryRecord,
  CashierSnapshotHolidayRecord,
  CashierSnapshotLookupRestrictionRecord,
  CashierSnapshotStudentRecord,
  CashierSnapshotTicketRecord,
  CashierStoragePartition,
} from '@/types/cashierOfflineStorage'

const STORAGE_ROLE = 'cashier' as const
const SNAPSHOT_CACHE = new Map<string, OfflineSnapshotDataset>()

export function clearCashierOfflineSnapshotCache(): void {
  SNAPSHOT_CACHE.clear()
}

interface ParsedTicketLookupCode {
  base_code: string
  meal_hint: MealType[]
}

interface OfflineSnapshotDataset {
  students: CashierSnapshotStudentRecord[]
  tickets: CashierSnapshotTicketRecord[]
  categories: Map<number, Category>
  holidayDates: Set<string>
  configuredHolidayDates: Set<string>
  lookupRestrictions: CashierSnapshotLookupRestrictionRecord[]
  serviceDate: string | null
}

export interface CashierOfflineSnapshotDatasetHealth {
  ready: boolean
  students_count: number
  tickets_count: number
  categories_count: number
}

function nowIso(): string {
  return new Date().toISOString()
}

function partitionKey(partition: CashierStoragePartition): string {
  return `${partition.terminal_id}:${partition.user_id}`
}

function normalizeLookupValue(value: string): string {
  return value.trim()
}

function lower(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function parseTicketLookupCode(value: string): ParsedTicketLookupCode {
  const rawValue = normalizeLookupValue(value).split('|', 1)[0]?.trim() ?? ''
  const printPayloadIndex = rawValue.toUpperCase().indexOf('-P')
  const normalized = printPayloadIndex === -1 ? rawValue : rawValue.slice(0, printPayloadIndex).trim()
  if (!normalized) {
    return { base_code: '', meal_hint: [] }
  }

  const upper = normalized.toUpperCase()
  if (upper.endsWith('-BL')) {
    return { base_code: normalized.slice(0, -3).trim(), meal_hint: ['breakfast', 'lunch'] }
  }
  if (upper.endsWith('-B')) {
    return { base_code: normalized.slice(0, -2).trim(), meal_hint: ['breakfast'] }
  }
  if (upper.endsWith('-L')) {
    return { base_code: normalized.slice(0, -2).trim(), meal_hint: ['lunch'] }
  }

  return { base_code: normalized, meal_hint: [] }
}

function snapshotStudentRecordId(partition: CashierStoragePartition, studentId: string): string {
  return `${partitionKey(partition)}:${studentId}`
}

function snapshotTicketRecordId(partition: CashierStoragePartition, ticketId: string): string {
  return `${partitionKey(partition)}:${ticketId}`
}

function snapshotCategoryRecordId(partition: CashierStoragePartition, categoryId: number): string {
  return `${partitionKey(partition)}:${categoryId}`
}

function snapshotHolidayRecordId(partition: CashierStoragePartition, holidayDate: string): string {
  return `${partitionKey(partition)}:${holidayDate}`
}

function snapshotLookupRestrictionRecordId(
  partition: CashierStoragePartition,
  lookupKind: string,
  lookupKey: string,
): string {
  return `${partitionKey(partition)}:${lookupKind}:${lower(lookupKey)}`
}

function toSnapshotStudentRecords(
  partition: CashierStoragePartition,
  snapshot: CashierOfflineSnapshotResponse,
): CashierSnapshotStudentRecord[] {
  const updatedAt = nowIso()
  return snapshot.datasets.students.map((student) => ({
    snapshot_student_id: snapshotStudentRecordId(partition, student.id),
    partition_key: partitionKey(partition),
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    student_id: student.id,
    full_name: student.full_name,
    full_name_lower: lower(student.full_name),
    student_card: student.student_card,
    student_card_lower: lower(student.student_card),
    group_name: student.group_name,
    building_id: student.building_id,
    meal_building_id: student.meal_building_id ?? null,
    allow_all_meal_buildings: Boolean(student.allow_all_meal_buildings),
    effective_meal_building_id: student.effective_meal_building_id ?? student.building_id,
    category_id: student.category_id,
    is_active: Boolean(student.is_active),
    updated_at: updatedAt,
  }))
}

function toSnapshotTicketRecords(
  partition: CashierStoragePartition,
  snapshot: CashierOfflineSnapshotResponse,
): CashierSnapshotTicketRecord[] {
  const updatedAt = nowIso()
  return snapshot.datasets.tickets.map((ticket) => ({
    snapshot_ticket_id: snapshotTicketRecordId(partition, ticket.id),
    partition_key: partitionKey(partition),
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    ticket_id: ticket.id,
    ticket_id_lower: lower(ticket.id),
    student_id: ticket.student_id,
    category_id: ticket.category_id,
    status: ticket.status,
    qr_code: ticket.qr_code,
    qr_code_lower: lower(ticket.qr_code),
    start_date: ticket.start_date,
    end_date: ticket.end_date,
    created_at: ticket.created_at ?? null,
    today_statuses: ticket.today_statuses ?? [],
    issued_today_amount: ticket.issued_today_amount ?? 0,
    updated_at: updatedAt,
  }))
}

function toSnapshotCategoryRecords(
  partition: CashierStoragePartition,
  snapshot: CashierOfflineSnapshotResponse,
): CashierSnapshotCategoryRecord[] {
  const updatedAt = nowIso()
  return snapshot.datasets.categories.map((category) => ({
    snapshot_category_id: snapshotCategoryRecordId(partition, category.id),
    partition_key: partitionKey(partition),
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    category_id: category.id,
    value: category,
    updated_at: updatedAt,
  }))
}

function toSnapshotHolidayRecords(
  partition: CashierStoragePartition,
  snapshot: CashierOfflineSnapshotResponse,
): CashierSnapshotHolidayRecord[] {
  const updatedAt = nowIso()
  const explicitHolidays = snapshot.datasets.holidays.map((holiday) => ({
    snapshot_holiday_id: snapshotHolidayRecordId(partition, holiday.holiday_date),
    partition_key: partitionKey(partition),
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    holiday_date: holiday.holiday_date,
    title: holiday.title ?? null,
    is_active: Boolean(holiday.is_active),
    updated_at: updatedAt,
  }))

  const configuredHolidayRecords = (snapshot.datasets.configured_holidays || []).map((holidayDate) => ({
    snapshot_holiday_id: snapshotHolidayRecordId(partition, `cfg:${holidayDate}`),
    partition_key: partitionKey(partition),
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    holiday_date: holidayDate,
    title: null,
    is_active: true,
    updated_at: updatedAt,
  }))

  return [...explicitHolidays, ...configuredHolidayRecords]
}

function toSnapshotLookupRestrictionRecords(
  partition: CashierStoragePartition,
  snapshot: CashierOfflineSnapshotResponse,
): CashierSnapshotLookupRestrictionRecord[] {
  const updatedAt = nowIso()
  return (snapshot.datasets.lookup_restrictions ?? []).map((restriction) => ({
    snapshot_lookup_restriction_id: snapshotLookupRestrictionRecordId(
      partition,
      restriction.lookup_kind,
      restriction.lookup_key,
    ),
    partition_key: partitionKey(partition),
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    lookup_key: restriction.lookup_key,
    lookup_key_lower: lower(restriction.lookup_key),
    lookup_kind: restriction.lookup_kind,
    reason: restriction.reason,
    effective_meal_building_id: restriction.effective_meal_building_id ?? null,
    effective_meal_building_name: restriction.effective_meal_building_name ?? null,
    updated_at: updatedAt,
  }))
}

async function clearSnapshotStoresForPartition(partition: CashierStoragePartition): Promise<void> {
  const key = partitionKey(partition)

  const [students, tickets, categories, holidays, lookupRestrictions] = await Promise.all([
    idbGetAllByIndex<CashierSnapshotStudentRecord>(CASHIER_OFFLINE_STORES.snapshot_students, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotTicketRecord>(CASHIER_OFFLINE_STORES.snapshot_tickets, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotCategoryRecord>(CASHIER_OFFLINE_STORES.snapshot_categories, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotHolidayRecord>(CASHIER_OFFLINE_STORES.snapshot_holidays, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotLookupRestrictionRecord>(
      CASHIER_OFFLINE_STORES.snapshot_lookup_restrictions,
      'partition_key',
      key,
    ),
  ])

  if (students.length) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_students,
      students.map((record) => record.snapshot_student_id),
    )
  }
  if (tickets.length) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_tickets,
      tickets.map((record) => record.snapshot_ticket_id),
    )
  }
  if (categories.length) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_categories,
      categories.map((record) => record.snapshot_category_id),
    )
  }
  if (holidays.length) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_holidays,
      holidays.map((record) => record.snapshot_holiday_id),
    )
  }
  if (lookupRestrictions.length) {
    await idbDeleteMany(
      CASHIER_OFFLINE_STORES.snapshot_lookup_restrictions,
      lookupRestrictions.map((record) => record.snapshot_lookup_restriction_id),
    )
  }
}

function issueDateIsoOrToday(value?: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolveServiceDayStatus(issueDate: string, dataset: OfflineSnapshotDataset): { serving_today: boolean; reason: string | null } {
  const issueDateObj = new Date(`${issueDate}T00:00:00`)
  const weekday = issueDateObj.getDay()
  if (weekday === 0) {
    return { serving_today: false, reason: 'В воскресенье питание не выдается' }
  }

  if (dataset.holidayDates.has(issueDate) || dataset.configuredHolidayDates.has(issueDate)) {
    return { serving_today: false, reason: 'В праздничные дни питание не выдается' }
  }

  return { serving_today: true, reason: null }
}

function buildLookupStudent(record: CashierSnapshotStudentRecord, category: Category): Student {
  return {
    id: record.student_id,
    full_name: record.full_name,
    student_card: record.student_card,
    group_name: record.group_name,
    building_id: record.building_id,
    meal_building_id: record.meal_building_id ?? null,
    allow_all_meal_buildings: Boolean(record.allow_all_meal_buildings),
    effective_meal_building_id: record.effective_meal_building_id ?? record.building_id,
    category_id: record.category_id,
    is_active: Boolean(record.is_active),
    category,
  }
}

function isTicketValidForDate(ticket: CashierSnapshotTicketRecord, issueDate: string): boolean {
  return ticket.start_date <= issueDate && ticket.end_date >= issueDate
}

function chooseTicketForStudent(
  studentId: string,
  issueDate: string,
  tickets: CashierSnapshotTicketRecord[],
): CashierSnapshotTicketRecord | null {
  const sorted = tickets
    .filter((ticket) => ticket.student_id === studentId && ticket.status === 'active')
    .sort((left, right) => {
      const leftDate = Date.parse(left.created_at || '')
      const rightDate = Date.parse(right.created_at || '')
      const leftValue = Number.isNaN(leftDate) ? 0 : leftDate
      const rightValue = Number.isNaN(rightDate) ? 0 : rightDate
      return rightValue - leftValue
    })

  if (!sorted.length) {
    return null
  }

  return sorted.find((ticket) => isTicketValidForDate(ticket, issueDate)) ?? sorted[0] ?? null
}

function lookupStudentRecord(query: string, dataset: OfflineSnapshotDataset): {
  student: CashierSnapshotStudentRecord | null
  ticket: CashierSnapshotTicketRecord | null
  restriction: CashierSnapshotLookupRestrictionRecord | null
  scanMealHint: MealType[]
} {
  const parsedCode = parseTicketLookupCode(query)
  const lookupValue = lower(parsedCode.base_code)
  if (!lookupValue) {
    return { student: null, ticket: null, restriction: null, scanMealHint: parsedCode.meal_hint }
  }

  const ticketByCode = dataset.tickets.find(
    (ticket) => ticket.ticket_id_lower === lookupValue || ticket.qr_code_lower === lookupValue,
  )
  if (ticketByCode) {
    const student = dataset.students.find((entry) => entry.student_id === ticketByCode.student_id) ?? null
    return { student, ticket: ticketByCode, restriction: null, scanMealHint: parsedCode.meal_hint }
  }

  const studentByCardOrId =
    dataset.students.find((entry) => entry.student_card_lower === lookupValue || lower(entry.student_id) === lookupValue) ??
    null
  if (studentByCardOrId) {
    return { student: studentByCardOrId, ticket: null, restriction: null, scanMealHint: parsedCode.meal_hint }
  }

  const lookupRestriction =
    dataset.lookupRestrictions.find((entry) => entry.lookup_key_lower === lookupValue && entry.reason === 'cross_building') ??
    null
  if (lookupRestriction) {
    return {
      student: null,
      ticket: null,
      restriction: lookupRestriction,
      scanMealHint: parsedCode.meal_hint,
    }
  }

  const studentByName = dataset.students.find((entry) => entry.full_name_lower.includes(lookupValue)) ?? null
  return { student: studentByName, ticket: null, restriction: null, scanMealHint: parsedCode.meal_hint }
}

function queueMatchesStudent(
  queueItem: CashierQueuePayload,
  student: CashierSnapshotStudentRecord,
  ticket: CashierSnapshotTicketRecord | null,
): boolean {
  if (queueItem.student_id && queueItem.student_id === student.student_id) {
    return true
  }
  if (queueItem.ticket_id && ticket && queueItem.ticket_id === ticket.ticket_id) {
    return true
  }

  const parsedCode = parseTicketLookupCode(queueItem.code)
  const normalizedCode = lower(parsedCode.base_code)
  if (!normalizedCode) {
    return false
  }

  if (normalizedCode === lower(student.student_card) || normalizedCode === lower(student.student_id)) {
    return true
  }

  if (!ticket) {
    return false
  }

  return normalizedCode === ticket.ticket_id_lower || normalizedCode === ticket.qr_code_lower
}

function extractPendingMealsForStudent(
  issueDate: string,
  student: CashierSnapshotStudentRecord,
  ticket: CashierSnapshotTicketRecord | null,
  queue: CashierQueuePayload[],
): Set<MealType> {
  const issued = new Set<MealType>()
  queue.forEach((queueItem) => {
    if ((queueItem.issue_date || issueDate) !== issueDate) {
      return
    }

    if (!queueMatchesStudent(queueItem, student, ticket)) {
      return
    }

    queueItem.selected_meals.forEach((meal) => issued.add(meal))
  })

  return issued
}

function mealPrice(category: Category, meal: MealType): number {
  const prices = category.meal_prices || {}
  const value = prices[meal]
  return typeof value === 'number' ? value : 0
}

function extractSnapshotIssuedMeals(
  issueDate: string,
  dataset: OfflineSnapshotDataset,
  ticket: CashierSnapshotTicketRecord | null,
): Set<MealType> {
  if (!ticket || dataset.serviceDate !== issueDate) {
    return new Set<MealType>()
  }

  return new Set(
    (ticket.today_statuses ?? [])
      .filter((status) => status.issued)
      .map((status) => status.meal_type),
  )
}

function extractLocallyConfirmedMeals(
  issueDate: string,
  student: CashierSnapshotStudentRecord,
  ticket: CashierSnapshotTicketRecord | null,
): Set<MealType> {
  return resolveCashierIssuedMealSetForActivePartition({
    issueDate,
    studentId: student.student_id,
    ticketId: ticket?.ticket_id ?? null,
  })
}

function buildTodayStatuses(params: {
  allowedMeals: MealType[]
  category: Category
  issuedMeals: Set<MealType>
  ticket: CashierSnapshotTicketRecord | null
  dataset: OfflineSnapshotDataset
  issueDate: string
}) {
  const snapshotStatusMap = new Map(
    params.dataset.serviceDate === params.issueDate
      ? (params.ticket?.today_statuses ?? []).map((status) => [status.meal_type, status] as const)
      : [],
  )

  return params.allowedMeals.map((meal) => {
    const snapshotStatus = snapshotStatusMap.get(meal)
    return {
      meal_type: meal,
      issued: params.issuedMeals.has(meal),
      price: snapshotStatus?.price ?? mealPrice(params.category, meal),
      issue_time: snapshotStatus?.issued ? snapshotStatus.issue_time ?? null : null,
    }
  })
}

async function loadDatasetForPartition(partition: CashierStoragePartition): Promise<OfflineSnapshotDataset | null> {
  const contextVersion = getCashierOfflineContextVersion()
  const key = partitionKey(partition)
  const cached = SNAPSHOT_CACHE.get(key)
  if (cached) {
    return cached
  }

  if (!isCashierOfflineDbAvailable()) {
    return null
  }

  const [students, tickets, categories, holidays, lookupRestrictions, snapshotMeta] = await Promise.all([
    idbGetAllByIndex<CashierSnapshotStudentRecord>(CASHIER_OFFLINE_STORES.snapshot_students, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotTicketRecord>(CASHIER_OFFLINE_STORES.snapshot_tickets, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotCategoryRecord>(CASHIER_OFFLINE_STORES.snapshot_categories, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotHolidayRecord>(CASHIER_OFFLINE_STORES.snapshot_holidays, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotLookupRestrictionRecord>(
      CASHIER_OFFLINE_STORES.snapshot_lookup_restrictions,
      'partition_key',
      key,
    ),
    readSnapshotMeta(partition),
  ])

  if (!students.length) {
    return null
  }

  const categoryMap = new Map<number, Category>()
  categories.forEach((record) => {
    if (record.role !== STORAGE_ROLE) {
      return
    }
    categoryMap.set(record.category_id, record.value as Category)
  })

  const configuredHolidayDates = new Set<string>()
  const holidayDates = new Set<string>()
  holidays.forEach((entry) => {
    if (entry.snapshot_holiday_id.includes(':cfg:')) {
      configuredHolidayDates.add(entry.holiday_date)
      return
    }
    holidayDates.add(entry.holiday_date)
  })

  const dataset: OfflineSnapshotDataset = {
    students,
    tickets,
    categories: categoryMap,
    holidayDates,
    configuredHolidayDates,
    lookupRestrictions,
    serviceDate: snapshotMeta?.service_date ?? null,
  }
  if (contextVersion !== getCashierOfflineContextVersion()) {
    return null
  }
  SNAPSHOT_CACHE.set(key, dataset)
  return dataset
}

export async function readCashierOfflineSnapshotDatasetHealth(
  partition: CashierStoragePartition,
): Promise<CashierOfflineSnapshotDatasetHealth> {
  if (!isCashierOfflineDbAvailable()) {
    return {
      ready: false,
      students_count: 0,
      tickets_count: 0,
      categories_count: 0,
    }
  }

  const key = partitionKey(partition)
  const [students, tickets, categories] = await Promise.all([
    idbGetAllByIndex<CashierSnapshotStudentRecord>(CASHIER_OFFLINE_STORES.snapshot_students, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotTicketRecord>(CASHIER_OFFLINE_STORES.snapshot_tickets, 'partition_key', key),
    idbGetAllByIndex<CashierSnapshotCategoryRecord>(CASHIER_OFFLINE_STORES.snapshot_categories, 'partition_key', key),
  ])

  return {
    ready: students.length > 0 && tickets.length > 0 && categories.length > 0,
    students_count: students.length,
    tickets_count: tickets.length,
    categories_count: categories.length,
  }
}

export async function fetchAndStoreCashierOfflineSnapshot(token: string | null): Promise<CashierOfflineSnapshotResponse | null> {
  const partition = getActiveCashierStoragePartition()
  if (!partition || partition.role !== STORAGE_ROLE || !token) {
    return null
  }

  const contextVersion = getCashierOfflineContextVersion()
  const snapshot = await fetchCashierOfflineSnapshot(token)
  if (contextVersion !== getCashierOfflineContextVersion()) {
    return null
  }
  if (!isCashierOfflineDbAvailable()) {
    return snapshot
  }

  await clearSnapshotStoresForPartition(partition)

  const students = toSnapshotStudentRecords(partition, snapshot)
  const tickets = toSnapshotTicketRecords(partition, snapshot)
  const categories = toSnapshotCategoryRecords(partition, snapshot)
  const holidays = toSnapshotHolidayRecords(partition, snapshot)
  const lookupRestrictions = toSnapshotLookupRestrictionRecords(partition, snapshot)

  if (students.length) {
    await idbPutMany(CASHIER_OFFLINE_STORES.snapshot_students, students)
  }
  if (tickets.length) {
    await idbPutMany(CASHIER_OFFLINE_STORES.snapshot_tickets, tickets)
  }
  if (categories.length) {
    await idbPutMany(CASHIER_OFFLINE_STORES.snapshot_categories, categories)
  }
  if (holidays.length) {
    await idbPutMany(CASHIER_OFFLINE_STORES.snapshot_holidays, holidays)
  }
  if (lookupRestrictions.length) {
    await idbPutMany(CASHIER_OFFLINE_STORES.snapshot_lookup_restrictions, lookupRestrictions)
  }

  if (contextVersion !== getCashierOfflineContextVersion()) {
    return snapshot
  }
  await upsertSnapshotMeta(partition, {
    snapshot_version: snapshot.snapshot_version,
    generated_at: snapshot.generated_at,
    freshness_ts: snapshot.generated_at,
    service_date: snapshot.service_date,
    updated_at: nowIso(),
  })

  if (contextVersion !== getCashierOfflineContextVersion()) {
    return snapshot
  }
  SNAPSHOT_CACHE.delete(partitionKey(partition))
  await loadDatasetForPartition(partition)
  return snapshot
}

export async function resolveCashierLookupOffline(
  query: string,
  options?: { issueDate?: string },
): Promise<CashierLookupResult | null> {
  const partition = getActiveCashierStoragePartition()
  if (!partition || partition.role !== STORAGE_ROLE) {
    return null
  }

  const dataset = await loadDatasetForPartition(partition)
  if (!dataset) {
    return null
  }

  const issueDate = issueDateIsoOrToday(options?.issueDate)
  if (!dataset.serviceDate || dataset.serviceDate !== issueDate) {
    return null
  }

  const { student: studentRecord, ticket: directTicket, restriction, scanMealHint } = lookupStudentRecord(query, dataset)

  if (restriction?.reason === 'cross_building') {
    throw new Error(buildCrossBuildingCashierAccessMessage(restriction.effective_meal_building_name))
  }

  if (!studentRecord) {
    const serviceStatus = resolveServiceDayStatus(issueDate, dataset)
    return {
      query,
      student: null,
      ticket: null,
      allowed_meals: [],
      recent_meals: [],
      today_meals: [],
      today_statuses: [],
      remaining_meals: [],
      scan_meal_hint: scanMealHint,
      issued_today_amount: 0,
      serving_today: serviceStatus.serving_today,
      serving_block_reason: serviceStatus.reason,
    }
  }

  const category = dataset.categories.get(studentRecord.category_id)
  if (!category) {
    return null
  }

  const studentTicket = directTicket ?? chooseTicketForStudent(studentRecord.student_id, issueDate, dataset.tickets)
  const queue = loadOfflineQueueForActivePartitionSync()
  const snapshotIssuedMeals = extractSnapshotIssuedMeals(issueDate, dataset, studentTicket)
  const locallyConfirmedMeals = extractLocallyConfirmedMeals(issueDate, studentRecord, studentTicket)
  const pendingMeals = extractPendingMealsForStudent(issueDate, studentRecord, studentTicket, queue)
  const issuedMeals = new Set<MealType>([
    ...snapshotIssuedMeals,
    ...locallyConfirmedMeals,
    ...pendingMeals,
  ])

  const allowedMeals = [...category.meal_types]
  const hintedMeals = scanMealHint.length ? allowedMeals.filter((meal) => scanMealHint.includes(meal)) : allowedMeals
  const remainingMeals = hintedMeals.filter((meal) => !issuedMeals.has(meal))
  const todayStatuses = buildTodayStatuses({
    allowedMeals,
    category,
    issuedMeals,
    ticket: studentTicket,
    dataset,
    issueDate,
  })
  const issuedTodayAmount = todayStatuses.reduce(
    (total, status) => total + (status.issued ? status.price : 0),
    0,
  )
  const serviceStatus = resolveServiceDayStatus(issueDate, dataset)

  return {
    query,
    student: buildLookupStudent(studentRecord, category),
    ticket: studentTicket
      ? {
          id: studentTicket.ticket_id,
          status: studentTicket.status as TicketStatus,
          qr_code: studentTicket.qr_code,
          start_date: studentTicket.start_date,
          end_date: studentTicket.end_date,
        }
      : null,
    allowed_meals: allowedMeals,
    recent_meals: [],
    today_meals: [],
    today_statuses: todayStatuses,
    remaining_meals: remainingMeals,
    scan_meal_hint: scanMealHint,
    issued_today_amount: Number(issuedTodayAmount.toFixed(2)),
    serving_today: serviceStatus.serving_today,
    serving_block_reason: serviceStatus.reason,
  }
}

export async function hasCashierOfflineSnapshotForActivePartition(): Promise<boolean> {
  const partition = getActiveCashierStoragePartition()
  if (!partition || partition.role !== STORAGE_ROLE || !isCashierOfflineDbAvailable()) {
    return false
  }

  const [health, snapshotMeta] = await Promise.all([
    readCashierOfflineSnapshotDatasetHealth(partition),
    readSnapshotMeta(partition),
  ])

  return health.ready && Boolean(snapshotMeta?.service_date === issueDateIsoOrToday())
}

