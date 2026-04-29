import type {
  PrintableDocument,
  Ticket,
  TicketBulkCreateRequest,
  TicketBulkCreateResponse,
  TicketBulkPreviewResponse,
  TicketCreateRequest,
  TicketFilter,
  TicketPrintPreset,
  TicketUpdateRequest,
} from '@/types'

import { readMockDb } from './store'
import {
  appendLog,
  buildCsvBlob,
  clone,
  ensureBuildingAccess,
  ensureStudentManagementAccess,
  hasStudentAccess,
  matchesAssignedToMealBuilding,
  mutateDb,
  requireUser,
} from './helpers'
import { createTicketEntity, enrichTicket, getEffectiveTicketStatus, materializeStudent } from './domain'
import { buildBulkTicketPreview } from './ticketBulkPreview'
import { buildTicketPrintDocument } from './ticketPrintDocument'
import { resolveMockTicketCreationSegments } from './ticketPeriods'

type TicketCloneRequest = {
  source_month: number
  source_year: number
  target_month: number
  target_year: number
  building_id?: number
  category_id?: number
}

function findStudentByTicket(ticket: Pick<Ticket, 'student_id'>, db = readMockDb()) {
  return db.students.find((item) => item.id === ticket.student_id) ?? null
}

function matchesTicketListScope(
  actor: ReturnType<typeof requireUser>,
  student: NonNullable<ReturnType<typeof findStudentByTicket>>,
  buildingId?: number,
): boolean {
  if (actor.role === 'social' || actor.role === 'cashier') {
    return hasStudentAccess(actor, student)
  }

  return !buildingId || matchesAssignedToMealBuilding(student, buildingId)
}

function resolveDocumentBuildingId(actor: ReturnType<typeof requireUser>, requestedBuildingId?: number): number | undefined {
  if (actor.role !== 'social') {
    return requestedBuildingId
  }

  const buildingId = requestedBuildingId ?? actor.building_id ?? undefined
  ensureBuildingAccess(actor, buildingId)
  return buildingId
}

function listDocumentTickets(
  month: number,
  year: number,
  actor: ReturnType<typeof requireUser>,
  options: { building_id?: number; category_id?: number } | undefined,
  db = readMockDb(),
): Ticket[] {
  const buildingId = resolveDocumentBuildingId(actor, options?.building_id)

  return db.tickets
    .map((ticket) => enrichTicket(ticket, db))
    .filter((ticket) => {
      const student = findStudentByTicket(ticket, db)
      if (!student) {
        return false
      }

      const matchesBuilding = !buildingId || matchesAssignedToMealBuilding(student, buildingId)
      const matchesCategory = !options?.category_id || ticket.category_id === options.category_id
      return ticket.month === month && ticket.year === year && matchesBuilding && matchesCategory
    })
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
}

function buildActiveTicketConflictReason(month: number, year: number): string {
  return `Уже есть активный талон за ${String(month).padStart(2, '0')}.${year}`
}

function resolveBulkPeriod(request: TicketBulkCreateRequest) {
  return resolveMockTicketCreationSegments(request)
}

export function listTickets(filter: TicketFilter = {}, token?: string | null): Ticket[] {
  const db = readMockDb()
  const actor = requireUser(token, db)

  return clone(
    db.tickets
      .map((ticket) => enrichTicket(ticket, db))
      .filter((ticket) => {
        const student = findStudentByTicket(ticket, db)
        if (!student) {
          return false
        }

        const matchesStudent = !filter.student_id || ticket.student_id === filter.student_id
        const matchesBuilding = matchesTicketListScope(actor, student, filter.building_id)
        const matchesCategory = !filter.category_id || ticket.category_id === filter.category_id
        const matchesStatus = !filter.status || ticket.status === filter.status
        const matchesMonth = !filter.month || ticket.month === filter.month
        const matchesYear = !filter.year || ticket.year === filter.year
        const matchesAttention = !filter.attention_only || ticket.requires_attention
        return matchesStudent && matchesBuilding && matchesCategory && matchesStatus && matchesMonth && matchesYear && matchesAttention
      })
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
  )
}

export function exportTicketsXlsx(filter: TicketFilter = {}, token?: string | null): Blob {
  requireUser(token)
  const tickets = listTickets(filter, token)
  return buildCsvBlob([
    ['student_name', 'category_name', 'month', 'year', 'start_date', 'end_date', 'status', 'requires_attention'],
    ...tickets.map((ticket) => [
      ticket.student_name,
      ticket.category_name,
      String(ticket.month),
      String(ticket.year),
      ticket.start_date,
      ticket.end_date,
      ticket.status,
      ticket.requires_attention ? 'yes' : 'no',
    ]),
  ])
}

