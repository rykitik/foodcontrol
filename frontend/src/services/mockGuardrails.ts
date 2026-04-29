import { USE_MOCK_API_FALLBACK } from '@/config/runtime'

const warnedFallbackKeys = new Set<string>()
let modeAnnounced = false

function isDevRuntime(): boolean {
  return import.meta.env.DEV
}

export function announceMockMode(): void {
  if (!isDevRuntime() || !USE_MOCK_API_FALLBACK || modeAnnounced) {
    return
  }

  modeAnnounced = true
  console.info(
    '[mock-api] Mock fallback is enabled. Backend remains the source of truth; use this only for narrow dev/demo scenarios.',
  )
}

export function warnMockFallback(operation: string): void {
  if (!isDevRuntime() || !USE_MOCK_API_FALLBACK || warnedFallbackKeys.has(operation)) {
    return
  }

  warnedFallbackKeys.add(operation)
  console.warn(
    `[mock-api] Falling back to mock for ${operation}. This is a secondary dev/demo path, not the default backend-first workflow.`,
  )
}
