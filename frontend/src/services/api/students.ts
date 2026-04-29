import type {
  MealRecord,
  PaginatedResult,
  Student,
  StudentCreateRequest,
  StudentGroupFilter,
  StudentHistoryFilter,
  StudentListFilter,
  StudentSearchFilter,
  StudentTicketFilter,
  StudentUpdateRequest,
  Ticket,
} from '@/types'

import * as mock from '../mock'
import { authHeaders, getStoredToken, requestJson } from '../http'
import { createSearchParams, withQuery } from './shared'

function paginateMockStudents(filter: StudentListFilter = {}): PaginatedResult<Student> {
  const page = Math.max(filter.page ?? 1, 1)
  const pageSize = Math.max(filter.page_size ?? 25, 1)
  const allItems = mock.searchStudents(filter, getStoredToken())
  const start = (page - 1) * pageSize
  return {
    items: allItems.slice(start, start + pageSize),
    page,
    page_size: pageSize,
    total: allItems.length,
  }
}

export async function listStudentsPage(filter: StudentListFilter = {}): Promise<PaginatedResult<Student>> {
  const params = createSearchParams({
    q: filter.q,
    building_id: filter.building_id,
    category_id: filter.category_id,
    status: filter.status,
    page: filter.page,
    page_size: filter.page_size,
  })

  return requestJson(withQuery('/students', params), { method: 'GET', headers: authHeaders() }, () =>
    paginateMockStudents(filter),
  )
}

export async function searchStudents(filter: StudentSearchFilter = {}): Promise<Student[]> {
  const params = createSearchParams({
    q: filter.q,
    building_id: filter.building_id,
    category_id: filter.category_id,
    status: filter.status,
  })

  return requestJson(withQuery('/students/search', params), { method: 'GET', headers: authHeaders() }, () =>
    mock.searchStudents(filter, getStoredToken()),
  )
}

export async function listStudentGroups(filter: StudentGroupFilter = {}): Promise<string[]> {
  const params = createSearchParams({
    q: filter.q,
    building_id: filter.building_id,
    limit: filter.limit,
  })

  return requestJson(withQuery('/students/meta/groups', params), { method: 'GET', headers: authHeaders() }, () =>
    mock.listStudentGroups(filter, getStoredToken()),
  )
}

export async function getStudent(id: string): Promise<Student | null> {
  return requestJson(`/students/${id}`, { method: 'GET', headers: authHeaders() }, () =>
    mock.getStudent(id, getStoredToken()),
  )
}

export async function createStudent(request: StudentCreateRequest, token?: string | null): Promise<Student> {
  return requestJson(
    '/students',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.createStudent(request, token),
  )
}

export async function updateStudent(
  studentId: string,
  request: StudentUpdateRequest,
  token?: string | null,
): Promise<Student> {
  return requestJson(
    `/students/${studentId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.updateStudent(studentId, request, token),
  )
}

export async function getStudentHistory(
  studentId: string,
  token?: string | null,
  filter: StudentHistoryFilter = {},
): Promise<MealRecord[]> {
  const params = createSearchParams({
    period_start: filter.period_start,
    period_end: filter.period_end,
    meal_type: filter.meal_type,
    limit: filter.limit,
  })

  return requestJson(withQuery(`/students/${studentId}/history`, params), { method: 'GET', headers: authHeaders(token) }, () =>
    mock.getStudentHistory(studentId, token ?? getStoredToken(), filter),
  )
}

export async function getStudentTickets(
  studentId: string,
  token?: string | null,
  filter: StudentTicketFilter = {},
): Promise<Ticket[]> {
  const params = createSearchParams({
    status: filter.status,
    month: filter.month,
    year: filter.year,
  })

  return requestJson(withQuery(`/students/${studentId}/tickets`, params), { method: 'GET', headers: authHeaders(token) }, () =>
    mock.getStudentTickets(studentId, token ?? getStoredToken(), filter),
  )
}
