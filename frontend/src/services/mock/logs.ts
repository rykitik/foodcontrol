import type { AuditLogEntry } from '@/types'
import type { AuditLogFilter } from '../api/logs'

import { readMockDb } from './store'
import { clone, requireUser } from './helpers'

export function listAuditLogs(
  token?: string | null,
  filter?: AuditLogFilter,
): AuditLogEntry[] {
  requireUser(token)
  const actorQuery = (filter?.actor ?? '').trim().toLowerCase()
  const ipQuery = (filter?.ip_address ?? '').trim().toLowerCase()
  const dateFromTimestamp = filter?.date_from ? Date.parse(`${filter.date_from}T00:00:00`) : Number.NEGATIVE_INFINITY
  const dateToTimestamp = filter?.date_to ? Date.parse(`${filter.date_to}T23:59:59.999`) : Number.POSITIVE_INFINITY
  const limit = Math.min(Math.max(filter?.limit ?? 300, 1), 1000)

  return clone(
    readMockDb()
      .logs
      .filter((entry) => {
        const entryTimestamp = Date.parse(entry.created_at)
        const actorSearchText = [
          entry.user_name,
          String(entry.details?.username ?? ''),
          String(entry.details?.full_name ?? ''),
        ]
          .join(' ')
          .toLowerCase()

        const matchesAction = !filter?.action || entry.action === filter.action
        const matchesEntity = !filter?.entity_type || entry.entity_type === filter.entity_type
        const matchesActor = !actorQuery || actorSearchText.includes(actorQuery)
        const matchesIp = !ipQuery || (entry.ip_address ?? '').toLowerCase().includes(ipQuery)
        const matchesDateFrom = Number.isNaN(entryTimestamp) || entryTimestamp >= dateFromTimestamp
        const matchesDateTo = Number.isNaN(entryTimestamp) || entryTimestamp <= dateToTimestamp

        return matchesAction && matchesEntity && matchesActor && matchesIp && matchesDateFrom && matchesDateTo
      })
      .slice(0, limit),
  )
}
