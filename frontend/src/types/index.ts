import type { AccountingDocumentMetadataFieldDefinition } from './accountingDocumentMetadata'

export type UserRole = 'social' | 'head_social' | 'cashier' | 'accountant' | 'admin'
export type ImportEntity = 'students'
export type StudentStatusFilter = 'all' | 'active' | 'inactive'
export type TicketPrintPreset = 'compact' | 'large'
export type TicketBulkPreviewWarningCode = 'conflict' | 'inactive' | 'unavailable'

export type MealType = 'breakfast' | 'lunch'
export type TicketStatus = 'active' | 'used' | 'expired' | 'cancelled'

export interface User {
  id: string
  username: string
  full_name: string
  email?: string
  phone?: string
  role: UserRole
  building_id?: number | null
  building_name?: string | null
  is_active: boolean
  last_login?: string | null
}

export interface UserCreateRequest {
  username: string
  password: string
  full_name: string
  email?: string
  phone?: string
  role: UserRole
  building_id?: number | null
  is_active?: boolean
}

export interface UserUpdateRequest {
  username?: string
  full_name?: string
  email?: string
  phone?: string
  building_id?: number | null
  is_active?: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface Category {
  id: number
  name: string
  code: string
  is_active?: boolean
  breakfast: boolean
  lunch: boolean
  breakfast_price?: number
  lunch_price?: number
  description?: string
  color?: string
  meal_types: MealType[]
  meal_prices?: Partial<Record<MealType, number>>
}

export interface CategoryUpdateRequest {
  name?: string
  code?: string
  breakfast?: boolean
  lunch?: boolean
  breakfast_price?: number
  lunch_price?: number
  description?: string
  color?: string
}

export interface CategoryCreateRequest {
  name: string
  code?: string
  breakfast?: boolean
  lunch?: boolean
  breakfast_price?: number
  lunch_price?: number
  description?: string
  color?: string
}

export interface CategoryDeleteRequest {
  replacement_category_id?: number | null
}

export interface Student {
  id: string
  full_name: string
  student_card: string
  group_name: string
  building_id: number
  building_name?: string | null
  meal_building_id?: number | null
  meal_building_name?: string | null
  allow_all_meal_buildings?: boolean
  effective_meal_building_id?: number | null
  effective_meal_building_name?: string | null
  category: Category
  category_id: number
  is_active: boolean
  active_ticket_id?: string | null
}

export interface StudentCreateRequest {
  full_name: string
  group_name: string
  building_id: number
  meal_building_id?: number | null
  allow_all_meal_buildings?: boolean
  category_id: number
  is_active?: boolean
}

export interface StudentUpdateRequest {
  full_name?: string
  student_card?: string
  group_name?: string
  building_id?: number
  meal_building_id?: number | null
  allow_all_meal_buildings?: boolean
  category_id?: number
  is_active?: boolean
}

export interface Ticket {
  id: string
  student_id: string
  student_name: string
  category_id: number
  category_name: string
  building_id?: number
  building_name?: string | null
  source_building_id?: number
  source_building_name?: string | null
  meal_building_id?: number | null
  meal_building_name?: string | null
  allow_all_meal_buildings?: boolean
  effective_meal_building_id?: number | null
  effective_meal_building_name?: string | null
  month: number
  year: number
  start_date: string
  end_date: string
  status: TicketStatus
  qr_code: string
  created_by: string
  created_by_name: string
  created_at: string
  meal_records_count?: number
  is_locked?: boolean
  is_overdue?: boolean
  requires_attention?: boolean
}

export interface MealRecord {
  id: string
  ticket_id: string
  student_id: string
  student_name: string
  meal_type: MealType
  issue_date: string
  issue_time: string
  issued_by: string
  issued_by_name: string
  building_id: number
  category_name: string
  price: number
  notes?: string | null
}

export interface PrintableDocument {
  title: string
  subtitle: string
  html: string
  print_mode?: 'standard' | 'embedded'
  page_orientation?: 'portrait' | 'landscape'
  pdf_available?: boolean
  editable_metadata?: AccountingDocumentMetadataFieldDefinition[]
}

export interface AuditLogEntry {
  id: number
  user_id?: string | null
  user_name: string
  action: string
  entity_type?: string | null
  entity_id?: string | null
  details: Record<string, unknown>
  ip_address?: string | null
  user_agent?: string | null
  created_at: string
}

export interface DashboardStats {
  period: string
  studentsTotal: number
  ticketsActive: number
  mealsToday: number
  breakfastToday: number
  lunchToday: number
  costToday: number
  serving_today?: boolean
  serving_block_reason?: string | null
  byCategory: Array<{
    category: string
    count: number
    amount: number
  }>
}

export interface CashierMealStatus {
  meal_type: MealType
  issued: boolean
  price: number
  issue_time?: string | null
}

export interface MealReportRow {
  category: string
  meal_type: MealType
  count: number
  amount: number
}

export interface MealReport {
  period_start: string
  period_end: string
  rows: MealReportRow[]
  totals: {
    count: number
    amount: number
  }
}

export interface CashierLookupResult {
  query: string
  student: Student | null
  ticket:
    | {
        id: string
        status: TicketStatus
        qr_code: string
        start_date?: string
        end_date?: string
      }
    | null
  allowed_meals: MealType[]
  recent_meals: MealRecord[]
  today_meals?: MealRecord[]
  issued_today_amount?: number
  remaining_meals?: MealType[]
  today_statuses?: CashierMealStatus[]
  scan_meal_hint?: MealType[]
  serving_today?: boolean
  serving_block_reason?: string | null
}

export interface TicketCreateRequest {
  student_id: string
  month: number
  year: number
  start_date?: string
  end_date?: string
}

export interface TicketBulkCreateRequest {
  building_id?: number
  category_id?: number
  student_ids?: string[]
  month?: number
  year?: number
  start_date?: string
  end_date?: string
  only_active?: boolean
}

export interface TicketBulkCreateResponse {
  created_count: number
  created_student_count: number
  skipped_count: number
  created: Ticket[]
  period_start?: string
  period_end?: string
  skipped_students: Array<{
    student_id: string
    student_name: string
    reason: string
  }>
}

export interface TicketBulkPreviewResponse {
  period_start: string
  period_end: string
  selected_student_count: number
  accessible_student_count: number
  issueable_student_count: number
  total_ticket_count: number
  month_breakdown: Array<{
    month: number
    year: number
    label: string
    student_count: number
    ticket_count: number
  }>
  warnings: Array<{
    code: TicketBulkPreviewWarningCode
    count: number
    message: string
  }>
  skipped_students: Array<{
    student_id: string
    student_name: string
    reason: string
  }>
}

export interface TicketUpdateRequest {
  start_date?: string
  end_date?: string
  status?: TicketStatus
}

export interface TicketFilter {
  student_id?: string
  building_id?: number
  category_id?: number
  status?: TicketStatus
  month?: number
  year?: number
  attention_only?: boolean
}

export interface StudentTicketFilter {
  status?: TicketStatus
  month?: number
  year?: number
}

export interface StudentSearchFilter {
  q?: string
  building_id?: number
  category_id?: number
  status?: StudentStatusFilter
}

export interface StudentGroupFilter {
  q?: string
  building_id?: number
  limit?: number
}

export interface StudentListFilter extends StudentSearchFilter {
  page?: number
  page_size?: number
}

export interface PaginatedResult<T> {
  items: T[]
  page: number
  page_size: number
  total: number
}

export interface MealSelectionRequest {
  code: string
  selected_meals: MealType[]
  request_id: string
  issue_date?: string
  notes?: string
}

export interface MealSelectionResponse {
  records: MealRecord[]
  issued_meals: MealType[]
  already_issued_meals: MealType[]
  rejected_meals: MealType[]
  total_amount: number
  request_id: string
}

export interface CashierOfflineSnapshotStudent {
  id: string
  full_name: string
  student_card: string
  group_name: string
  building_id: number
  meal_building_id?: number | null
  allow_all_meal_buildings?: boolean
  effective_meal_building_id?: number | null
  category_id: number
  is_active: boolean
}

export interface CashierOfflineSnapshotTicket {
  id: string
  student_id: string
  category_id: number
  status: TicketStatus
  qr_code: string
  start_date: string
  end_date: string
  created_at?: string | null
  today_statuses?: CashierMealStatus[]
  issued_today_amount?: number
}

export interface CashierOfflineSnapshotHoliday {
  holiday_date: string
  title?: string | null
  is_active: boolean
}

export interface CashierOfflineSnapshotLookupRestriction {
  lookup_key: string
  lookup_kind: 'student_card' | 'ticket_id' | 'qr_code'
  reason: 'cross_building'
  effective_meal_building_id?: number | null
  effective_meal_building_name?: string | null
}

export interface CashierOfflineSnapshotResponse {
  generated_at: string
  snapshot_version: string
  service_date: string
  building_id?: number | null
  datasets: {
    students: CashierOfflineSnapshotStudent[]
    tickets: CashierOfflineSnapshotTicket[]
    categories: Category[]
    holidays: CashierOfflineSnapshotHoliday[]
    configured_holidays?: string[]
    lookup_restrictions?: CashierOfflineSnapshotLookupRestriction[]
  }
  rules: {
    supported_meal_types: MealType[]
    serving_today: boolean
    serving_block_reason?: string | null
  }
}

export interface CashierOfflineSyncRequestItem {
  client_item_id?: string
  request: MealSelectionRequest
}

export type CashierOfflineSyncResultStatus = 'acked' | 'rejected' | 'needs_review'

export interface CashierOfflineSyncResultItem {
  client_item_id: string
  request_id: string
  status: CashierOfflineSyncResultStatus
  http_status: number
  message?: string | null
  data?: MealSelectionResponse | null
}

export interface CashierOfflineSyncResponse {
  results: CashierOfflineSyncResultItem[]
  summary: {
    acked: number
    rejected: number
    needs_review: number
  }
}

export interface StudentHistoryFilter {
  period_start?: string
  period_end?: string
  meal_type?: MealType
  limit?: number
}

export interface ApiResponse<T> {
  data: T
  message?: string
  error?: string
}

export interface ImportErrorItem {
  row: number
  field: string
  message: string
}

export interface ImportSummary {
  entity: ImportEntity
  dry_run: boolean
  total_rows: number
  created: number
  updated: number
  skipped: number
  errors: ImportErrorItem[]
  columns: string[]
}

export * from './accountingDocuments'
export * from './accountingDocumentMetadata'
export * from './cashierJournal'
export * from './cashierSummary'
export * from './cashierOffline'
export * from './cashierOfflineStorage'
export * from './holidays'
