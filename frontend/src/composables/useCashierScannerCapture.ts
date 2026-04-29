import { onBeforeUnmount, onMounted } from 'vue'

interface UseCashierScannerCaptureOptions {
  onScan: (code: string) => void | Promise<void>
  enabled?: () => boolean
  idleResetMs?: number
}

const DEFAULT_IDLE_RESET_MS = 120

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
}

function isPrintableKey(event: KeyboardEvent) {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
}

function shouldSwallowScannerKey(event: KeyboardEvent) {
  return isPrintableKey(event) || event.key === 'Enter' || event.key === 'Tab' || event.key === 'Backspace' || event.key === 'Escape'
}

export function useCashierScannerCapture({
  onScan,
  enabled,
  idleResetMs = DEFAULT_IDLE_RESET_MS,
}: UseCashierScannerCaptureOptions) {
  const isEnabled = enabled ?? (() => true)

  let buffer = ''
  let lastInputTs = 0

  function resetScannerBuffer() {
    buffer = ''
    lastInputTs = 0
  }

  function commitScannerBuffer(event: KeyboardEvent) {
    const code = buffer.trim()
    resetScannerBuffer()
    if (!code) {
      return
    }

    event.preventDefault()
    void onScan(code)
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.isComposing) {
      return
    }

    if (!isEnabled()) {
      if (shouldSwallowScannerKey(event)) {
        resetScannerBuffer()
        event.preventDefault()
      }
      return
    }

    if (isEditableTarget(event.target)) {
      return
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      if (buffer) {
        commitScannerBuffer(event)
      }
      return
    }

    if (event.key === 'Escape') {
      resetScannerBuffer()
      return
    }

    if (event.key === 'Backspace') {
      if (buffer) {
        buffer = buffer.slice(0, -1)
        event.preventDefault()
      }
      return
    }

    if (!isPrintableKey(event)) {
      return
    }

    const now = Date.now()
    if (now - lastInputTs > idleResetMs) {
      buffer = ''
    }

    buffer += event.key
    lastInputTs = now
  }

  onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleGlobalKeydown)
  })

  return {
    resetScannerBuffer,
  }
}
