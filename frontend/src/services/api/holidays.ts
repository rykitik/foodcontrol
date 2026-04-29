import type {
  HolidayCreateRequest,
  HolidayEntry,
  HolidayRangeCreateRequest,
  HolidayRangeCreateResponse,
  HolidayUpdateRequest,
} from '@/types'

import * as mock from '../mock'
import { authHeaders, requestJson } from '../http'
import { createSearchParams, withQuery } from './shared'

export async function listHolidays(filter?: {
  year?: number
  month?: number
  start_date?: string
  end_date?: string
  include_inactive?: boolean
}): Promise<HolidayEntry[]> {
  const params = createSearchParams({
    year: filter?.year,
    month: filter?.month,
    start_date: filter?.start_date,
    end_date: filter?.end_date,
    include_inactive: filter?.include_inactive,
  })

  return requestJson(withQuery('/holidays', params), { method: 'GET', headers: authHeaders() }, () => mock.listHolidays(filter))
}

export async function createHoliday(request: HolidayCreateRequest, token?: string | null): Promise<HolidayEntry> {
  return requestJson(
    '/holidays',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.createHoliday(request, token),
  )
}

export async function createHolidayRange(
  request: HolidayRangeCreateRequest,
  token?: string | null,
): Promise<HolidayRangeCreateResponse> {
  return requestJson(
    '/holidays/bulk',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.createHolidayRange(request, token),
  )
}

export async function updateHoliday(
  holidayId: number,
  request: HolidayUpdateRequest,
  token?: string | null,
): Promise<HolidayEntry> {
  return requestJson(
    `/holidays/${holidayId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.updateHoliday(holidayId, request, token),
  )
}

export async function deleteHoliday(holidayId: number, token?: string | null): Promise<void> {
  return requestJson(
    `/holidays/${holidayId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
    () => mock.deleteHoliday(holidayId, token),
  )
}
