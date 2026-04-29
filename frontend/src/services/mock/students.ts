import type {
  MealRecord,
  Student,
  StudentCreateRequest,
  StudentGroupFilter,
  StudentHistoryFilter,
  StudentSearchFilter,
  StudentTicketFilter,
  StudentUpdateRequest,
  Ticket,
} from '@/types'
import { filterStudentGroupSuggestions } from '@/utils/studentGroups'

import { readMockDb } from './store'
import {
  appendLog,
  clone,
  ensureBuildingAccess,
  ensureStudentManagementAccess,
  hasStudentAccess,
  mutateDb,
  normalizeQuery,
  requireUser,
  uid,
} from './helpers'
import { enrichTicket, getCategoryById, materializeStudent } from './domain'

const studentCardStart = 100001

function getNextStudentCard(students: Student[]): string {
  let maxStudentCard = studentCardStart - 1

  for (const student of students) {
    const normalizedStudentCard = student.student_card.trim()
    if (!/^\d+$/.test(normalizedStudentCard)) {
      continue
    }
    maxStudentCard = Math.max(maxStudentCard, Number(normalizedStudentCard))
  }

  return String(maxStudentCard + 1)
}

function matchesStudentStatus(student: Student, status: StudentSearchFilter['status']): boolean {
  if (!status || status === 'all') {
    return true
  }

  return status === 'active' ? student.is_active : !student.is_active
}

export function searchStudents(filter: StudentSearchFilter = {}, token?: string | null): Student[] {
  const db = readMockDb()
  const actor = requireUser(token, db)
  const query = normalizeQuery(filter.q)

  return clone(
    db.students
      .map((student) => materializeStudent(student, db))
      .filter((student) => {
        const matchesQuery =
          !query ||
          normalizeQuery(student.full_name).includes(query) ||
          normalizeQuery(student.group_name).includes(query) ||
          normalizeQuery(student.student_card).includes(query)
        const matchesBuilding =
          actor.role === 'social' || actor.role === 'cashier'
            ? hasStudentAccess(actor, student)
            : !filter.building_id || student.building_id === filter.building_id
        const matchesCategory = !filter.category_id || student.category_id === filter.category_id
        const matchesStatus = matchesStudentStatus(student, filter.status)
        return matchesQuery && matchesBuilding && matchesCategory && matchesStatus
      })
      .sort((left, right) => {
        if (left.is_active !== right.is_active) {
          return left.is_active ? -1 : 1
        }

        return left.full_name.localeCompare(right.full_name, 'ru')
      }),
  )
}

export function listStudentGroups(filter: StudentGroupFilter = {}, token?: string | null): string[] {
  const db = readMockDb()
  const actor = requireUser(token, db)
  const seen = new Set<string>()
  const groupNames: string[] = []

  for (const student of db.students) {
    const matchesBuilding =
      actor.role === 'social'
        ? student.building_id === actor.building_id
        : !filter.building_id || student.building_id === filter.building_id
    const groupName = student.group_name.trim()
    const lookupKey = groupName.toLocaleLowerCase('ru-RU')

    if (!matchesBuilding || !groupName || seen.has(lookupKey)) {
      continue
    }

    seen.add(lookupKey)
    groupNames.push(groupName)
  }

  return clone(filterStudentGroupSuggestions(groupNames, filter.q ?? '', filter.limit ?? 20))
}

export function getStudent(id: string, token?: string | null): Student | null {
  const db = readMockDb()
  const actor = requireUser(token, db)
  const student = db.students.find((item) => item.id === id)
  if (!student) {
    return null
  }

  ensureStudentManagementAccess(actor, student)
  return clone(materializeStudent(student, db))
}