export function createTicket(request: TicketCreateRequest, token?: string | null): Ticket {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    const student = nextDb.students.find((item) => item.id === request.student_id)
    if (!student) {
      throw new Error('Студент не найден')
    }

    ensureStudentManagementAccess(actor, student)

    const ticket = createTicketEntity(request, actor, nextDb)
    nextDb.tickets.unshift(ticket)
    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'create_ticket',
      entity_type: 'ticket',
      entity_id: ticket.id,
      details: { student_id: ticket.student_id, month: ticket.month, year: ticket.year },
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })
    return clone(enrichTicket(ticket, nextDb))
  })
}

export function createBulkTickets(
  request: TicketBulkCreateRequest,
  token?: string | null,
): TicketBulkCreateResponse {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    const buildingId = request.building_id ?? actor.building_id ?? undefined
    if (actor.role === 'social') {
      ensureBuildingAccess(actor, buildingId)
    }

    const requestedStudentIds = request.student_ids ? Array.from(new Set(request.student_ids)) : null
    const { startDate, endDate, segments } = resolveBulkPeriod(request)

    const students = nextDb.students
      .map((student) => materializeStudent(student, nextDb))
      .filter((student) => {
        const matchesBuilding =
          actor.role === 'social'
            ? student.building_id === actor.building_id
            : !buildingId || matchesAssignedToMealBuilding(student, buildingId)
        const matchesCategory = !request.category_id || student.category_id === request.category_id
        const matchesActive = request.only_active === false || student.is_active
        const matchesSelection = !requestedStudentIds || requestedStudentIds.includes(student.id)
        return matchesBuilding && matchesCategory && matchesActive && matchesSelection
      })

    const created: Ticket[] = []
    const skipped_students: TicketBulkCreateResponse['skipped_students'] = []
    let created_student_count = 0

    if (requestedStudentIds) {
      const accessibleIds = new Set(students.map((student) => student.id))
      requestedStudentIds
        .filter((studentId) => !accessibleIds.has(studentId))
        .forEach((studentId) => {
          skipped_students.push({
            student_id: studentId,
            student_name: '—',
            reason: 'Студент не найден или недоступен для выдачи',
          })
        })
    }

    students.forEach((student) => {
      const conflictingSegment = segments.find((segment) =>
        nextDb.tickets.some(
          (ticket) =>
            ticket.student_id === student.id &&
            ticket.month === segment.month &&
            ticket.year === segment.year &&
            getEffectiveTicketStatus(ticket) === 'active',
        ),
      )

      if (conflictingSegment) {
        skipped_students.push({
          student_id: student.id,
          student_name: student.full_name,
          reason: buildActiveTicketConflictReason(conflictingSegment.month, conflictingSegment.year),
        })
        return
      }

      segments.forEach((segment) => {
        const ticket = createTicketEntity(
          {
            student_id: student.id,
            month: segment.month,
            year: segment.year,
            start_date: segment.start_date,
            end_date: segment.end_date,
          },
          actor,
          nextDb,
        )
        nextDb.tickets.unshift(ticket)
        created.push(enrichTicket(ticket, nextDb))
      })

      created_student_count += 1
    })

    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'create_ticket_bulk',
      entity_type: 'ticket_batch',
      entity_id: null,
      details: {
        created_count: created.length,
        created_student_count,
        skipped_count: skipped_students.length,
        start_date: startDate,
        end_date: endDate,
      },
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone({
      created_count: created.length,
      created_student_count,
      skipped_count: skipped_students.length,
      created,
      skipped_students,
      period_start: startDate,
      period_end: endDate,
    })
  })
}

export function previewBulkTickets(
  request: TicketBulkCreateRequest,
  token?: string | null,
): TicketBulkPreviewResponse {
  const db = readMockDb()
  const actor = requireUser(token, db)
  const preview = buildBulkTicketPreview(request, actor, db)

  return clone({
    period_start: preview.period_start,
    period_end: preview.period_end,
    selected_student_count: preview.selected_student_count,
    accessible_student_count: preview.accessible_student_count,
    issueable_student_count: preview.issueable_student_count,
    total_ticket_count: preview.total_ticket_count,
    month_breakdown: preview.month_breakdown,
    warnings: preview.warnings,
    skipped_students: preview.skipped_students,
  })
}

