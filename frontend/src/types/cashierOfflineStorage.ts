import type {
  CashierMealStatus,
  CashierOfflineGrantClaims,
  CashierOfflineGrantIssueResponse,
  MealType,
} from './index'

export type CashierStorageRole = 'cashier'

export interface CashierStoragePartition {
  terminal_id: string
  user_id: string
  role: CashierStorageRole
}

export interface CashierQueuePayload {
  request_id: string
  code: string
  selected_meals: MealType[]
  student_id?: string
  ticket_id?: string
  issue_date?: string
  notes?: string
  created_at: string
  student_name: string
  group_name: string
}

export interface CashierOfflineQueueRecord {
  queue_item_id: string
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  payload: CashierQueuePayload
  created_at: string
  updated_at: string
}

export interface CashierTerminalMetaRecord {
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  building_id: number | null
  display_name: string
  provisioned_at: string
  last_seen_at?: string | null
}

export interface CashierOfflineGrantEnvelope {
  grant: CashierOfflineGrantIssueResponse
  claims: CashierOfflineGrantClaims
  validated_at: string
}

export interface CashierOfflineGrantRecord {
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  value: CashierOfflineGrantEnvelope
  updated_at: string
}

export interface CashierSnapshotMetaRecord {
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  snapshot_version?: string | null
  generated_at?: string | null
  freshness_ts?: string | null
  service_date?: string | null
  updated_at: string
}

export interface CashierReadinessMetaRecord {
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  schema_version: number
  legacy_migrated: boolean
  legacy_migrated_at?: string | null
  updated_at: string
}

export interface CashierSnapshotStudentRecord {
  snapshot_student_id: string
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  student_id: string
  full_name: string
  full_name_lower: string
  student_card: string
  student_card_lower: string
  group_name: string
  building_id: number
  meal_building_id?: number | null
  allow_all_meal_buildings?: boolean
  effective_meal_building_id?: number | null
  category_id: number
  is_active: boolean
  updated_at: string
}

export interface CashierSnapshotTicketRecord {
  snapshot_ticket_id: string
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  ticket_id: string
  ticket_id_lower: string
  student_id: string
  category_id: number
  status: string
  qr_code: string
  qr_code_lower: string
  start_date: string
  end_date: string
  created_at?: string | null
  today_statuses?: CashierMealStatus[]
  issued_today_amount?: number
  updated_at: string
}

export interface CashierSnapshotCategoryRecord {
  snapshot_category_id: string
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  category_id: number
  value: unknown
  updated_at: string
}

export interface CashierSnapshotHolidayRecord {
  snapshot_holiday_id: string
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  holiday_date: string
  title?: string | null
  is_active: boolean
  updated_at: string
}

export interface CashierSnapshotLookupRestrictionRecord {
  snapshot_lookup_restriction_id: string
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  lookup_key: string
  lookup_key_lower: string
  lookup_kind: 'student_card' | 'ticket_id' | 'qr_code'
  reason: 'cross_building'
  effective_meal_building_id?: number | null
  effective_meal_building_name?: string | null
  updated_at: string
}

export type CashierSyncStateStatus = 'pending' | 'acked' | 'rejected' | 'needs_review'

export interface CashierSyncStateRecord {
  sync_state_id: string
  partition_key: string
  terminal_id: string
  user_id: string
  role: CashierStorageRole
  request_id: string
  status: CashierSyncStateStatus
  payload?: CashierQueuePayload | null
  attempt_count: number
  last_attempt_at?: string | null
  next_retry_at?: string | null
  last_error?: string | null
  server_status?: number | null
  review_reason?: string | null
  updated_at: string
}
