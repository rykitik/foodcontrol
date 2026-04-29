import { AUTH_STORAGE_KEY, API_BASE, ENABLE_MOCK_API } from '@/config/runtime'
import { isAuthSessionExpired, notifyAuthSessionExpired } from './authSession'
import { warnMockFallback } from './mockGuardrails'

const NETWORK_ERROR_HINTS = [
  'failed to fetch',
  'networkerror',
  'load failed',
  'internet disconnected',
  'network request failed',
]
const AUTH_REFRESH_EXCLUDED_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/logout'])
const SAFE_NETWORK_ERROR_MESSAGE = 'Network unavailable. Check connection and try again.'
const SAFE_SERVER_ERROR_MESSAGE = 'Service is temporarily unavailable. Please try again later.'
const SAFE_REQUEST_ERROR_MESSAGE = 'Request could not be completed.'

export interface AuthRefreshPayload {
  token: string
  user?: unknown
}

interface AuthRefreshLifecycle {
  refreshSession: () => Promise<AuthRefreshPayload>
  onRefreshSuccess: (payload: AuthRefreshPayload) => void
  onSessionExpired: () => void
  onNetworkUnreachable: () => void
}

let authRefreshLifecycle: AuthRefreshLifecycle | null = null
let refreshPromise: Promise<'refreshed' | 'expired' | 'network_unreachable'> | null = null

export function configureAuthRefreshLifecycle(lifecycle: AuthRefreshLifecycle | null): void {
  authRefreshLifecycle = lifecycle
}

function unwrap<T>(payload: { data?: T } | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T
  }

  return payload as T
}

function parseJsonText(input: string): unknown | null {
  const normalized = input.trim()
  if (!normalized) {
    return null
  }

  const looksLikeObject = normalized.startsWith('{') && normalized.endsWith('}')
  const looksLikeArray = normalized.startsWith('[') && normalized.endsWith(']')
  if (!looksLikeObject && !looksLikeArray) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}

function normalizeErrorMessageText(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) {
    return null
  }

  if (normalized.startsWith('{') || normalized.startsWith('[') || normalized.startsWith('<')) {
    return null
  }

  return normalized
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload) {
    return null
  }

  if (typeof payload === 'string') {
    const parsed = parseJsonText(payload)
    if (parsed !== null) {
      return extractErrorMessage(parsed)
    }

    return normalizeErrorMessageText(payload)
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const message = extractErrorMessage(item)
      if (message) {
        return message
      }
    }

    return null
  }

  if (typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Record<string, unknown>
  for (const key of ['error', 'message', 'msg', 'detail']) {
    const message = extractErrorMessage(candidate[key])
    if (message) {
      return message
    }
  }

  if ('errors' in candidate) {
    const message = extractErrorMessage(candidate.errors)
    if (message) {
      return message
    }
  }

  return null
}

function fallbackHttpErrorMessage(status: number): string {
  if (status >= 500) {
    return SAFE_SERVER_ERROR_MESSAGE
  }

  if (status === 404) {
    return 'Requested data was not found.'
  }

  if (status >= 400) {
    return SAFE_REQUEST_ERROR_MESSAGE
  }

  return `HTTP ${status}`
}

function sanitizeHttpErrorMessage(status: number, message: string, options?: { sessionExpired?: boolean }): string {
  if (options?.sessionExpired) {
    return 'Сессия истекла. Войдите снова.'
  }

  const safeMessage = normalizeErrorMessageText(message)
  if (safeMessage) {
    return safeMessage
  }

  return fallbackHttpErrorMessage(status)
}

function toSafeNetworkError(): TypeError {
  return new TypeError(SAFE_NETWORK_ERROR_MESSAGE)
}

export function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null
  }

  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as { token?: string | null }
    return parsed.token ?? null
  } catch {
    return null
  }
}

export class HttpRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpRequestError'
    this.status = status
  }
}

export function isNetworkRequestError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true
  }

  if (!(error instanceof Error)) {
    return false
  }

  const normalized = error.message.trim().toLowerCase()
  return NETWORK_ERROR_HINTS.some((hint) => normalized.includes(hint))
}

export function isAuthHttpError(error: unknown): boolean {
  if (!(error instanceof HttpRequestError)) {
    return false
  }

  return error.status === 401 || isAuthSessionExpired(error.status, error.message)
}

export function authHeaders(token?: string | null): HeadersInit {
  const resolvedToken = token ?? getStoredToken()
  return resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}
}

function createJsonHeaders(headers?: HeadersInit): Headers {
  const resolved = new Headers(headers ?? {})
  resolved.set('Content-Type', 'application/json')
  return resolved
}

function shouldAttemptAuthRefresh(path: string, headers?: HeadersInit): boolean {
  return Boolean(
    authRefreshLifecycle &&
      hasAuthorizationHeader(headers) &&
      !AUTH_REFRESH_EXCLUDED_PATHS.has(path.toLowerCase()),
  )
}

function resolveRetryHeaders(headers?: HeadersInit): Headers {
  const resolved = new Headers(headers ?? {})
  if (!resolved.has('Authorization')) {
    return resolved
  }

  const latestToken = getStoredToken()
  if (!latestToken) {
    resolved.delete('Authorization')
    return resolved
  }

  resolved.set('Authorization', `Bearer ${latestToken}`)
  return resolved
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.clone().json()) as unknown
    const message = extractErrorMessage(payload)
    if (message) {
      return message
    }
  } catch {}

  try {
    const text = await response.text()
    const message = extractErrorMessage(text)
    if (message) {
      return message
    }
  } catch {}

  return fallbackHttpErrorMessage(response.status)
}

