import type { AuditLogEntry } from '@/types'

import * as mock from '../mock'
import { authHeaders, requestJson } from '../http'
import { createSearchParams, withQuery } from './shared'

export async function listAuditLogs(
  token?: string | null,
  filter?: { action?: string; entity_type?: string },
): Promise<AuditLogEntry[]> {
  const params = createSearchParams({
    action: filter?.action,
    entity_type: filter?.entity_type,
  })
  return requestJson(withQuery('/logs', params), { method: 'GET', headers: authHeaders(token) }, () =>
    mock.listAuditLogs(token, filter),
  )
}