export function cloneTicketsFromMonth(
  request: TicketCloneRequest,
  token?: string | null,
): TicketBulkCreateResponse {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    const buildingId = request.building_id ?? actor.building_id ?? undefined
    if (actor.role === 'social') {
      ensureBuildingAccess(actor, buildingId)
    }

    const sourceStudentIds = new Set(
      nextDb.tickets
        .filter((ticket) => {
          const student = findStudentByTicket(ticket, nextDb)
          const matchesSource = ticket.month === request.source_month && ticket.year === request.source_year
          const matchesBuilding =
            actor.role === 'social'
              ? student?.building_id === actor.building_id
              : !buildingId || (student ? matchesAssignedToMealBuilding(student, buildingId) : false)
          const matchesCategory = !request.category_id || ticket.category_id === request.category_id
          return matchesSource && matchesBuilding && matchesCategory
        })
        .map((ticket) => ticket.student_id),
    )

    const created: Ticket[] = []
    const skipped_students: TicketBulkCreateResponse['skipped_students'] = []
    let created_student_count = 0

    Array.from(sourceStudentIds).forEach((studentId) => {
      const student = nextDb.students.find((item) => item.id === studentId)
      if (!student) {
        return
      }

      const hasTargetTicket = nextDb.tickets.some(
        (ticket) =>
          ticket.student_id === student.id &&
          ticket.month === request.target_month &&
          ticket.year === request.target_year &&
          getEffectiveTicketStatus(ticket) === 'active',
      )

      if (hasTargetTicket) {
        skipped_students.push({
          student_id: student.id,
          student_name: student.full_name,
          reason: `Уже есть активный талон за ${String(request.target_month).padStart(2, '0')}.${request.target_year}`,
        })
        return
      }

      const ticket = createTicketEntity(
        {
          student_id: student.id,
          month: request.target_month,
          year: request.target_year,
        },
        actor,
        nextDb,
      )
      nextDb.tickets.unshift(ticket)
      created.push(enrichTicket(ticket, nextDb))
      created_student_count += 1
    })

    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'clone_ticket_batch',
      entity_type: 'ticket_batch',
      entity_id: null,
      details: { created_count: created.length, created_student_count, skipped_count: skipped_students.length },
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone({
      created_count: created.length,
      created_student_count,
      skipped_count: skipped_students.length,
      created,
      skipped_students,
    })
  })
}

export function updateTicket(ticketId: string, request: TicketUpdateRequest, token?: string | null): Ticket {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    const ticket = nextDb.tickets.find((item) => item.id === ticketId)
    if (!ticket) {
      throw new Error('Талон не найден')
    }

    const student = findStudentByTicket(ticket, nextDb)
    if (!student) {
      throw new Error('Студент не найден')
    }

    ensureStudentManagementAccess(actor, student)

    if (request.end_date) {
      if (request.status) {
        throw new Error('Изменение срока действия и смена статуса выполняются отдельно')
      }

      if (ticket.status === 'cancelled') {
        throw new Error('У отмененного талона нельзя менять срок действия')
      }

      if (request.end_date < ticket.start_date) {
        throw new Error('Дата окончания не может быть раньше даты начала')
      }

      const mealDates = nextDb.mealRecords
        .filter((item) => item.ticket_id === ticketId)
        .map((item) => item.issue_date)
        .sort()
      const lastMealDate = mealDates[mealDates.length - 1]

      if (lastMealDate && request.end_date < lastMealDate) {
        throw new Error(`Нельзя установить дату окончания раньше последней выдачи питания: ${lastMealDate}`)
      }

      const todayIso = new Date().toISOString().slice(0, 10)
      const nextStatus = request.end_date < todayIso ? 'expired' : 'active'
      if (
        nextStatus === 'active' &&
        ticket.status !== 'active' &&
        nextDb.tickets.some(
          (item) =>
            item.id !== ticketId &&
            item.student_id === ticket.student_id &&
            item.month === ticket.month &&
            item.year === ticket.year &&
            getEffectiveTicketStatus(item) === 'active',
        )
      ) {
        throw new Error(`У студента уже есть активный талон за ${String(ticket.month).padStart(2, '0')}.${ticket.year}`)
      }

      ticket.end_date = request.end_date
      if (ticket.status === 'active' || ticket.status === 'expired') {
        ticket.status = nextStatus
      }

      appendLog(nextDb, {
        user_id: actor.id,
        user_name: actor.full_name,
        action: 'update_ticket_end_date',
        entity_type: 'ticket',
        entity_id: ticketId,
        details: request as Record<string, unknown>,
        ip_address: '127.0.0.1',
        user_agent: 'Mock Browser',
      })

      return clone(enrichTicket(ticket, nextDb))
    }

    const hasMeals = nextDb.mealRecords.some((item) => item.ticket_id === ticketId)
    const nextStatus = request.status ?? ticket.status
    if (hasMeals && nextStatus !== ticket.status && ['active', 'cancelled'].includes(nextStatus)) {
      throw new Error('Нельзя отменять или повторно активировать талон, по которому уже есть выдача питания')
    }

    if (
      nextStatus === 'active' &&
      nextDb.tickets.some(
        (item) =>
          item.id !== ticketId &&
          item.student_id === ticket.student_id &&
          item.month === ticket.month &&
          item.year === ticket.year &&
          getEffectiveTicketStatus(item) === 'active',
      )
    ) {
      throw new Error(`У студента уже есть активный талон за ${String(ticket.month).padStart(2, '0')}.${ticket.year}`)
    }

    ticket.status = nextStatus

    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'update_ticket',
      entity_type: 'ticket',
      entity_id: ticketId,
      details: request as Record<string, unknown>,
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone(enrichTicket(ticket, nextDb))
  })
}

