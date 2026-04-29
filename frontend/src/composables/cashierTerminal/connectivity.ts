import { ref } from 'vue'

import { CASHIER_RECONNECT_PROBE_INTERVAL_MS } from '@/config/runtime'
import { probeCashierServerConnection } from '@/services/cashierServerProbe'

interface CashierTerminalConnectivityControllerOptions {
  auth: {
    token: string | null
  }
  pushEvent: (message: string, tone?: 'info' | 'success' | 'warning' | 'danger') => void
  handleAuthFailure: (actionLabel: string) => void
  onServerReconnected: () => Promise<void>
}

export interface CashierTerminalConnectivityController {
  serverReachable: ReturnType<typeof ref<boolean>>
  probingConnection: ReturnType<typeof ref<boolean>>
  reset: () => void
  markServerReachable: () => void
  markServerUnavailable: () => void
  handleBrowserOnline: () => void
  handleBrowserOffline: () => void
  stopProbing: () => void
}

export function createCashierTerminalConnectivityController(
  options: CashierTerminalConnectivityControllerOptions,
): CashierTerminalConnectivityController {
  const serverReachable = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const probingConnection = ref(false)
  let probeTimer: ReturnType<typeof setTimeout> | null = null

  function stopProbing() {
    if (!probeTimer) {
      return
    }

    clearTimeout(probeTimer)
    probeTimer = null
  }

  function markServerReachable() {
    serverReachable.value = true
    stopProbing()
  }

  async function runProbe() {
    if (probingConnection.value) {
      return
    }

    probingConnection.value = true
    try {
      const result = await probeCashierServerConnection(options.auth.token)

      if (result === 'online') {
        const wasUnavailable = !serverReachable.value
        markServerReachable()
        if (wasUnavailable) {
          options.pushEvent('Связь с сервером восстановлена. Локальные данные обновляются.', 'success')
          await options.onServerReconnected()
        }
        return
      }

      serverReachable.value = false
      if (result === 'auth_failed') {
        stopProbing()
        options.handleAuthFailure('Проверка связи с сервером')
        return
      }

      probeTimer = setTimeout(() => {
        void runProbe()
      }, CASHIER_RECONNECT_PROBE_INTERVAL_MS)
    } finally {
      probingConnection.value = false
    }
  }

  function markServerUnavailable() {
    const wasReachable = serverReachable.value
    serverReachable.value = false
    if (wasReachable) {
      options.pushEvent(
        'Связь с сервером потеряна. Терминал будет проверять восстановление автоматически.',
        'warning',
      )
    }

    stopProbing()
    probeTimer = setTimeout(() => {
      void runProbe()
    }, CASHIER_RECONNECT_PROBE_INTERVAL_MS)
  }

  function handleBrowserOnline() {
    stopProbing()
    probeTimer = setTimeout(() => {
      void runProbe()
    }, 0)
  }

  function handleBrowserOffline() {
    markServerUnavailable()
  }

  function reset() {
    stopProbing()
    serverReachable.value = typeof navigator !== 'undefined' ? navigator.onLine : true
    probingConnection.value = false
  }

  return {
    serverReachable,
    probingConnection,
    reset,
    markServerReachable,
    markServerUnavailable,
    handleBrowserOnline,
    handleBrowserOffline,
    stopProbing,
  }
}