function hasAuthorizationHeader(headers?: HeadersInit): boolean {
  return new Headers(headers ?? {}).has('Authorization')
}

interface HttpRequestErrorOptions {
  suppressAuthExpiredEvent?: boolean
}

function createHttpRequestError(
  status: number,
  message: string,
  headers?: HeadersInit,
  options?: HttpRequestErrorOptions,
): HttpRequestError {
  const sessionExpired = hasAuthorizationHeader(headers) && isAuthSessionExpired(status, message)

  if (
    !options?.suppressAuthExpiredEvent &&
    sessionExpired
  ) {
    notifyAuthSessionExpired({ status, message })
  }

  const safeMessage = sanitizeHttpErrorMessage(status, message, { sessionExpired })
  return new HttpRequestError(status, safeMessage)
}

async function runRefreshSessionLifecycle(): Promise<'refreshed' | 'expired' | 'network_unreachable'> {
  if (!authRefreshLifecycle) {
    return 'expired'
  }

  try {
    const payload = await authRefreshLifecycle.refreshSession()
    authRefreshLifecycle.onRefreshSuccess(payload)
    return 'refreshed'
  } catch (error) {
    if (isNetworkRequestError(error)) {
      authRefreshLifecycle.onNetworkUnreachable()
      return 'network_unreachable'
    }

    if (isAuthHttpError(error)) {
      authRefreshLifecycle.onSessionExpired()
      return 'expired'
    }

    authRefreshLifecycle.onNetworkUnreachable()
    return 'network_unreachable'
  }
}

async function triggerRefreshSession(): Promise<'refreshed' | 'expired' | 'network_unreachable'> {
  if (!refreshPromise) {
    refreshPromise = runRefreshSessionLifecycle().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

async function fetchWithAutoRefresh(path: string, init: RequestInit, options?: { allowRefresh?: boolean }): Promise<Response> {
  const allowRefresh = options?.allowRefresh ?? true
  const normalizedPath = path.toLowerCase()
  const suppressAuthExpiredEvent = normalizedPath === '/auth/logout'

  const response = await fetch(`${API_BASE}${path}`, init)
  if (response.ok) {
    return response
  }

  const shouldRefresh =
    allowRefresh &&
    response.status === 401 &&
    shouldAttemptAuthRefresh(normalizedPath, init.headers)

  if (shouldRefresh) {
    const refreshOutcome = await triggerRefreshSession()
    if (refreshOutcome === 'network_unreachable') {
      throw toSafeNetworkError()
    }

    const retryHeaders = resolveRetryHeaders(init.headers)
    if (refreshOutcome === 'refreshed') {
      const retryResponse = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: retryHeaders,
      })
      if (retryResponse.ok) {
        return retryResponse
      }

      const retryErrorMessage = await readError(retryResponse)
      throw createHttpRequestError(retryResponse.status, retryErrorMessage, retryHeaders, {
        suppressAuthExpiredEvent,
      })
    }

    const postRefreshMessage = await readError(response)
    throw createHttpRequestError(response.status, postRefreshMessage, init.headers, {
      suppressAuthExpiredEvent,
    })
  }

  const errorMessage = await readError(response)
  throw createHttpRequestError(response.status, errorMessage, init.headers, {
    suppressAuthExpiredEvent,
  })
}

export async function requestJson<T>(
  path: string,
  init: RequestInit,
  fallback?: () => T | Promise<T>,
): Promise<T> {
  try {
    const headers = createJsonHeaders(init.headers)
    const response = await fetchWithAutoRefresh(path, {
      ...init,
      headers,
    })

    return unwrap((await response.json()) as { data?: T } | T)
  } catch (error) {
    if (isNetworkRequestError(error)) {
      error = toSafeNetworkError()
    }

    if (ENABLE_MOCK_API && fallback && isNetworkRequestError(error)) {
      warnMockFallback(path)
      return fallback()
    }

    throw error
  }
}

export async function requestBlob(
  path: string,
  init: RequestInit,
  fallback?: () => Blob | Promise<Blob>,
): Promise<Blob> {
  try {
    const response = await fetchWithAutoRefresh(path, init)
    return await response.blob()
  } catch (error) {
    if (isNetworkRequestError(error)) {
      error = toSafeNetworkError()
    }

    if (ENABLE_MOCK_API && fallback && isNetworkRequestError(error)) {
      warnMockFallback(path)
      return fallback()
    }

    throw error
  }
}

export async function requestForm<T>(
  path: string,
  formData: FormData,
  token?: string | null,
  fallback?: () => T | Promise<T>,
): Promise<T> {
  try {
    const headers = authHeaders(token)
    const response = await fetchWithAutoRefresh(path, {
      method: 'POST',
      headers,
      body: formData,
    })

    const payload = (await response.json()) as { data?: T; error?: string; message?: string }
    return unwrap(payload)
  } catch (error) {
    if (isNetworkRequestError(error)) {
      error = toSafeNetworkError()
    }

    if (ENABLE_MOCK_API && fallback && isNetworkRequestError(error)) {
      warnMockFallback(path)
      return fallback()
    }

    throw error
  }
}
