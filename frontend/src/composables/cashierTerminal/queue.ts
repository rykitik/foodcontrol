import type { Ref } from 'vue'

import { confirmMealSelection } from '@/services/api'
import { recordCashierIssuedMealsForActivePartition } from '@/services/cashierOfflineIssuedLedger'
import {
  CASHIER_OFFLINE_ERROR_CODE,
  isCashierOfflineTransportError,
} from '@/services/cashierRequestErrors'
import { isAuthHttpError, isNetworkRequestError } from '@/services/http'
import type { MealSelectionResponse, MealType } from '@/types'
import type { PendingCashierSelection } from '@/utils/cashierSession'
import { generateCashierRequestId, localDateIso } from '@/utils/cashierTerminal'

import type { CashierTerminalStatusController } from './status'
import { CASHIER_INACTIVE_STUDENT_MESSAGE, canIssueLookupMeals, mealsLabel } from './shared'
import type { CashierTerminalSyncController } from './sync'

interface CashierTerminalQueueAuth {
  token: string | null
}

interface CashierTerminalQueueControllerOptions {
  auth: CashierTerminalQueueAuth
  isOnline: Ref<boolean>
  lookup: Ref<import('@/types').CashierLookupResult | null>
  selectedMeals: Ref<MealType[]>
  loading: Ref<boolean>
  lastQueryValue: Ref<string>
  hasCashierOfflineContext: () => boolean
  cancelAutoReset: () => void
  refreshStats: () => Promise<void>
  resolveLookupWithFallback: (query: string) => Promise<import('@/types').CashierLookupResult>
  notifyServerReachable: () => void
  notifyServerUnavailable: () => void
  statusController: Pick<
    CashierTerminalStatusController,
    | 'setStatus'
    | 'handleAuthFailure'
    | 'handleSelectionUpdated'
    | 'handleSelectionWithoutLookup'
    | 'handleMealUnavailable'
    | 'handleEmptySelection'
    | 'handleOfflineModeUnavailable'
    | 'handleQueueDuplicate'
    | 'handleQueueEnqueued'
    | 'handleSelectionApplied'
    | 'handleConfirmFailure'
  >
  syncController: Pick<
    CashierTerminalSyncController,
    'hasPendingMealConflict' | 'enqueuePendingSelection'
  >
}

export interface CashierTerminalQueueController {
  buildSelectionRequest: (meals: MealType[]) => PendingCashierSelection | null
  selectMeal: (mealType: MealType) => void
  toggleMeal: (mealType: MealType) => void
  commitSelection: (meals: MealType[]) => Promise<void>
  confirmCurrentSelection: () => Promise<void>
  resetSelection: () => void
}

