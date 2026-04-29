import type { AuditLogEntry } from '@/types'

import { readMockDb } from './store'
import { clone, requireUser } from './helpers'

export function listAuditLogs(
  token?: string | null,
  filter?: { action?: string; entity_type?: string },
): AuditLogEntry[] {
  requireUser(token)
  return clone(
    readMockDb().logs.filter((entry) => {
      const matchesAction = !filter?.action || entry.action === filter.action
      const matchesEntity = !filter?.entity_type || entry.entity_type === filter.entity_type
      return matchesAction && matchesEntity
    }),
  )
}
