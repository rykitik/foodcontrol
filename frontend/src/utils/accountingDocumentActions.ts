import {
  downloadAccountingCostCalculationXlsx,
  downloadAccountingCostStatementXlsx,
  downloadAccountingMealSheetXlsx,
  getAccountingCostCalculationDocument,
  getAccountingCostStatementDocument,
  getAccountingMealSheetDocument,
  resetAccountingDocumentMetadata as resetAccountingDocumentMetadataRequest,
  saveAccountingDocumentMetadata as saveAccountingDocumentMetadataRequest,
} from '@/services/api'
import { mealTypeLabels } from '@/config/options'
import type {
  AccountantDocumentItem,
  AccountantMealSheetDocumentItem,
} from '@/utils/accountingDocumentCatalog'
import {
  buildAccountingCostCalculationFilename,
  buildAccountingCostStatementFilename,
  buildAccountingMealSheetFilename,
} from '@/utils/accountingDocumentNames'
import { saveBlob } from '@/utils/files'
import { printDocument } from '@/utils/printDocument'
import type {
  AccountingCostCalculationRequest,
  AccountingCostStatementRequest,
  AccountingDocumentMetadataResetRequest,
  AccountingDocumentMetadataSaveRequest,
  AccountingDocumentMetadataValues,
  AccountingMealSheetRequest,
  PrintableDocument,
} from '@/types'

interface AccountantDocumentActionContext {
  month: number
  year: number
  token: string
}

export async function loadAccountingDocument(
  document: AccountantDocumentItem,
  context: AccountantDocumentActionContext,
): Promise<PrintableDocument> {
  if (document.kind === 'meal_sheet') {
    return await getAccountingMealSheetDocument(buildMealSheetRequest(document, context), context.token)
  }

  if (document.kind === 'cost_calculation') {
    return await getAccountingCostCalculationDocument(buildCostCalculationRequest(document, context), context.token)
  }

  return await getAccountingCostStatementDocument(buildCostStatementRequest(document, context), context.token)
}

export function printAccountingDocument(document: AccountantDocumentItem, printableDocument: PrintableDocument): string {
  if (!printDocument(printableDocument)) {
    throw new Error('Не удалось открыть окно печати')
  }

  if (document.kind === 'meal_sheet') {
    return `Открыта печатная форма табеля: ${mealTypeLabels[document.mealType]}, ${document.categoryName}`
  }

  if (document.kind === 'cost_calculation') {
    return `Открыта печатная форма расчёта стоимости: ${document.categoryName}`
  }

  return `Открыта печатная форма ведомости стоимости: ${document.categoryName}`
}

export async function downloadAccountingDocument(
  document: AccountantDocumentItem,
  context: AccountantDocumentActionContext,
): Promise<string> {
  if (document.kind === 'meal_sheet') {
    const blob = await downloadAccountingMealSheetXlsx(buildMealSheetRequest(document, context), context.token)
    saveBlob(
      blob,
      buildAccountingMealSheetFilename(document.categoryCode, document.mealType, context.month, context.year),
    )
    return `Excel-файл табеля подготовлен: ${mealTypeLabels[document.mealType]}, ${document.categoryName}`
  }

  if (document.kind === 'cost_calculation') {
    const blob = await downloadAccountingCostCalculationXlsx(buildCostCalculationRequest(document, context), context.token)
    saveBlob(blob, buildAccountingCostCalculationFilename(document.categoryCode, context.month, context.year))
    return `Excel-файл расчёта стоимости подготовлен: ${document.categoryName}`
  }

  const blob = await downloadAccountingCostStatementXlsx(buildCostStatementRequest(document, context), context.token)
  saveBlob(blob, buildAccountingCostStatementFilename(document.categoryCode, context.month, context.year))
  return `Excel-файл ведомости стоимости подготовлен: ${document.categoryName}`
}

export async function saveAccountingDocumentMetadata(
  document: AccountantDocumentItem,
  context: AccountantDocumentActionContext,
  values: AccountingDocumentMetadataValues,
): Promise<PrintableDocument> {
  const request: AccountingDocumentMetadataSaveRequest = {
    ...buildAccountingDocumentMetadataRequest(document, context),
    values,
  }

  return await saveAccountingDocumentMetadataRequest(request, context.token)
}

export async function resetAccountingDocumentMetadata(
  document: AccountantDocumentItem,
  context: AccountantDocumentActionContext,
): Promise<PrintableDocument> {
  const request: AccountingDocumentMetadataResetRequest = buildAccountingDocumentMetadataRequest(document, context)
  return await resetAccountingDocumentMetadataRequest(request, context.token)
}

function buildMealSheetRequest(
  document: AccountantMealSheetDocumentItem,
  context: AccountantDocumentActionContext,
): AccountingMealSheetRequest {
  return {
    month: context.month,
    year: context.year,
    category_id: document.categoryId,
    meal_type: document.mealType,
  }
}

function buildCostStatementRequest(
  document: AccountantDocumentItem,
  context: AccountantDocumentActionContext,
): AccountingCostStatementRequest {
  return {
    month: context.month,
    year: context.year,
    category_id: document.categoryId,
  }
}

function buildCostCalculationRequest(
  document: AccountantDocumentItem,
  context: AccountantDocumentActionContext,
): AccountingCostCalculationRequest {
  return {
    month: context.month,
    year: context.year,
    category_id: document.categoryId,
  }
}

function buildAccountingDocumentMetadataRequest(
  document: AccountantDocumentItem,
  context: AccountantDocumentActionContext,
): AccountingDocumentMetadataResetRequest {
  return {
    document_kind: document.kind,
    month: context.month,
    year: context.year,
    category_id: document.categoryId,
    ...(document.kind === 'meal_sheet' ? { meal_type: document.mealType } : {}),
  }
}