export function createCashierTerminalQueueController(
  options: CashierTerminalQueueControllerOptions,
): CashierTerminalQueueController {
  function resetSelection() {
    options.selectedMeals.value = []
  }

  function buildSelectionRequest(meals: MealType[]): PendingCashierSelection | null {
    const currentLookup = options.lookup.value
    if (!canIssueLookupMeals(currentLookup) || !meals.length) {
      return null
    }

    return {
      request_id: generateCashierRequestId(),
      code: options.lastQueryValue.value || currentLookup.ticket.qr_code || currentLookup.student.student_card,
      selected_meals: [...meals],
      student_id: currentLookup.student.id,
      ticket_id: currentLookup.ticket.id,
      issue_date: localDateIso(),
      created_at: new Date().toISOString(),
      student_name: currentLookup.student.full_name,
      group_name: currentLookup.student.group_name,
    }
  }

  async function queueOfflineSelection(request: PendingCashierSelection) {
    if (!options.hasCashierOfflineContext()) {
      options.statusController.handleOfflineModeUnavailable()
      return
    }

    await options.syncController.enqueuePendingSelection(request)

    try {
      options.lookup.value = await options.resolveLookupWithFallback(request.code)
    } catch {
      // Keep the current lookup on screen if the local state cannot be rebuilt immediately.
    }

    options.statusController.handleQueueEnqueued(request)
    resetSelection()
  }

  function recordConfirmedMeals(result: MealSelectionResponse, context: PendingCashierSelection) {
    if (!result.issued_meals.length) {
      return
    }

    recordCashierIssuedMealsForActivePartition({
      issue_date: context.issue_date || localDateIso(),
      meal_types: result.issued_meals,
      source: 'online_confirmed',
      student_id: context.student_id,
      ticket_id: context.ticket_id,
      request_id: context.request_id,
    })
  }

  async function applySelectionResult(result: MealSelectionResponse, context: PendingCashierSelection) {
    recordConfirmedMeals(result, context)
    await options.refreshStats()

    try {
      options.lookup.value = await options.resolveLookupWithFallback(context.code)
    } catch {
      options.lookup.value = null
    }

    options.statusController.handleSelectionApplied(result, context)
    resetSelection()
  }

  function resolveInvalidMeal(meals: MealType[]): MealType | null {
    const availableMeals = options.lookup.value?.remaining_meals ?? []
    return meals.find((meal) => !availableMeals.includes(meal)) ?? null
  }

  function selectMeal(mealType: MealType) {
    const currentLookup = options.lookup.value
    if (currentLookup?.student && !currentLookup.student.is_active) {
      options.statusController.handleConfirmFailure(CASHIER_INACTIVE_STUDENT_MESSAGE)
      return
    }

    if (!canIssueLookupMeals(currentLookup)) {
      options.statusController.handleSelectionWithoutLookup(mealType)
      return
    }

    if (!(currentLookup.remaining_meals ?? []).includes(mealType)) {
      const issued = currentLookup.today_statuses?.find((item) => item.meal_type === mealType)?.issued ?? false
      options.statusController.handleMealUnavailable(mealType, issued)
      return
    }

    if (!options.selectedMeals.value.includes(mealType)) {
      options.selectedMeals.value = [...options.selectedMeals.value, mealType]
    }

    options.statusController.handleSelectionUpdated(
      mealsLabel(options.selectedMeals.value),
      currentLookup.student.full_name,
      mealType,
    )
  }

  function toggleMeal(mealType: MealType) {
    if (options.selectedMeals.value.includes(mealType)) {
      options.selectedMeals.value = options.selectedMeals.value.filter((item) => item !== mealType)
      if (options.lookup.value?.student) {
        options.statusController.setStatus(
          'info',
          'Набор к выдаче',
          mealsLabel(options.selectedMeals.value) || 'Не выбрано',
        )
      }
      return
    }

    selectMeal(mealType)
  }

  async function commitSelection(meals: MealType[]) {
    const currentLookup = options.lookup.value
    if (currentLookup?.student && !currentLookup.student.is_active) {
      options.statusController.handleConfirmFailure(CASHIER_INACTIVE_STUDENT_MESSAGE)
      return
    }

    if (!canIssueLookupMeals(currentLookup)) {
      options.statusController.handleSelectionWithoutLookup()
      return
    }

    if (!meals.length) {
      options.statusController.handleEmptySelection(currentLookup.student.full_name)
      return
    }

    const invalidMeal = resolveInvalidMeal(meals)
    if (invalidMeal) {
      const issued = currentLookup.today_statuses?.find((item) => item.meal_type === invalidMeal)?.issued ?? false
      options.statusController.handleMealUnavailable(invalidMeal, issued)
      return
    }

    const request = buildSelectionRequest(meals)
    if (!request) {
      return
    }

    if (options.syncController.hasPendingMealConflict(request)) {
      options.statusController.handleQueueDuplicate(request)
      return
    }

    options.loading.value = true
    options.cancelAutoReset()
    options.selectedMeals.value = [...meals]

    try {
      if (!options.isOnline.value) {
        await queueOfflineSelection(request)
        return
      }

      const result = await confirmMealSelection(request, options.auth.token)
      options.notifyServerReachable()
      await applySelectionResult(result, request)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось подтвердить выдачу'
      if (isAuthHttpError(error)) {
        options.statusController.handleAuthFailure('Выдача питания')
      } else if (
        message === CASHIER_OFFLINE_ERROR_CODE ||
        isCashierOfflineTransportError(error) ||
        isNetworkRequestError(error)
      ) {
        options.notifyServerUnavailable()
        await queueOfflineSelection(request)
      } else {
        options.statusController.handleConfirmFailure(message)
        await options.refreshStats()
      }
    } finally {
      options.loading.value = false
    }
  }

  async function confirmCurrentSelection() {
    await commitSelection([...options.selectedMeals.value])
  }

  return {
    buildSelectionRequest,
    selectMeal,
    toggleMeal,
    commitSelection,
    confirmCurrentSelection,
    resetSelection,
  }
}
