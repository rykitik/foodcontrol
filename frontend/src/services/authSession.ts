const AUTH_SESSION_EXPIRED_EVENT = 'app:auth-session-expired'

const authExpiredStatuses = new Set([401, 419, 440, 441, 442])
const authExpiredHints = [/jwt/i, /\btoken\b/i, /session/i, /expired/i, /unauthorized/i, /authorization/i]
const nonSessionHints = [/role/i, /inactive/i, /disabled/i, /blocked/i, /permission/i, /access denied/i]
const jwtValidationHints = [/signature verification failed/i, /not enough segments/i, /invalid token/i]

export interface AuthSessionExpiredDetail {
  status: number
  message: string
}

export function isAuthSessionExpired(status: number, message: string): boolean {
  if (authExpiredStatuses.has(status)) {
    return true
  }

  const normalizedMessage = message.trim().toLowerCase()
  if (!normalizedMessage) {
    return false
  }

  if (status === 422 && jwtValidationHints.some((pattern) => pattern.test(normalizedMessage))) {
    return true
  }

  return authExpiredHints.some((pattern) => pattern.test(normalizedMessage)) && !nonSessionHints.some((pattern) => pattern.test(normalizedMessage))
}

export function notifyAuthSessionExpired(detail: AuthSessionExpiredDetail): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<AuthSessionExpiredDetail>(AUTH_SESSION_EXPIRED_EVENT, { detail }))
}

export function listenAuthSessionExpired(handler: (detail: AuthSessionExpiredDetail) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<AuthSessionExpiredDetail>).detail
    if (!detail) {
      return
    }

    handler(detail)
  }

  window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, listener)

  return () => {
    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, listener)
  }
}