export function createStudent(request: StudentCreateRequest, token?: string | null): Student {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    ensureBuildingAccess(actor, request.building_id)

    const studentCard = getNextStudentCard(nextDb.students)
    if (studentCard && nextDb.students.some((student) => student.student_card === studentCard)) {
      throw new Error('Студент с таким номером уже существует')
    }

    const category = getCategoryById(request.category_id, nextDb)
    const student: Student = {
      id: uid('st'),
      full_name: request.full_name.trim(),
      student_card: studentCard,
      group_name: request.group_name.trim(),
      building_id: request.building_id,
      meal_building_id: request.meal_building_id ?? null,
      allow_all_meal_buildings: request.allow_all_meal_buildings ?? false,
      category_id: category.id,
      category: clone(category),
      is_active: request.is_active ?? true,
      active_ticket_id: null,
    }

    nextDb.students.unshift(student)
    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'create_student',
      entity_type: 'student',
      entity_id: student.id,
      details: { category_id: student.category_id, meal_building_id: student.meal_building_id },
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone(materializeStudent(student, nextDb))
  })
}

export function updateStudent(studentId: string, request: StudentUpdateRequest, token?: string | null): Student {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    const student = nextDb.students.find((item) => item.id === studentId)
    if (!student) {
      throw new Error('Студент не найден')
    }

    ensureStudentManagementAccess(actor, student)

    if (request.student_card && nextDb.students.some((item) => item.id !== studentId && item.student_card === request.student_card)) {
      throw new Error('Студент с таким номером уже существует')
    }

    if (request.building_id != null) {
      ensureBuildingAccess(actor, request.building_id)
    }

    if (request.category_id) {
      student.category = clone(getCategoryById(request.category_id, nextDb))
    }

    student.full_name = request.full_name?.trim() ?? student.full_name
    student.student_card = request.student_card?.trim() ?? student.student_card
    student.group_name = request.group_name?.trim() ?? student.group_name
    student.building_id = request.building_id ?? student.building_id
    student.meal_building_id = request.meal_building_id === undefined ? student.meal_building_id ?? null : request.meal_building_id
    student.allow_all_meal_buildings =
      request.allow_all_meal_buildings === undefined
        ? student.allow_all_meal_buildings ?? false
        : request.allow_all_meal_buildings
    student.category_id = request.category_id ?? student.category_id
    student.is_active = request.is_active ?? student.is_active

    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'update_student',
      entity_type: 'student',
      entity_id: studentId,
      details: request as Record<string, unknown>,
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone(materializeStudent(student, nextDb))
  })
}

export function getStudentHistory(
  studentId: string,
  token?: string | null,
  filter: StudentHistoryFilter = {},
): MealRecord[] {
  const db = readMockDb()
  const actor = requireUser(token, db)
  const student = db.students.find((item) => item.id === studentId)
  if (!student) {
    throw new Error('Студент не найден')
  }

  ensureStudentManagementAccess(actor, student)

  return clone(
    db.mealRecords
      .filter((record) => {
        const matchesStudent = record.student_id === studentId
        const matchesStart = !filter.period_start || record.issue_date >= filter.period_start
        const matchesEnd = !filter.period_end || record.issue_date <= filter.period_end
        const matchesMeal = !filter.meal_type || record.meal_type === filter.meal_type
        return matchesStudent && matchesStart && matchesEnd && matchesMeal
      })
      .slice(0, filter.limit ?? 100),
  )
}

export function getStudentTickets(
  studentId: string,
  token?: string | null,
  filter: StudentTicketFilter = {},
): Ticket[] {
  const db = readMockDb()
  const actor = requireUser(token, db)
  const student = db.students.find((item) => item.id === studentId)
  if (!student) {
    throw new Error('Студент не найден')
  }

  ensureStudentManagementAccess(actor, student)

  return clone(
    db.tickets
      .filter((ticket) => ticket.student_id === studentId)
      .map((ticket) => enrichTicket(ticket, db))
      .filter((ticket) => {
        const matchesStatus = !filter.status || ticket.status === filter.status
        const matchesMonth = !filter.month || ticket.month === filter.month
        const matchesYear = !filter.year || ticket.year === filter.year
        return matchesStatus && matchesMonth && matchesYear
      })
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
  )
}
