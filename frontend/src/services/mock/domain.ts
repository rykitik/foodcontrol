import type {
  CashierLookupResult,
  Category,
  MealRecord,
  MealReport,
  MealType,
  Student,
  Ticket,
  TicketCreateRequest,
  TicketStatus,
} from '@/types'

import type { MockDatabase, MockUser } from './data'
import { readMockDb } from './store'
import { clone, normalizeQuery, toIsoDate, uid } from './helpers'
import { resolveMockTicketCreationPeriod } from './ticketPeriods'

export function getCategoryById(categoryId: number, db = readMockDb()): Category {
  const category = db.categories.find((item) => item.id === categoryId)
  if (!category) {
    throw new Error('Категория не найдена')
  }
  return category
}

export function getEffectiveTicketStatus(ticket: Ticket, referenceDate = toIsoDate(new Date())): TicketStatus {
  if (ticket.status === 'active' && ticket.end_date < referenceDate) {
    return 'expired'
  }
  return ticket.status
}

export function findActiveTicket(studentId: string, db = readMockDb(), issueDate = toIsoDate(new Date())): Ticket | null {
  return (
    db.tickets
      .filter((ticket) => ticket.student_id === studentId && getEffectiveTicketStatus(ticket, issueDate) === 'active')
      .sort((left, right) => right.created_at.localeCompare(left.created_at))[0] ?? null
  )
}

export function materializeStudent(student: Student, db = readMockDb()): Student {
  const effectiveMealBuildingId = student.meal_building_id ?? student.building_id
  return {
    ...student,
    category: clone(getCategoryById(student.category_id, db)),
    building_name: `Корпус ${student.building_id}`,
    meal_building_name: student.meal_building_id ? `Корпус ${student.meal_building_id}` : null,
    allow_all_meal_buildings: student.allow_all_meal_buildings ?? false,
    effective_meal_building_id: effectiveMealBuildingId,
    effective_meal_building_name: `Корпус ${effectiveMealBuildingId}`,
    active_ticket_id: findActiveTicket(student.id, db)?.id ?? null,
  }
}

export function enrichTicket(ticket: Ticket, db = readMockDb()): Ticket {
  const currentDate = toIsoDate(new Date())
  const mealRecordsCount = db.mealRecords.filter((record) => record.ticket_id === ticket.id).length
  const hasConflict = db.tickets.some(
    (item) =>
      item.id !== ticket.id &&
      item.student_id === ticket.student_id &&
      item.month === ticket.month &&
      item.year === ticket.year &&
      getEffectiveTicketStatus(item, currentDate) === 'active',
  )

  const student = db.students.find((item) => item.id === ticket.student_id)
  const effectiveMealBuildingId = student?.meal_building_id ?? student?.building_id

  return {
    ...ticket,
    building_id: effectiveMealBuildingId,
    building_name: effectiveMealBuildingId ? `Корпус ${effectiveMealBuildingId}` : null,
    source_building_id: student?.building_id,
    source_building_name: student?.building_id ? `Корпус ${student.building_id}` : null,
    status: getEffectiveTicketStatus(ticket, currentDate),
    meal_building_id: student?.meal_building_id ?? null,
    meal_building_name: student?.meal_building_id ? `Корпус ${student.meal_building_id}` : null,
    allow_all_meal_buildings: student?.allow_all_meal_buildings ?? false,
    effective_meal_building_id: effectiveMealBuildingId,
    effective_meal_building_name: effectiveMealBuildingId ? `Корпус ${effectiveMealBuildingId}` : null,
    meal_records_count: mealRecordsCount,
    is_locked: mealRecordsCount > 0,
    is_overdue: ticket.end_date < currentDate,
    requires_attention: ticket.end_date < currentDate || hasConflict,
  }
}

export function resolveStudentByCode(query: string, db = readMockDb()): Student | null {
  const normalized = normalizeQuery(query)
  if (!normalized) {
    return null
  }
  const printLookupCode = normalized.split('|', 1)[0]?.split(/-p/i, 1)[0] ?? normalized
  const ticketLookupCode = printLookupCode.replace(/-(bl|b|l)$/i, '')

  const byTicket = db.tickets.find(
    (ticket) =>
      normalizeQuery(ticket.qr_code) === ticketLookupCode ||
      normalizeQuery(ticket.id) === ticketLookupCode ||
      normalizeQuery(ticket.qr_code) === normalized ||
      normalizeQuery(ticket.id) === normalized,
  )
  if (byTicket) {
    const student = db.students.find((item) => item.id === byTicket.student_id)
    return student ? materializeStudent(student, db) : null
  }

  const student = db.students.find(
    (item) =>
      normalizeQuery(item.student_card) === normalized ||
      normalizeQuery(item.id) === normalized ||
      normalizeQuery(item.full_name).includes(normalized),
  )

  return student ? materializeStudent(student, db) : null
}

export function getMealPrice(category: Category, mealType: MealType): number {
  return category.meal_prices?.[mealType] ?? 0
}

