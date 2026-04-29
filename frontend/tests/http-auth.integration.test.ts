import { describe, expect, test, vi } from 'vitest'

import { createUser, jsonResponse } from './helpers/fixtures'

describe('HTTP auth integration', () => {
  test('protected requests share one refresh and retry once with the refreshed token', async () => {
    const refreshSession = vi.fn().mockResolvedValue({ token: 'fresh-token' })
    const onRefreshSuccess = vi.fn((payload: { token: string }) => {
      localStorage.setItem('foodcontrol-auth', JSON.stringify({ token: payload.token }))
    })
    const onSessionExpired = vi.fn()
    const onNetworkUnreachable = vi.fn()

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ msg: 'jwt expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ msg: 'jwt expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'first' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'second' } }))

    globalThis.fetch = fetchMock

    const { configureAuthRefreshLifecycle, requestJson } = await import('@/services/http')
    configureAuthRefreshLifecycle({
      refreshSession,
      onRefreshSuccess,
      onSessionExpired,
      onNetworkUnreachable,
    })

    const [first, second] = await Promise.all([
      requestJson<{ id: string }>('/protected/one', {
        method: 'GET',
        headers: { Authorization: 'Bearer stale-token' },
      }),
      requestJson<{ id: string }>('/protected/two', {
        method: 'GET',
        headers: { Authorization: 'Bearer stale-token' },
      }),
    ])

    expect(first).toEqual({ id: 'first' })
    expect(second).toEqual({ id: 'second' })
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(4)

    const protectedCalls = fetchMock.mock.calls.map(([url, init]) => ({
      url: String(url),
      authorization: new Headers(init?.headers).get('Authorization'),
    }))
    expect(protectedCalls).toEqual([
      { url: '/api/protected/one', authorization: 'Bearer stale-token' },
      { url: '/api/protected/two', authorization: 'Bearer stale-token' },
      { url: '/api/protected/one', authorization: 'Bearer fresh-token' },
      { url: '/api/protected/two', authorization: 'Bearer fresh-token' },
    ])

    expect(onSessionExpired).not.toHaveBeenCalled()
    expect(onNetworkUnreachable).not.toHaveBeenCalled()
  })

  test('network unreachable during refresh does not log the user out', async () => {
    const refreshSession = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    vi.doMock('@/services/api', () => ({
      getProfile: vi.fn(),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshSession,
    }))

    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ msg: 'jwt expired' }, 401))

    const { useAuthStore } = await import('@/stores/auth')
    const { requestJson } = await import('@/services/http')

    const auth = useAuthStore()
    auth.setSession('stale-token', createUser('cashier', { id: 'cashier-1' }))

    await expect(
      requestJson('/protected/network-check', {
        method: 'GET',
        headers: { Authorization: 'Bearer stale-token' },
      }),
    ).rejects.toMatchObject({
      message: 'Network unavailable. Check connection and try again.',
    })

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.sessionState).toBe('network_unreachable')
    expect(auth.token).toBe('stale-token')
    expect(auth.user?.id).toBe('cashier-1')
  })

  test('raw backend auth payloads are sanitized before they reach the caller', async () => {
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ msg: 'jwt expired for token abc123' }, 401))

    const { configureAuthRefreshLifecycle, requestJson } = await import('@/services/http')
    configureAuthRefreshLifecycle(null)

    await expect(
      requestJson('/protected/sanitized', {
        method: 'GET',
        headers: { Authorization: 'Bearer stale-token' },
      }),
    ).rejects.toMatchObject({
      message: 'Session expired. Please sign in again.',
      status: 401,
    })
  })
})
