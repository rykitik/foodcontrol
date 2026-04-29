import type {
  CashierLookupResult,
  DashboardStats,
  MealRecord,
  MealReport,
  MealSelectionRequest,
  MealSelectionResponse,
  Student,
} from '@/types'

import { readMockDb } from './store'
import { appendLog, clone, formatTime, mutateDb, requireUser, toIsoDate, uid } from './helpers'
import {
  aggregateMealReport,
  buildCashierLookup,
  enrichTicket,
  findActiveTicket,
  getMealPrice,
  getServiceDayContext,
  getTicketMeals,
  getEffectiveTicketStatus,
  normalizeSelectedMeals,
  resolveStudentByCode,
} from './domain'

const INACTIVE_STUDENT_MEAL_ISSUE_MESSAGE = 'Студент выключен. Выдача питания недоступна'

function resolveServingBuildingId(buildingId: number | null | undefined, student: Student): number {
  return buildingId ?? student.effective_meal_building_id ?? student.building_id
}

export function resolveCashierCode(query: string): CashierLookupResult {
  const db = readMockDb()
  const issueDate = toIsoDate(new Date())
  const student = resolveStudentByCode(query, db)
  const ticket = student ? findActiveTicket(student.id, db, issueDate) : null
  const serviceDay = getServiceDayContext(issueDate, db)
  const cashierState = buildCashierLookup(student, ticket, issueDate, db)
  const canIssueMeals = Boolean(student?.is_active)

  return clone({
    query,
    student,
    ticket: ticket ? enrichTicket(ticket, db) : null,
    allowed_meals: canIssueMeals ? (student?.category.meal_types ?? []) : [],
    recent_meals: student
      ? db.mealRecords
          .filter((record) => record.student_id === student.id)
          .sort((left, right) => `${right.issue_date} ${right.issue_time}`.localeCompare(`${left.issue_date} ${left.issue_time}`))
          .slice(0, 5)
      : [],
    today_meals: cashierState.todayMeals,
    issued_today_amount: cashierState.issuedTodayAmount,
    remaining_meals: canIssueMeals ? cashierState.remainingMeals : [],
    today_statuses: cashierState.todayStatuses,
    serving_today: serviceDay.serving_today,
    serving_block_reason: serviceDay.serving_block_reason,
  })
}

export function confirmMealSelection(request: MealSelectionRequest, token?: string | null): MealSelectionResponse {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    const requestId = request.request_id?.trim() || uid('req')
    const previous = nextDb.processedSelections[requestId]
    if (previous) {
      return clone(previous)
    }

    const selectedMeals = normalizeSelectedMeals(request.selected_meals)
    if (!selectedMeals.length) {
      throw new Error('�� ������ �� ���� ����� ����')
    }

    const student = resolveStudentByCode(request.code, nextDb)
    if (!student) {
      throw new Error('������� �� ������')
    }

    if (!student.is_active) {
      throw new Error(INACTIVE_STUDENT_MEAL_ISSUE_MESSAGE)
    }

    const issueDate = request.issue_date ?? toIsoDate(new Date())
    const serviceDay = getServiceDayContext(issueDate, nextDb)
    if (!serviceDay.serving_today) {
      throw new Error(serviceDay.serving_block_reason ?? '������� ������� �� ��������')
    }

    const ticket = findActiveTicket(student.id, nextDb, issueDate)
    if (!ticket) {
      throw new Error('�������� ����� �� ������')
    }
    if (ticket.start_date > issueDate || ticket.end_date < issueDate) {
      throw new Error('����� �� ��������� �� ������� ����')
    }

    const todayMeals = getTicketMeals(ticket.id, issueDate, nextDb)
    const issuedSet = new Set(todayMeals.map((item) => item.meal_type))
    const allowed = new Set(student.category.meal_types)
    const rejected_meals = selectedMeals.filter((meal) => !allowed.has(meal))
    const already_issued_meals = selectedMeals.filter((meal) => issuedSet.has(meal))
    const issued_meals = selectedMeals.filter((meal) => allowed.has(meal) && !issuedSet.has(meal))

    if (!issued_meals.length) {
      throw new Error('��������� ������ ���� ���������� ��� ��� ������')
    }

    const records: MealRecord[] = issued_meals.map((mealType) => ({
      id: uid('mr'),
      ticket_id: ticket.id,
      student_id: student.id,
      student_name: student.full_name,
      meal_type: mealType,
      issue_date: issueDate,
      issue_time: formatTime(),
      issued_by: actor.id,
      issued_by_name: actor.full_name,
      building_id: resolveServingBuildingId(actor.building_id, student),
      category_name: student.category.name,
      price: getMealPrice(student.category, mealType),
      notes: request.notes?.trim() ?? null,
    }))

    nextDb.mealRecords.unshift(...records)

    const response: MealSelectionResponse = {
      records,
      issued_meals,
      already_issued_meals,
      rejected_meals,
      total_amount: Number(records.reduce((sum, record) => sum + record.price, 0).toFixed(2)),
      request_id: requestId,
    }

    nextDb.processedSelections[requestId] = clone(response)
    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'confirm_meal_selection',
      entity_type: 'meal_record',
      entity_id: ticket.id,
      details: { student_id: student.id, request_id: requestId, issued_meals },
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone(response)
  })
}

export function getTodayStats(buildingId?: number): DashboardStats {
  const db = readMockDb()
  const issueDate = toIsoDate(new Date())
  const todayMeals = db.mealRecords.filter(
    (record) => record.issue_date === issueDate && (!buildingId || record.building_id === buildingId),
  )
  const byCategory = new Map<string, { category: string; count: number; amount: number }>()

  todayMeals.forEach((record) => {
    const current = byCategory.get(record.category_name) ?? { category: record.category_name, count: 0, amount: 0 }
    current.count += 1
    current.amount += record.price
    byCategory.set(record.category_name, current)
  })

  const serviceDay = getServiceDayContext(issueDate, db)

  return clone({
    period: issueDate,
    studentsTotal: buildingId
      ? db.students.filter(
          (student) =>
            (student.meal_building_id ?? student.building_id) === buildingId,
        ).length
      : db.students.length,
    ticketsActive: db.tickets.filter((ticket) => {
      const student = db.students.find((item) => item.id === ticket.student_id)
      const matchesBuilding =
        !buildingId ||
        (student ? (student.meal_building_id ?? student.building_id) === buildingId : false)
      return matchesBuilding && getEffectiveTicketStatus(ticket, issueDate) === 'active'
    }).length,
    mealsToday: todayMeals.length,
    breakfastToday: todayMeals.filter((meal) => meal.meal_type === 'breakfast').length,
    lunchToday: todayMeals.filter((meal) => meal.meal_type === 'lunch').length,
    costToday: Number(todayMeals.reduce((sum, meal) => sum + meal.price, 0).toFixed(2)),
    serving_today: serviceDay.serving_today,
    serving_block_reason: serviceDay.serving_block_reason,
    byCategory: Array.from(byCategory.values()).sort((left, right) => right.count - left.count),
  })
}

export function getMealReport(
  periodStart: string,
  periodEnd: string,
  options?: { category_id?: number; building_id?: number; status?: string },
): MealReport {
  return clone(aggregateMealReport(periodStart, periodEnd, options))
}



