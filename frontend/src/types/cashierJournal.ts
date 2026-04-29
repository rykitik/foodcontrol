export type CashierJournalAttentionCode =
  | 'duplicate_same_meal'
  | 'multiple_buildings'
  | 'outside_assigned_building'

export type CashierJournalAttentionTone = 'warning' | 'danger'

export interface CashierJournalAttentionFlag {
  code: CashierJournalAttentionCode
  label: string
  tone: CashierJournalAttentionTone
  description: string
}

export interface CashierJournalRecord {
  id: string
  ticket_id: string
  student_id: string
  student_name: string
  student_card: string
  group_name: string
  meal_type: 'breakfast' | 'lunch'
  meal_type_label: string
  issue_date: string
  issue_time: string
  issued_by: string
  issued_by_name: string
  building_id: number
  building_name?: string | null
  source_building_id: number
  source_building_name?: string | null
  meal_building_id?: number | null
  meal_building_name?: string | null
  effective_meal_building_id?: number | null
  effective_meal_building_name?: string | null
  allow_all_meal_buildings: boolean
  category_name: string
  price: number
  notes?: string | null
  attention_flags: CashierJournalAttentionFlag[]
  has_attention: boolean
}

export interface CashierJournalAttentionItem {
  student_id: string
  student_name: string
  student_card: string
  group_name: string
  codes: CashierJournalAttentionCode[]
  labels: string[]
  reasons: string[]
  meal_types: Array<'breakfast' | 'lunch'>
  meal_type_labels: string[]
  buildings: Array<{
    building_id: number
    building_name: string
  }>
  record_count: number
  scoped_record_ids: string[]
}

export interface CashierJournalSummary {
  records_count: number
  students_count: number
  attention_records_count: number
  attention_students_count: number
  duplicate_same_meal_count: number
  multiple_buildings_count: number
  outside_assigned_building_count: number
  total_amount: number
}

export interface CashierJournal {
  date: string
  scope: {
    building_id?: number | null
    building_name?: string | null
    scope_label: string
  }
  summary: CashierJournalSummary
  attention_items: CashierJournalAttentionItem[]
  records: CashierJournalRecord[]
}

export interface CashierJournalOfflineState {
  has_partition: boolean
  is_online: boolean
  terminal_display_name?: string | null
  snapshot_ready: boolean
  snapshot_students_count: number
  snapshot_tickets_count: number
  snapshot_categories_count: number
  generated_at?: string | null
  service_date?: string | null
  queue_count: number
  review_count: number
  events_count: number
}

export type CashierJournalScanOutcome =
  | 'success'
  | 'blocked'
  | 'already_used'
  | 'not_found'
  | 'offline'
  | 'error'

export interface CashierJournalScanAttempt {
  id: string
  created_at: string
  outcome: CashierJournalScanOutcome
  title: string
  subject: string
  description: string
  tone: 'info' | 'success' | 'warning' | 'danger'
}

export interface CashierJournalRepeatedScan {
  id: string
  outcome: CashierJournalScanOutcome
  title: string
  subject: string
  description: string
  count: number
  last_at: string
  tone: 'info' | 'success' | 'warning' | 'danger'
}

export interface CashierJournalScanActivity {
  attempts_count: number
  success_count: number
  blocked_count: number
  not_found_count: number
  offline_count: number
  error_count: number
  latest_attempts: CashierJournalScanAttempt[]
  repeated_attempts: CashierJournalRepeatedScan[]
}
