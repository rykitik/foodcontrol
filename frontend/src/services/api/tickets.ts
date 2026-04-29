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

import * as mock from '../mock'
import { authHeaders, getStoredToken, requestBlob, requestJson } from '../http'
import { createSearchParams, withQuery } from './shared'

function createTicketFilterParams(filter: TicketFilter): URLSearchParams {
  return createSearchParams({
    student_id: filter.student_id,
    building_id: filter.building_id,
    status: filter.status,
    month: filter.month,
    year: filter.year,
    category_id: filter.category_id,
    attention_only: filter.attention_only,
  })
}

export async function listTickets(filter: TicketFilter = {}): Promise<Ticket[]> {
  const params = createTicketFilterParams(filter)
  return requestJson(withQuery('/tickets', params), { method: 'GET', headers: authHeaders() }, () =>
    mock.listTickets(filter, getStoredToken()),
  )
}

export async function exportTicketsXlsx(filter: TicketFilter = {}, token?: string | null): Promise<Blob> {
  const params = createTicketFilterParams(filter)
  return requestBlob(
    withQuery('/tickets/export/xlsx', params),
    {
      method: 'GET',
      headers: authHeaders(token),
    },
    () => mock.exportTicketsXlsx(filter, token ?? getStoredToken()),
  )
}

export async function createTicket(request: TicketCreateRequest, token?: string | null): Promise<Ticket> {
  return requestJson(
    '/tickets',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.createTicket(request, token ?? getStoredToken()),
  )
}

export async function createBulkTickets(
  request: TicketBulkCreateRequest,
  token?: string | null,
): Promise<TicketBulkCreateResponse> {
  return requestJson(
    '/tickets/bulk',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.createBulkTickets(request, token ?? getStoredToken()),
  )
}

export async function previewBulkTickets(
  request: TicketBulkCreateRequest,
  token?: string | null,
): Promise<TicketBulkPreviewResponse> {
  return requestJson(
    '/tickets/bulk/preview',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.previewBulkTickets(request, token ?? getStoredToken()),
  )
}

export async function updateTicket(ticketId: string, request: TicketUpdateRequest, token?: string | null): Promise<Ticket> {
  return requestJson(
    `/tickets/${ticketId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.updateTicket(ticketId, request, token ?? getStoredToken()),
  )
}

export async function reissueTicket(ticketId: string, token?: string | null): Promise<Ticket> {
  return requestJson(
    `/tickets/${ticketId}/reissue`,
    {
      method: 'POST',
      headers: authHeaders(token),
    },
    () => mock.reissueTicket(ticketId, token ?? getStoredToken()),
  )
}

export async function getTicketDocument(
  ticketId: string,
  token?: string | null,
  options?: { print_size?: TicketPrintPreset },
): Promise<PrintableDocument> {
  return requestJson(
    `/tickets/${ticketId}/document`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(options ?? {}),
    },
    () => mock.getTicketDocument(ticketId, token ?? getStoredToken(), options),
  )
}

export async function getTicketReceiptSheetDocument(
  month: number,
  year: number,
  token?: string | null,
  options?: { building_id?: number; category_id?: number },
): Promise<PrintableDocument> {
  return requestJson(
    '/tickets/receipt-sheet/document',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ month, year, ...(options ?? {}) }),
    },
    () => mock.getTicketReceiptSheetDocument(month, year, token ?? getStoredToken(), options),
  )
}

export async function getTicketPrintSheetDocument(
  month: number,
  year: number,
  token?: string | null,
  options?: { building_id?: number; category_id?: number; print_size?: TicketPrintPreset },
): Promise<PrintableDocument> {
  return requestJson(
    '/tickets/print-sheet/document',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ month, year, ...(options ?? {}) }),
    },
    () => mock.getTicketPrintSheetDocument(month, year, token ?? getStoredToken(), options),
  )
}
