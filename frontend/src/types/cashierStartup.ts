import type { User } from '@/types'

export type CashierStartupState =
  | 'online_ready'
  | 'offline_ready'
  | 'offline_stale_warning'
  | 'offline_unavailable'

export type CashierStartupFailureReason =
  | 'not_cashier'
  | 'shell_missing'
  | 'schema_incompatible'
  | 'terminal_binding_missing'
  | 'offline_grant_missing'
  | 'offline_grant_invalid'
  | 'snapshot_missing'
  | 'snapshot_too_stale'
  | 'queue_unhealthy'
  | 'online_probe_auth_failed'
  | 'unknown'

export type CashierStartupCheckStatus = 'pass' | 'fail' | 'warn' | 'skip'

export interface CashierStartupCheckResult {
  status: CashierStartupCheckStatus
  details?: string
}

export interface CashierStartupChecks {
  shell_presence: CashierStartupCheckResult
  schema_version_compatibility: CashierStartupCheckResult
  terminal_binding: CashierStartupCheckResult
  offline_grant_validity: CashierStartupCheckResult
  snapshot_freshness: CashierStartupCheckResult
  queue_health: CashierStartupCheckResult
  online_probe: CashierStartupCheckResult
}

export interface CashierStartupAssessment {
  state: CashierStartupState
  reason?: CashierStartupFailureReason
  message: string
  required_action?: string
  checks: CashierStartupChecks
  evaluated_at: string
  terminal_id: string | null
  user_id: string | null
  snapshot_age_ms: number | null
  queue_size: number
}

export interface CashierStartupContext {
  token: string | null
  user: User | null
  force?: boolean
}
