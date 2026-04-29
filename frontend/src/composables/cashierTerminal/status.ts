import type { Ref } from 'vue'

import { mealTypeLabels } from '@/config/options'
import type { MealSelectionResponse, MealType } from '@/types'
import type { PendingCashierSelection } from '@/utils/cashierSession'
import { playCashierSignal, resolveCashierFailureState } from '@/utils/cashierTerminal'

import {
  CASHIER_INACTIVE_STUDENT_MESSAGE,
  INITIAL_STATUS,
  hasActiveLookupStudent,
  hasActiveLookupTicket,
  mealsLabel,
  resolveIssuedMeals,
  resolveRemainingMeals,
  type CashierStatusKind,
  type CashierStatusState,
} from './shared'

type CashierEventTone = 'info' | 'success' | 'warning' | 'danger'

interface CashierTerminalFeedback {
  kind: CashierStatusKind
  title: string
  text: string
  eventMessage?: string
  eventTone?: CashierEventTone
  signal?: 'success' | 'error' | 'warning'
  autoReset?: boolean
}

interface CashierTerminalStatusControllerOptions {
  status: Ref<CashierStatusState>
  pushEvent: (message: string, tone?: CashierEventTone) => void
  scheduleAutoReset: () => void
}

const HOLIDAY_REASON_PATTERN = /празд|выход|каникул|нерабоч/i

function resolveServiceClosedState(reason?: string | null): Pick<CashierTerminalFeedback, 'kind' | 'text'> {
  const normalized = (reason ?? '').trim()
  if (HOLIDAY_REASON_PATTERN.test(normalized)) {
    return {
      kind: 'holiday',
      text: normalized || 'Нерабочий день',
    }
  }

  return {
    kind: 'blocked',
    text: normalized || 'Выдача на сегодня закрыта',
  }
}

export interface CashierTerminalStatusController {
  setStatus: (kind: CashierStatusKind, title: string, text: string) => void
  resetStatus: () => void
  handleAuthFailure: (actionLabel: string) => void
  handleLookupResult: (result: import('@/types').CashierLookupResult) => void
  handleLookupUnavailable: () => void
  handleLookupFailure: (message: string) => void
  handleSelectionUpdated: (selectionText: string, studentName: string, mealType: MealType) => void
  handleSelectionWithoutLookup: (mealType?: MealType) => void
  handleMealUnavailable: (mealType: MealType, issued: boolean) => void
  handleEmptySelection: (studentName: string) => void
  handleOfflineModeUnavailable: () => void
  handleQueueDuplicate: (request: PendingCashierSelection) => void
  handleQueueEnqueued: (request: PendingCashierSelection) => void
  handleSelectionApplied: (result: MealSelectionResponse, context: PendingCashierSelection) => void
  handleConfirmFailure: (message: string) => void
  handleRetryUnavailable: () => void
  handleQueueEmpty: () => void
  handleQueueOffline: () => void
  handleQueueProcessed: (remainingCount: number) => void
}

