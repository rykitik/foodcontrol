import type { Student, TicketBulkCreateRequest, TicketBulkPreviewResponse } from '@/types'

import { getEffectiveTicketStatus, materializeStudent } from './domain'
import { ensureBuildingAccess, matchesAssignedToMealBuilding, requireUser } from './helpers'
import { readMockDb } from './store'
import { resolveMockTicketCreationSegments } from './ticketPeriods'

type MockDb = ReturnType<typeof readMockDb>
type MockActor = ReturnType<typeof requireUser>

function buildActiveTicketConflictReason(month: number, year: number): string {
  return `Уже есть активный талон за ${String(month).padStart(2, '0')}.${year}`
}

function countedWord(count: number, one: string, few: string, many: string): string {
  const remainder100 = count % 100
  const remainder10 = count % 10
  if (remainder100 >= 11 && remainder100 <= 14) {
    return many
  }
  if (remainder10 === 1) {
    return one
  }
  if (remainder10 >= 2 && remainder10 <= 4) {
    return few
  }
  return many
}

function resolveBulkPeriod(request: TicketBulkCreateRequest) {
  return resolveMockTicketCreationSegments(request)
}

function buildWarnings(conflictCount: number, inactiveCount: number, unavailableCount: number) {
  const warnings: TicketBulkPreviewResponse['warnings'] = []
  if (conflictCount > 0) {
    warnings.push({
      code: 'conflict',
      count: conflictCount,
      message: `У ${conflictCount} ${countedWord(conflictCount, 'студента', 'студентов', 'студентов')} уже есть талоны в выбранном периоде`,
    })
  }
  if (inactiveCount > 0) {
    warnings.push({
      code: 'inactive',
      count: inactiveCount,
      message: `${inactiveCount} ${countedWord(inactiveCount, 'студент', 'студента', 'студентов')} неактивны`,
    })
  }
  if (unavailableCount > 0) {
    warnings.push({
      code: 'unavailable',
      count: unavailableCount,
      message: `${unavailableCount} ${countedWord(unavailableCount, 'студент', 'студента', 'студентов')} недоступны для выдачи`,
    })
  }
  return warnings
}

function collectAccessibleStudents(
  request: TicketBulkCreateRequest,
  actor: MockActor,
  db: MockDb,
) {
  const buildingId = request.building_id ?? actor.building_id ?? undefined
  if (actor.role === 'social') {
    ensureBuildingAccess(actor, buildingId)
  }

  const requestedStudentIds = request.student_ids ? Array.from(new Set(request.student_ids.filter(Boolean))) : null
  if (request.student_ids && (!requestedStudentIds || requestedStudentIds.length === 0)) {
    throw new Error('student_ids должны быть непустым списком')
  }

  const allStudents = db.students.map((student) => materializeStudent(student, db))
  const requestedStudentsById = new Map(
    allStudents
      .filter((student) => !requestedStudentIds || requestedStudentIds.includes(student.id))
      .map((student) => [student.id, student]),
  )

  const accessibleStudents = allStudents.filter((student) => {
    const matchesBuilding =
      actor.role === 'social'
        ? student.building_id === actor.building_id
        : !buildingId || matchesAssignedToMealBuilding(student, buildingId)
    const matchesCategory = !request.category_id || student.category_id === request.category_id
    const matchesActive = request.only_active === false || student.is_active
    const matchesSelection = !requestedStudentIds || requestedStudentIds.includes(student.id)
    return matchesBuilding && matchesCategory && matchesActive && matchesSelection
  })

  return { accessibleStudents, requestedStudentIds, requestedStudentsById }
}

export function buildBulkTicketPreview(
  request: TicketBulkCreateRequest,
  actor: MockActor,
  db: MockDb = readMockDb(),
): TicketBulkPreviewResponse & { issueableStudents: Student[] } {
  const { startDate, endDate, segments } = resolveBulkPeriod(request)
  const { accessibleStudents, requestedStudentIds, requestedStudentsById } = collectAccessibleStudents(request, actor, db)
  const skippedStudents: TicketBulkPreviewResponse['skipped_students'] = []

  let inactiveCount = 0
  let unavailableCount = 0
  if (requestedStudentIds) {
    const accessibleIds = new Set(accessibleStudents.map((student) => student.id))
    requestedStudentIds.forEach((studentId) => {
      if (accessibleIds.has(studentId)) {
        return
      }

      const student = requestedStudentsById.get(studentId)
      if (!student) {
        unavailableCount += 1
        skippedStudents.push({
          student_id: studentId,
          student_name: '—',
          reason: 'Студент не найден или недоступен для выдачи',
        })
        return
      }

      if (request.only_active !== false && !student.is_active) {
        inactiveCount += 1
        skippedStudents.push({
          student_id: student.id,
          student_name: student.full_name,
          reason: 'Студент неактивен',
        })
        return
      }

      unavailableCount += 1
      skippedStudents.push({
        student_id: student.id,
        student_name: student.full_name,
        reason: 'Студент недоступен для выдачи',
      })
    })
  }

  const issueableStudents: Student[] = []
  let conflictCount = 0
  accessibleStudents.forEach((student) => {
    const conflictingSegment = segments.find((segment) =>
      db.tickets.some(
        (ticket) =>
          ticket.student_id === student.id &&
          ticket.month === segment.month &&
          ticket.year === segment.year &&
          getEffectiveTicketStatus(ticket) === 'active',
      ),
    )

    if (conflictingSegment) {
      conflictCount += 1
      skippedStudents.push({
        student_id: student.id,
        student_name: student.full_name,
        reason: buildActiveTicketConflictReason(conflictingSegment.month, conflictingSegment.year),
      })
      return
    }

    issueableStudents.push(student)
  })

  return {
    period_start: startDate,
    period_end: endDate,
    selected_student_count: requestedStudentIds?.length ?? accessibleStudents.length,
    accessible_student_count: accessibleStudents.length,
    issueable_student_count: issueableStudents.length,
    total_ticket_count: issueableStudents.length * segments.length,
    month_breakdown: segments.map((segment) => ({
      month: segment.month,
      year: segment.year,
      label: `${String(segment.month).padStart(2, '0')}.${segment.year}`,
      student_count: issueableStudents.length,
      ticket_count: issueableStudents.length,
    })),
    warnings: buildWarnings(conflictCount, inactiveCount, unavailableCount),
    skipped_students: skippedStudents,
    issueableStudents,
  }
}
