import { describe, expect, test, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('Cashier terminal connectivity', () => {
  test('retries server probe in background and triggers reconnect flow after the server returns', async () => {
    vi.resetModules()
    vi.useFakeTimers()

    const probeCashierServerConnection = vi
      .fn()
      .mockResolvedValueOnce('network_unreachable')
      .mockResolvedValueOnce('online')

    vi.doMock('@/services/cashierServerProbe', () => ({
      probeCashierServerConnection,
    }))

    const { CASHIER_RECONNECT_PROBE_INTERVAL_MS } = await import('@/config/runtime')
    const { createCashierTerminalConnectivityController } = await import(
      '@/composables/cashierTerminal/connectivity'
    )

    const pushEvent = vi.fn()
    const handleAuthFailure = vi.fn()
    const onServerReconnected = vi.fn().mockResolvedValue(undefined)

    const controller = createCashierTerminalConnectivityController({
      auth: { token: 'cashier-token' },
      pushEvent,
      handleAuthFailure,
      onServerReconnected,
    })

    controller.markServerUnavailable()

    expect(controller.serverReachable.value).toBe(false)
    expect(pushEvent).toHaveBeenCalledTimes(1)
    expect(pushEvent.mock.calls[0]?.[1]).toBe('warning')

    await vi.advanceTimersByTimeAsync(CASHIER_RECONNECT_PROBE_INTERVAL_MS)

    expect(probeCashierServerConnection).toHaveBeenCalledTimes(1)
    expect(onServerReconnected).not.toHaveBeenCalled()
    expect(controller.serverReachable.value).toBe(false)

    await vi.advanceTimersByTimeAsync(CASHIER_RECONNECT_PROBE_INTERVAL_MS)

    expect(probeCashierServerConnection).toHaveBeenCalledTimes(2)
    expect(onServerReconnected).toHaveBeenCalledTimes(1)
    expect(handleAuthFailure).not.toHaveBeenCalled()
    expect(controller.serverReachable.value).toBe(true)
    expect(controller.probingConnection.value).toBe(false)
    expect(pushEvent).toHaveBeenCalledTimes(2)
    expect(pushEvent.mock.calls[1]?.[1]).toBe('success')
  })

  test('stops probing and routes to auth failure when reconnect probe reports expired auth', async () => {
    vi.resetModules()
    vi.useFakeTimers()

    const probeCashierServerConnection = vi.fn().mockResolvedValue('auth_failed')

    vi.doMock('@/services/cashierServerProbe', () => ({
      probeCashierServerConnection,
    }))

    const { CASHIER_RECONNECT_PROBE_INTERVAL_MS } = await import('@/config/runtime')
    const { createCashierTerminalConnectivityController } = await import(
      '@/composables/cashierTerminal/connectivity'
    )

    const pushEvent = vi.fn()
    const handleAuthFailure = vi.fn()
    const onServerReconnected = vi.fn().mockResolvedValue(undefined)

    const controller = createCashierTerminalConnectivityController({
      auth: { token: 'cashier-token' },
      pushEvent,
      handleAuthFailure,
      onServerReconnected,
    })

    controller.markServerUnavailable()
    await vi.advanceTimersByTimeAsync(CASHIER_RECONNECT_PROBE_INTERVAL_MS)
    await vi.runOnlyPendingTimersAsync()

    expect(probeCashierServerConnection).toHaveBeenCalledTimes(1)
    expect(handleAuthFailure).toHaveBeenCalledTimes(1)
    expect(onServerReconnected).not.toHaveBeenCalled()
    expect(controller.serverReachable.value).toBe(false)
  })
})
