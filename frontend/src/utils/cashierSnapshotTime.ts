const TIMEZONE_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i

export function parseCashierSnapshotTimestamp(value: string | null | undefined): number | null {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }

  const timestamp = TIMEZONE_OFFSET_PATTERN.test(normalized)
    ? Date.parse(normalized)
    : Date.parse(`${normalized}Z`)

  return Number.isNaN(timestamp) ? null : timestamp
}
