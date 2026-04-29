import { onBeforeUnmount, ref } from 'vue'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
})

export function useCurrentDateTime() {
  const dateLabel = ref('')
  const timeLabel = ref('')
  let nextUpdateTimer: ReturnType<typeof setTimeout> | null = null

  function clearNextUpdateTimer() {
    if (nextUpdateTimer) {
      clearTimeout(nextUpdateTimer)
      nextUpdateTimer = null
    }
  }

  function updateLabels(now = new Date()) {
    dateLabel.value = dateFormatter.format(now)
    timeLabel.value = timeFormatter.format(now)
  }

  function scheduleNextUpdate() {
    clearNextUpdateTimer()

    const now = new Date()
    const nextMinute = new Date(now)
    nextMinute.setSeconds(0, 0)
    nextMinute.setMinutes(nextMinute.getMinutes() + 1)

    nextUpdateTimer = setTimeout(() => {
      updateLabels()
      scheduleNextUpdate()
    }, Math.max(0, nextMinute.getTime() - now.getTime()))
  }

  updateLabels()
  scheduleNextUpdate()

  onBeforeUnmount(clearNextUpdateTimer)

  return {
    dateLabel,
    timeLabel,
  }
}
