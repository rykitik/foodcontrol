import type { AuditLogEntry } from '@/types'

import * as mock from '../mock'
import { authHeaders, requestJson } from '../http'
import { createSearchParams, withQuery } from './shared'

export interface AuditLogFilter {
  action?: string
  entity_type?: string
  actor?: string
  ip_address?: string
  date_from?: string
  date_to?: string
  limit?: number
}

export async function listAuditLogs(
  token?: string | null,
  filter?: AuditLogFilter,
): Promise<AuditLogEntry[]> {
  const params = createSearchParams({
    action: filter?.action,
    entity_type: filter?.entity_type,
    actor: filter?.actor,
    ip_address: filter?.ip_address,
    date_from: filter?.date_from,
    date_to: filter?.date_to,
    limit: filter?.limit,
  })
  return requestJson(withQuery('/logs', params), { method: 'GET', headers: authHeaders(token) }, () =>
    mock.listAuditLogs(token, filter),
  )
}
