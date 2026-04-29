import { mealTypeLabels } from '@/config/options'
import type { CashierLookupResult, MealType } from '@/types'

export const CASHIER_INACTIVE_STUDENT_MESSAGE = 'Студент выключен. Выдача питания недоступна'

export type CashierStatusKind =
  | 'ready'
  | 'success'
  | 'partial_used'
  | 'already_used'
  | 'blocked'
  | 'holiday'
  | 'invalid'
  | 'error'
  | 'queued'
  | 'info'

export interface CashierStatusState {
  kind: CashierStatusKind
  title: string
  text: string
}

export interface CashierStudentView {
  name: string
  group: string
  ticketPeriod: string
  issuedAmount: string
}

type CashierMealStatusLike = {
  meal_type: MealType
  issued: boolean
}

export const INITIAL_STATUS: CashierStatusState = {
  kind: 'ready',
  title: 'Терминал готов',
  text: 'Поднесите талон к сканеру или введите код вручную',
}

export function mealsLabel(meals: MealType[]) {
  return meals.map((meal) => mealTypeLabels[meal]).join(' + ')
}

export function resolveRemainingMeals(
  remainingMeals?: MealType[] | null,
  todayStatuses?: CashierMealStatusLike[] | null,
): MealType[] {
  const explicitRemainingMeals = (remainingMeals ?? []).filter(Boolean)
  if (explicitRemainingMeals.length) {
    return explicitRemainingMeals
  }

  const fallbackMeals = new Set<MealType>()
  ;(todayStatuses ?? []).forEach((item) => {
    if (!item.issued) {
      fallbackMeals.add(item.meal_type)
    }
  })

  return [...fallbackMeals]
}

export function resolveIssuedMeals(todayStatuses?: CashierMealStatusLike[] | null): MealType[] {
  const issuedMeals = new Set<MealType>()
  ;(todayStatuses ?? []).forEach((item) => {
    if (item.issued) {
      issuedMeals.add(item.meal_type)
    }
  })

  return [...issuedMeals]
}

export type CashierLookupWithActiveTicket = CashierLookupResult & {
  ticket: NonNullable<CashierLookupResult['ticket']> & { status: 'active' }
}

export type CashierLookupWithActiveStudent = CashierLookupResult & {
  student: NonNullable<CashierLookupResult['student']> & { is_active: true }
}

export type CashierLookupWithMealIssueAccess = CashierLookupWithActiveStudent & CashierLookupWithActiveTicket

export function hasActiveLookupStudent(
  result: CashierLookupResult | null | undefined,
): result is CashierLookupWithActiveStudent {
  return Boolean(result?.student?.is_active)
}

export function hasActiveLookupTicket(
  result: CashierLookupResult | null | undefined,
): result is CashierLookupWithActiveTicket {
  return Boolean(result?.ticket && result.ticket.status === 'active')
}

export function canIssueLookupMeals(
  result: CashierLookupResult | null | undefined,
): result is CashierLookupWithMealIssueAccess {
  return hasActiveLookupStudent(result) && hasActiveLookupTicket(result)
}

export function buildCurrentStudentView(lookup: CashierLookupResult | null): CashierStudentView | null {
  if (!canIssueLookupMeals(lookup)) {
    return null
  }

  return {
    name: lookup.student.full_name,
    group: lookup.student.group_name,
    ticketPeriod: `${lookup.ticket.start_date} - ${lookup.ticket.end_date}`,
    issuedAmount: `${(lookup.issued_today_amount ?? 0).toFixed(2)} ₽`,
  }
}