export function reissueTicket(ticketId: string, token?: string | null): Ticket {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    const ticket = nextDb.tickets.find((item) => item.id === ticketId)
    if (!ticket) {
      throw new Error('Талон не найден')
    }

    const student = findStudentByTicket(ticket, nextDb)
    if (!student) {
      throw new Error('Студент не найден')
    }

    ensureStudentManagementAccess(actor, student)

    ticket.status = 'cancelled'
    const replacement = createTicketEntity(
      {
        student_id: ticket.student_id,
        month: ticket.month,
        year: ticket.year,
      },
      actor,
      nextDb,
    )
    nextDb.tickets.unshift(replacement)

    nextDb.mealRecords.forEach((record) => {
      if (record.ticket_id === ticketId) {
        record.ticket_id = replacement.id
      }
    })

    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'reissue_ticket',
      entity_type: 'ticket',
      entity_id: replacement.id,
      details: { previous_ticket_id: ticketId, student_id: replacement.student_id },
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone(enrichTicket(replacement, nextDb))
  })
}

export function getTicketDocument(
  ticketId: string,
  token?: string | null,
  options?: { print_size?: TicketPrintPreset },
): PrintableDocument {
  const db = readMockDb()
  const actor = requireUser(token, db)
  const ticket = db.tickets.find((item) => item.id === ticketId)
  if (!ticket) {
    throw new Error('Талон не найден')
  }

  const student = findStudentByTicket(ticket, db)
  if (!student) {
    throw new Error('Студент не найден')
  }

  ensureStudentManagementAccess(actor, student)
  const enrichedTicket = enrichTicket(ticket, db)

  return buildTicketPrintDocument(
    'Талон на питание',
    `${String(enrichedTicket.month).padStart(2, '0')}.${enrichedTicket.year}`,
    [enrichedTicket],
    options?.print_size ?? 'compact',
  )
}

export function getTicketReceiptSheetDocument(
  month: number,
  year: number,
  token?: string | null,
  options?: { building_id?: number; category_id?: number },
): PrintableDocument {
  const db = readMockDb()
  const actor = requireUser(token, db)
  const tickets = listDocumentTickets(month, year, actor, options, db).filter((ticket) => ticket.status !== 'cancelled')

  return {
    title: 'Ведомость получения талонов',
    subtitle: `${String(month).padStart(2, '0')}.${year}`,
    html: `
      <table class="report-table">
        <thead><tr><th>№</th><th>Студент</th><th>Группа</th><th>Категория</th><th>Подпись</th></tr></thead>
        <tbody>
          ${
            tickets.length
              ? tickets
                  .map(
                    (ticket, index) => `<tr><td>${index + 1}</td><td>${ticket.student_name}</td><td>${ticket.student_name}</td><td>${ticket.category_name}</td><td></td></tr>`,
                  )
                  .join('')
              : '<tr><td colspan="5">Нет талонов за выбранный месяц.</td></tr>'
          }
        </tbody>
      </table>
    `.trim(),
  }
}

export function getTicketPrintSheetDocument(
  month: number,
  year: number,
  token?: string | null,
  options?: { building_id?: number; category_id?: number; print_size?: TicketPrintPreset },
): PrintableDocument {
  const db = readMockDb()
  const actor = requireUser(token, db)
  const tickets = listDocumentTickets(month, year, actor, options, db).filter((ticket) => ticket.status === 'active')
  return buildTicketPrintDocument(
    'Лист талонов на питание',
    `${String(month).padStart(2, '0')}.${year}`,
    tickets,
    options?.print_size ?? 'compact',
  )
}
