import { createApp, defineComponent, nextTick, ref } from 'vue'
import { describe, expect, test, vi } from 'vitest'

describe('Cashier terminal scan lock', () => {
  test('ignores repeated scanner submissions while transient issue feedback is still visible', async () => {
    vi.resetModules()

    const handleTicketLookup = vi.fn()

    vi.doMock('@vueuse/core', () => ({
      useOnline: vi.fn(() => ref(true)),
    }))
    vi.doMock('@/composables/useCashierAutoReset', () => ({
      useCashierAutoReset: vi.fn(() => ({
        autoResetActive: ref(true),
        autoResetKey: ref(1),
        autoResetDelayMs: 6000,
        scheduleAutoReset: vi.fn(),
        cancelAutoReset: vi.fn(),
      })),
    }))
    vi.doMock('@/composables/cashierTerminal/connectivity', () => ({
      createCashierTerminalConnectivityController: vi.fn(() => ({
        serverReachable: ref(true),
        probingConnection: ref(false),
        reset: vi.fn(),
        markServerReachable: vi.fn(),
        markServerUnavailable: vi.fn(),
        handleBrowserOnline: vi.fn(),
        handleBrowserOffline: vi.fn(),
        stopProbing: vi.fn(),
      })),
    }))
    vi.doMock('@/composables/cashierTerminal/lookup', () => ({
      createCashierTerminalLookupController: vi.fn(() => ({
        loadOfflineSnapshotAvailability: vi.fn(),
        refreshOfflineSnapshot: vi.fn(),
        resolveLookupWithFallback: vi.fn(),
        handleTicketLookup,
      })),
    }))
    vi.doMock('@/composables/cashierTerminal/queue', () => ({
      createCashierTerminalQueueController: vi.fn(() => ({
        toggleMeal: vi.fn(),
        confirmCurrentSelection: vi.fn(),
        resetSelection: vi.fn(),
        commitSelection: vi.fn(),
      })),
    }))
    vi.doMock('@/composables/cashierTerminal/status', () => ({
      createCashierTerminalStatusController: vi.fn(() => ({
        resetStatus: vi.fn(),
        handleAuthFailure: vi.fn(),
      })),
    }))
    vi.doMock('@/composables/cashierTerminal/sync', () => ({
      createCashierTerminalSyncController: vi.fn(() => ({
        syncingQueue: ref(false),
        restoreQueuedSelections: vi.fn(),
        resetSyncState: vi.fn(),
        hasPendingMealConflict: vi.fn(() => false),
        enqueuePendingSelection: vi.fn(),
        syncPendingSelections: vi.fn(),
        retryPendingSelections: vi.fn(),
        handleOnlineReconnected: vi.fn(),
        clearRetryTimer: vi.fn(),
      })),
    }))

    const { useCashierTerminal } = await import('@/composables/useCashierTerminal')

    const terminal = useCashierTerminal()
    await terminal.submitLookupByCode('QR-001')

    expect(handleTicketLookup).not.toHaveBeenCalled()
  })

  test('swallows scanner keystrokes while terminal feedback lock is active', async () => {
    vi.resetModules()

    const { useCashierScannerCapture } = await import('@/composables/useCashierScannerCapture')
    const enabled = ref(false)
    const onScan = vi.fn()

    const TestComponent = defineComponent({
      setup() {
        useCashierScannerCapture({
          enabled: () => enabled.value,
          onScan,
        })
        return {}
      },
      template: '<input data-testid="scanner-target" />',
    })

    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp(TestComponent)
    app.mount(container)
    await nextTick()

    const input = container.querySelector('input')
    expect(input).not.toBeNull()

    const event = new KeyboardEvent('keydown', { key: 'A', bubbles: true, cancelable: true })
    const dispatched = input!.dispatchEvent(event)

    expect(dispatched).toBe(false)
    expect(event.defaultPrevented).toBe(true)
    expect(onScan).not.toHaveBeenCalled()

    app.unmount()
    container.remove()
  })
})