export function createCashierTerminalStatusController(
  options: CashierTerminalStatusControllerOptions,
): CashierTerminalStatusController {
  function setStatus(kind: CashierStatusKind, title: string, text: string) {
    options.status.value = { kind, title, text }
  }

  function applyFeedback(feedback: CashierTerminalFeedback) {
    setStatus(feedback.kind, feedback.title, feedback.text)
    if (feedback.eventMessage) {
      options.pushEvent(feedback.eventMessage, feedback.eventTone)
    }
    if (feedback.signal) {
      playCashierSignal(feedback.signal)
    }
    if (feedback.autoReset) {
      options.scheduleAutoReset()
    }
  }

  function resetStatus() {
    options.status.value = { ...INITIAL_STATUS }
  }

  function handleAuthFailure(actionLabel: string) {
    applyFeedback({
      kind: 'error',
      title: 'Сессия истекла',
      text: 'Войдите снова.',
      eventMessage: `${actionLabel}: требуется повторный вход`,
      eventTone: 'danger',
      signal: 'warning',
    })
  }

  function handleLookupResult(result: import('@/types').CashierLookupResult) {
    const available = resolveRemainingMeals(result.remaining_meals, result.today_statuses)
    const issuedTodayMeals = resolveIssuedMeals(result.today_statuses)

    if (!result.student) {
      applyFeedback({
        kind: 'invalid',
        title: 'Талон не найден',
        text: 'Проверьте код',
        eventMessage: `Талон не найден: ${result.query}`,
        eventTone: 'danger',
        signal: 'error',
        autoReset: true,
      })
      return
    }

    if (!hasActiveLookupStudent(result)) {
      applyFeedback({
        kind: 'blocked',
        title: 'Студент выключен',
        text: CASHIER_INACTIVE_STUDENT_MESSAGE,
        eventMessage: `Студент выключен: ${result.student.full_name}`,
        eventTone: 'danger',
        signal: 'error',
        autoReset: true,
      })
      return
    }

    if (result.serving_today === false) {
      const closedState = resolveServiceClosedState(result.serving_block_reason)
      applyFeedback({
        kind: closedState.kind,
        title: 'Выдача закрыта',
        text: closedState.text,
        eventMessage: `Выдача закрыта: ${result.student.full_name}`,
        eventTone: 'warning',
        signal: 'warning',
        autoReset: true,
      })
      return
    }

    if (!result.ticket) {
      applyFeedback({
        kind: 'blocked',
        title: 'Нет активного талона',
        text: 'Выдача недоступна',
        eventMessage: `Нет талона: ${result.student.full_name}`,
        eventTone: 'danger',
        signal: 'error',
        autoReset: true,
      })
      return
    }

    if (!hasActiveLookupTicket(result)) {
      applyFeedback({
        kind: 'blocked',
        title: 'Талон неактивен',
        text: 'Сканируйте действующий талон',
        eventMessage: `Неактивный талон: ${result.student.full_name}`,
        eventTone: 'warning',
        signal: 'warning',
        autoReset: true,
      })
      return
    }

    if (!available.length) {
      applyFeedback({
        kind: 'already_used',
        title: 'Питание уже выдано',
        text: 'На сегодня доступных приемов пищи больше нет',
        eventMessage: `Уже выдано: ${result.student.full_name}`,
        eventTone: 'danger',
        signal: 'error',
        autoReset: true,
      })
      return
    }

    const partialIssuedLabel = issuedTodayMeals.length ? ` · Уже выдано: ${mealsLabel(issuedTodayMeals)}` : ''

    applyFeedback({
      kind: issuedTodayMeals.length ? 'partial_used' : 'success',
      title: issuedTodayMeals.length ? 'Часть питания уже выдана' : 'Питание доступно',
      text: `${mealsLabel(available)}${partialIssuedLabel}`,
      eventMessage: `Талон подтвержден: ${result.student.full_name}`,
      eventTone: issuedTodayMeals.length ? 'warning' : 'success',
      signal: issuedTodayMeals.length ? 'warning' : 'success',
    })
  }

  function handleLookupUnavailable() {
    applyFeedback({
      kind: 'error',
      title: 'Нет связи',
      text: 'Проверка талона недоступна',
      eventMessage: 'Проверка отклонена: нет связи',
      eventTone: 'warning',
      signal: 'warning',
      autoReset: true,
    })
  }

  function handleLookupFailure(message: string) {
    const failure = resolveCashierFailureState(message)
    applyFeedback({
      kind: failure.kind,
      title: failure.title,
      text: failure.text,
      eventMessage: `Ошибка проверки: ${message}`,
      eventTone: 'danger',
      signal: 'error',
      autoReset: true,
    })
  }

  function handleSelectionUpdated(selectionText: string, studentName: string, mealType: MealType) {
    applyFeedback({
      kind: 'info',
      title: 'Подтвердите выдачу',
      text: selectionText,
      eventMessage: `Выбрано: ${mealTypeLabels[mealType]} · ${studentName}`,
      eventTone: 'info',
      signal: 'success',
    })
  }

  function handleSelectionWithoutLookup(mealType?: MealType) {
    applyFeedback({
      kind: 'blocked',
      title: 'Сначала откройте талон',
      text: 'Для выдачи нужен найденный талон',
      eventMessage: mealType
        ? `Выбор отклонен: нет талона (${mealTypeLabels[mealType]})`
        : 'Подтверждение отклонено: нет активного талона',
      eventTone: 'warning',
      signal: 'warning',
      autoReset: true,
    })
  }

  function handleMealUnavailable(mealType: MealType, issued: boolean) {
    applyFeedback({
      kind: issued ? 'already_used' : 'blocked',
      title: issued ? `${mealTypeLabels[mealType]} уже выдан` : `${mealTypeLabels[mealType]} недоступен`,
      text: issued ? 'Повторная выдача запрещена' : 'Выберите доступный прием пищи',
      eventMessage: `Выбор отклонен: ${mealTypeLabels[mealType]} недоступен`,
      eventTone: 'danger',
      signal: 'error',
      autoReset: true,
    })
  }

  function handleEmptySelection(studentName: string) {
    applyFeedback({
      kind: 'blocked',
      title: 'Ничего не выбрано',
      text: 'Выберите прием пищи',
      eventMessage: `Подтверждение отклонено: пустой набор (${studentName})`,
      eventTone: 'warning',
      signal: 'warning',
      autoReset: true,
    })
  }

  function handleOfflineModeUnavailable() {
    applyFeedback({
      kind: 'error',
      title: 'Офлайн недоступен',
      text: 'Офлайн-режим доступен только кассиру',
      eventMessage: 'Офлайн-режим недоступен для этой роли',
      eventTone: 'warning',
      signal: 'warning',
      autoReset: true,
    })
  }

  function handleQueueDuplicate(request: PendingCashierSelection) {
    applyFeedback({
      kind: 'already_used',
      title: 'Уже сохранено без интернета',
      text: `Повторно не выдавать · ${mealsLabel(request.selected_meals)}`,
      eventMessage: `Дубликат в очереди отклонен: ${request.student_name}`,
      eventTone: 'warning',
      signal: 'warning',
      autoReset: true,
    })
  }

  function handleQueueEnqueued(request: PendingCashierSelection) {
    applyFeedback({
      kind: 'queued',
      title: 'Выдайте питание',
      text: `${mealsLabel(request.selected_meals)} · Операция сохранена в офлайн-очереди`,
      eventMessage: `Офлайн-очередь: ${request.student_name}`,
      eventTone: 'warning',
      signal: 'warning',
      autoReset: true,
    })
  }

  function handleSelectionApplied(result: MealSelectionResponse, context: PendingCashierSelection) {
    const issuedLabel = result.issued_meals.length ? mealsLabel(result.issued_meals) : 'Ничего не выдано'
    const alreadyLabel = result.already_issued_meals.length
      ? ` · Уже было: ${mealsLabel(result.already_issued_meals)}`
      : ''
    const hasIssued = result.issued_meals.length > 0

    applyFeedback({
      kind: hasIssued ? 'success' : 'already_used',
      title: hasIssued ? 'Выдача подтверждена' : 'Выдача отклонена',
      text: `${issuedLabel} · ${result.total_amount.toFixed(2)} ₽${alreadyLabel}`,
      eventMessage: `Выдача: ${context.student_name} · ${issuedLabel}`,
      eventTone: hasIssued ? 'success' : 'warning',
      signal: hasIssued ? 'success' : 'error',
      autoReset: true,
    })
  }

  function handleConfirmFailure(message: string) {
    const failure = resolveCashierFailureState(message)
    applyFeedback({
      kind: failure.kind,
      title: failure.title,
      text: failure.text,
      eventMessage: `Ошибка выдачи: ${message}`,
      eventTone: 'danger',
      signal: 'error',
      autoReset: true,
    })
  }

  function handleRetryUnavailable() {
    setStatus('blocked', 'Офлайн недоступен', 'Офлайн-очередь доступна только кассиру')
    options.pushEvent('Повтор очереди недоступен для этой роли', 'warning')
    options.scheduleAutoReset()
  }

  function handleQueueEmpty() {
    applyFeedback({
      kind: 'info',
      title: 'Очередь пуста',
      text: 'Повторять нечего',
      eventMessage: 'Повтор очереди: новых операций нет',
      eventTone: 'info',
      autoReset: true,
    })
  }

  function handleQueueOffline() {
    applyFeedback({
      kind: 'queued',
      title: 'Нет связи',
      text: 'Офлайн-очередь сохранена',
      eventMessage: 'Повтор очереди отклонен: нет связи',
      eventTone: 'warning',
      signal: 'warning',
      autoReset: true,
    })
  }

  function handleQueueProcessed(remainingCount: number) {
    applyFeedback({
      kind: 'info',
      title: 'Очередь обработана',
      text: `Осталось ${remainingCount}`,
      eventMessage: `Очередь обработана: осталось ${remainingCount}`,
      eventTone: 'info',
      signal: 'success',
      autoReset: true,
    })
  }

  return {
    setStatus,
    resetStatus,
    handleAuthFailure,
    handleLookupResult,
    handleLookupUnavailable,
    handleLookupFailure,
    handleSelectionUpdated,
    handleSelectionWithoutLookup,
    handleMealUnavailable,
    handleEmptySelection,
    handleOfflineModeUnavailable,
    handleQueueDuplicate,
    handleQueueEnqueued,
    handleSelectionApplied,
    handleConfirmFailure,
    handleRetryUnavailable,
    handleQueueEmpty,
    handleQueueOffline,
    handleQueueProcessed,
  }
}