export function getServiceDayContext(issueDate: string, db = readMockDb()) {
  const date = new Date(`${issueDate}T12:00:00`)
  const weekDay = date.getDay()
  if (weekDay === 0) {
    return { serving_today: false, serving_block_reason: 'Сегодня выходной. Питание не выдается.' }
  }
  if (db.holidays.some((item) => item.is_active && item.holiday_date === issueDate)) {
    return { serving_today: false, serving_block_reason: 'Сегодня праздничный день. Питание не выдается.' }
  }
  return { serving_today: true, serving_block_reason: null as string | null }
}

export function getTicketMeals(ticketId: string, issueDate: string, db = readMockDb()): MealRecord[] {
  return db.mealRecords.filter((record) => record.ticket_id === ticketId && record.issue_date === issueDate)
}

export function buildCashierLookup(
  student: Student | null,
  ticket: Ticket | null,
  issueDate: string,
  db = readMockDb(),
) {
  if (!student || !ticket) {
    return {
      todayMeals: [] as MealRecord[],
      remainingMeals: [] as MealType[],
      todayStatuses: [] as CashierLookupResult['today_statuses'],
      issuedTodayAmount: 0,
    }
  }

  const todayMeals = getTicketMeals(ticket.id, issueDate, db)
  const issuedSet = new Set(todayMeals.map((item) => item.meal_type))
  const todayStatuses = student.category.meal_types.map((mealType) => {
    const record = todayMeals.find((item) => item.meal_type === mealType)
    return {
      meal_type: mealType,
      issued: issuedSet.has(mealType),
      price: getMealPrice(student.category, mealType),
      issue_time: record?.issue_time ?? null,
    }
  })

  return {
    todayMeals,
    remainingMeals: todayStatuses.filter((status) => !status.issued).map((status) => status.meal_type),
    todayStatuses,
    issuedTodayAmount: todayMeals.reduce((sum, item) => sum + item.price, 0),
  }
}

export function normalizeSelectedMeals(meals: unknown): MealType[] {
  if (!Array.isArray(meals)) {
    return []
  }

  const selected: MealType[] = []
  for (const meal of meals) {
    if ((meal === 'breakfast' || meal === 'lunch') && !selected.includes(meal)) {
      selected.push(meal)
    }
  }
  return selected
}

export function aggregateMealReport(
  periodStart: string,
  periodEnd: string,
  options: { category_id?: number; building_id?: number; status?: string } | undefined,
  db = readMockDb(),
): MealReport {
  const rows = new Map<string, { category: string; meal_type: MealType; count: number; amount: number }>()
  let totalCount = 0
  let totalAmount = 0

  db.mealRecords
    .filter((record) => record.issue_date >= periodStart && record.issue_date <= periodEnd)
    .forEach((record) => {
      const student = db.students.find((item) => item.id === record.student_id)
      const ticket = db.tickets.find((item) => item.id === record.ticket_id)
      const ticketStatus = ticket ? getEffectiveTicketStatus(ticket, periodEnd) : null

      if (options?.category_id && student?.category_id !== options.category_id) return
      if (options?.building_id && record.building_id !== options.building_id) return
      if (options?.status && ticketStatus !== options.status) return

      const key = `${record.category_name}:${record.meal_type}`
      const current = rows.get(key) ?? { category: record.category_name, meal_type: record.meal_type, count: 0, amount: 0 }
      current.count += 1
      current.amount += record.price
      totalCount += 1
      totalAmount += record.price
      rows.set(key, current)
    })

  return {
    period_start: periodStart,
    period_end: periodEnd,
    rows: Array.from(rows.values()).sort((left, right) =>
      left.category === right.category ? left.meal_type.localeCompare(right.meal_type) : left.category.localeCompare(right.category),
    ),
    totals: { count: totalCount, amount: Number(totalAmount.toFixed(2)) },
  }
}

export function createTicketEntity(request: TicketCreateRequest, author: MockUser, db: MockDatabase): Ticket {
  const student = db.students.find((item) => item.id === request.student_id)
  if (!student) {
    throw new Error('Студент не найден')
  }

  const duplicate = db.tickets.some(
    (ticket) =>
      ticket.student_id === request.student_id &&
      ticket.month === request.month &&
      ticket.year === request.year &&
      getEffectiveTicketStatus(ticket) === 'active',
  )

  if (duplicate) {
    throw new Error('У студента уже есть активный талон за этот месяц')
  }

  const category = getCategoryById(student.category_id, db)
  const ticketId = uid('tk')
  const resolvedPeriod = resolveMockTicketCreationPeriod(request)
  const startDate = new Date(`${resolvedPeriod.startDate}T12:00:00`)
  const endDate = new Date(`${resolvedPeriod.endDate}T12:00:00`)
  const month = startDate.getMonth() + 1
  const year = startDate.getFullYear()

  return {
    id: ticketId,
    student_id: student.id,
    student_name: student.full_name,
    category_id: category.id,
    category_name: category.name,
    month,
    year,
    start_date: toIsoDate(startDate),
    end_date: toIsoDate(endDate),
    status: 'active',
    qr_code: ticketId,
    created_by: author.id,
    created_by_name: author.full_name,
    created_at: new Date().toISOString(),
  }
}
