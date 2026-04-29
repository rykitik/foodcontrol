import { describe, expect, test, vi } from 'vitest'

import { createUser } from './helpers/fixtures'

describe('Router auth integration', () => {
  test('expired session redirects protected navigation to login', async () => {
    vi.doMock('@/services/api', () => ({
      getProfile: vi.fn(),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshSession: vi.fn(),
    }))
    vi.doMock('@/services/cashierStartupOrchestrator', () => ({
      clearCashierStartupAssessmentCache: vi.fn(),
      isCashierStartupRoutePath: vi.fn(() => false),
      runCashierStartupOrchestrator: vi.fn(),
    }))

    const { useAuthStore } = await import('@/stores/auth')
    const router = (await import('@/router')).default

    const auth = useAuthStore()
    auth.hydrated = true
    auth.token = null
    auth.user = null
    auth.sessionState = 'expired'

    await router.push('/dashboard')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.reason).toBe('expired')
    expect(router.currentRoute.value.query.redirect).toBe('/dashboard')
  })

  test('cashier warm-up runs only for cashier critical entry paths and never for supervisors', async () => {
    vi.resetModules()

    const warmCashierCriticalRouteChunks = vi.fn().mockResolvedValue(undefined)

    vi.doMock('@/services/api', () => ({
      getProfile: vi.fn(),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshSession: vi.fn(),
    }))
    vi.doMock('@/services/cashierStartupOrchestrator', () => ({
      clearCashierStartupAssessmentCache: vi.fn(),
      isCashierStartupRoutePath: vi.fn(() => false),
      runCashierStartupOrchestrator: vi.fn(),
    }))
    vi.doMock('@/router/cashierRouteWarmup', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/router/cashierRouteWarmup')>()
      return {
        ...actual,
        warmCashierCriticalRouteChunks,
      }
    })

    const { useAuthStore } = await import('@/stores/auth')
    const router = (await import('@/router')).default

    const auth = useAuthStore()
    auth.hydrated = true

    auth.setSession('cashier-token', createUser('cashier', { id: 'cashier-1' }))
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/cashier')
    expect(warmCashierCriticalRouteChunks).toHaveBeenCalledTimes(1)

    await router.push('/cashier')
    expect(router.currentRoute.value.path).toBe('/cashier')
    expect(warmCashierCriticalRouteChunks).toHaveBeenCalledTimes(1)

    await router.push('/cashier/terminal')
    expect(router.currentRoute.value.path).toBe('/cashier/terminal')
    expect(warmCashierCriticalRouteChunks).toHaveBeenCalledTimes(2)

    await router.push('/cashier/journal')
    expect(router.currentRoute.value.path).toBe('/cashier/journal')
    expect(warmCashierCriticalRouteChunks).toHaveBeenCalledTimes(3)

    await router.push('/cashier/summary')
    expect(router.currentRoute.value.path).toBe('/cashier/summary')
    expect(warmCashierCriticalRouteChunks).toHaveBeenCalledTimes(3)

    auth.setSession('admin-token', createUser('admin', { id: 'admin-1' }))
    await router.push('/cashier/summary')
    expect(router.currentRoute.value.path).toBe('/cashier/summary')
    expect(warmCashierCriticalRouteChunks).toHaveBeenCalledTimes(3)
  })

  test('admin and head_social are redirected from cashier operational routes to cashier summary', async () => {
    vi.resetModules()

    vi.doMock('@/services/api', () => ({
      getProfile: vi.fn(),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshSession: vi.fn(),
    }))
    vi.doMock('@/services/cashierStartupOrchestrator', () => ({
      clearCashierStartupAssessmentCache: vi.fn(),
      isCashierStartupRoutePath: vi.fn(() => false),
      runCashierStartupOrchestrator: vi.fn(),
    }))

    const { useAuthStore } = await import('@/stores/auth')
    const router = (await import('@/router')).default

    const auth = useAuthStore()
    auth.hydrated = true

    auth.setSession('admin-token', createUser('admin', { id: 'admin-1' }))
    await router.push('/cashier')
    expect(router.currentRoute.value.path).toBe('/cashier/summary')

    await router.push('/cashier/terminal')
    expect(router.currentRoute.value.path).toBe('/cashier/summary')

    auth.setSession('head-social-token', createUser('head_social', { id: 'head-social-1' }))
    await router.push('/cashier/journal')
    expect(router.currentRoute.value.path).toBe('/cashier/summary')
  })
})
