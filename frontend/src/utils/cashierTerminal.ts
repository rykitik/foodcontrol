import {
  extractCrossBuildingMealBuildingLabel,
  isCrossBuildingCashierAccessMessage,
} from '@/utils/cashierAccessMessages'

export type CashierSignalKind = 'success' | 'error' | 'warning'
export type CashierFailureKind = 'already_used' | 'holiday' | 'blocked' | 'invalid' | 'error'

export function localDateIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function generateCashierRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `cashier-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function isPermanentCashierQueueError(message: string) {
  if (isCrossBuildingCashierAccessMessage(message)) {
    return true
  }

  const normalized = message.toLowerCase()
  return (
    normalized.includes('выдан') ||
    normalized.includes('положен') ||
    normalized.includes('найден') ||
    normalized.includes('действует') ||
    normalized.includes('недоступн') ||
    normalized.includes('выходн') ||
    normalized.includes('празднич')
  )
}

export function resolveCashierFailureState(message: string): {
  kind: CashierFailureKind
  title: string
  text: string
} {
  if (isCrossBuildingCashierAccessMessage(message)) {
    const assignedMealBuildingLabel = extractCrossBuildingMealBuildingLabel(message)
    return {
      kind: 'blocked',
      title: 'Питание в другом корпусе',
      text: assignedMealBuildingLabel
        ? `Питание назначено в: ${assignedMealBuildingLabel}`
        : 'Питание доступно только в назначенном корпусе питания',
    }
  }

  const normalized = message.toLowerCase()

  if (normalized.includes('уже выдан') || normalized.includes('недоступны или уже выданы')) {
    return {
      kind: 'already_used',
      title: 'Уже выдано',
      text: message,
    }
  }

  if (
    normalized.includes('праздн') ||
    normalized.includes('выходн') ||
    normalized.includes('каникул') ||
    normalized.includes('нерабоч')
  ) {
    return {
      kind: 'holiday',
      title: 'Выдача закрыта',
      text: message,
    }
  }

  if (normalized.includes('не найден')) {
    return {
      kind: 'invalid',
      title: 'Код не найден',
      text: message,
    }
  }

  if (
    normalized.includes('неактивен') ||
    normalized.includes('не действует') ||
    normalized.includes('недоступн') ||
    normalized.includes('не положен')
  ) {
    return {
      kind: 'blocked',
      title: 'Выдача отклонена',
      text: message,
    }
  }

  return {
    kind: 'error',
    title: 'Ошибка выдачи',
    text: message,
  }
}

function getAudioContext(): AudioContext | null {
  const AudioCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return AudioCtor ? new AudioCtor() : null
}

export function playCashierSignal(kind: CashierSignalKind) {
  const context = getAudioContext()
  if (!context) {
    return
  }

  const steps =
    kind === 'success'
      ? [880, 1174]
      : kind === 'warning'
        ? [440, 440]
        : [220, 160]

  let start = context.currentTime
  steps.forEach((frequency) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = kind === 'success' ? 'triangle' : 'square'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.15)
    start += 0.16
  })
}
