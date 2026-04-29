import type {
  AccountingCombinedMealSheetRequest,
  AccountingCostCalculationRequest,
  AccountingCostStatementRequest,
  AccountingDocumentGlobalMetadataResetRequest,
  AccountingDocumentGlobalMetadataResponse,
  AccountingDocumentGlobalMetadataSaveRequest,
  AccountingDocumentMetadataResetRequest,
  AccountingDocumentMetadataSaveRequest,
  AccountingMealSheetRequest,
  PrintableDocument,
} from '@/types'

import * as mock from '../mock'
import { authHeaders, requestBlob, requestJson } from '../http'

export async function getMealSheetDocument(
  periodStart: string,
  periodEnd: string,
  token?: string | null,
  options?: { category_id?: number; building_id?: number; status?: string },
): Promise<PrintableDocument> {
  return requestJson(
    '/reports/meal-sheet/document',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, ...(options ?? {}) }),
    },
    () => mock.getMealSheetDocument(periodStart, periodEnd, token, options),
  )
}

export async function getAccountingMealSheetDocument(
  request: AccountingMealSheetRequest,
  token?: string | null,
): Promise<PrintableDocument> {
  return requestJson(
    '/reports/accounting-documents/meal-sheet/document',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.getAccountingMealSheetDocument(request, token),
  )
}

export async function downloadAccountingMealSheetXlsx(
  request: AccountingMealSheetRequest,
  token?: string | null,
): Promise<Blob> {
  return requestBlob(
    '/reports/accounting-documents/meal-sheet/xlsx',
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
    () => mock.downloadAccountingMealSheetXlsx(request, token),
  )
}

export async function getAccountingCombinedMealSheetDocument(
  request: AccountingCombinedMealSheetRequest,
  token?: string | null,
): Promise<PrintableDocument> {
  return requestJson(
    '/reports/accounting-documents/combined-meal-sheet/document',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.getAccountingCombinedMealSheetDocument(request, token),
  )
}

export async function downloadAccountingCombinedMealSheetXlsx(
  request: AccountingCombinedMealSheetRequest,
  token?: string | null,
): Promise<Blob> {
  return requestBlob(
    '/reports/accounting-documents/combined-meal-sheet/xlsx',
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
    () => mock.downloadAccountingCombinedMealSheetXlsx(request, token),
  )
}

export async function getAccountingCostStatementDocument(
  request: AccountingCostStatementRequest,
  token?: string | null,
): Promise<PrintableDocument> {
  return requestJson(
    '/reports/accounting-documents/cost-statement/document',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.getAccountingCostStatementDocument(request, token),
  )
}

export async function downloadAccountingCostStatementXlsx(
  request: AccountingCostStatementRequest,
  token?: string | null,
): Promise<Blob> {
  return requestBlob(
    '/reports/accounting-documents/cost-statement/xlsx',
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
    () => mock.downloadAccountingCostStatementXlsx(request, token),
  )
}

export async function getAccountingCostCalculationDocument(
  request: AccountingCostCalculationRequest,
  token?: string | null,
): Promise<PrintableDocument> {
  return requestJson(
    '/reports/accounting-documents/cost-calculation/document',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.getAccountingCostCalculationDocument(request, token),
  )
}

export async function downloadAccountingCostCalculationXlsx(
  request: AccountingCostCalculationRequest,
  token?: string | null,
): Promise<Blob> {
  return requestBlob(
    '/reports/accounting-documents/cost-calculation/xlsx',
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
    () => mock.downloadAccountingCostCalculationXlsx(request, token),
  )
}

export async function saveAccountingDocumentMetadata(
  request: AccountingDocumentMetadataSaveRequest,
  token?: string | null,
): Promise<PrintableDocument> {
  return requestJson(
    '/reports/accounting-documents/metadata/save',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.saveAccountingDocumentMetadata(request, token),
  )
}

export async function resetAccountingDocumentMetadata(
  request: AccountingDocumentMetadataResetRequest,
  token?: string | null,
): Promise<PrintableDocument> {
  return requestJson(
    '/reports/accounting-documents/metadata/reset',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.resetAccountingDocumentMetadata(request, token),
  )
}

export async function getAccountingDocumentGlobalMetadata(
  token?: string | null,
): Promise<AccountingDocumentGlobalMetadataResponse> {
  return requestJson(
    '/reports/accounting-documents/global-metadata',
    {
      method: 'GET',
      headers: authHeaders(token),
    },
    () => mock.getAccountingDocumentGlobalMetadata(token),
  )
}

export async function saveAccountingDocumentGlobalMetadata(
  request: AccountingDocumentGlobalMetadataSaveRequest,
  token?: string | null,
): Promise<AccountingDocumentGlobalMetadataResponse> {
  return requestJson(
    '/reports/accounting-documents/global-metadata/save',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.saveAccountingDocumentGlobalMetadata(request, token),
  )
}

export async function resetAccountingDocumentGlobalMetadata(
  request: AccountingDocumentGlobalMetadataResetRequest,
  token?: string | null,
): Promise<AccountingDocumentGlobalMetadataResponse> {
  return requestJson(
    '/reports/accounting-documents/global-metadata/reset',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.resetAccountingDocumentGlobalMetadata(request, token),
  )
}
