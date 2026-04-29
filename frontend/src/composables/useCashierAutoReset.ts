import { onBeforeUnmount, ref } from 'vue'

const DEFAULT_AUTO_RESET_DELAY_MS = 6000

export function useCashierAutoReset(resetFn: () => void, delayMs = DEFAULT_AUTO_RESET_DELAY_MS) {
  const autoResetActive = ref(false)
  const autoResetKey = ref(0)
  let resetTimer: ReturnType<typeof setTimeout> | null = null

  function cancelAutoReset() {
    if (resetTimer) {
      clearTimeout(resetTimer)
      resetTimer = null
    }
    autoResetActive.value = false
  }

  function scheduleAutoReset() {
    cancelAutoReset()
    autoResetActive.value = true
    autoResetKey.value += 1
    resetTimer = setTimeout(() => {
      autoResetActive.value = false
      resetFn()
    }, delayMs)
  }

  onBeforeUnmount(cancelAutoReset)

  return {
    autoResetActive,
    autoResetKey,
    autoResetDelayMs: delayMs,
    scheduleAutoReset,
    cancelAutoReset,
  }
}
