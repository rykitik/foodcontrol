import {
  downloadAccountingCombinedMealSheetPdf,
  downloadAccountingCombinedMealSheetXlsx,
  downloadAccountingCostCalculationPdf,
  downloadAccountingCostCalculationXlsx,
  downloadAccountingCostStatementPdf,
  downloadAccountingCostStatementXlsx,
  downloadAccountingMealSheetPdf,
  downloadAccountingMealSheetXlsx,
  getAccountingCombinedMealSheetDocument,
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
  buildAccountingCombinedMealSheetFilename,
  buildAccountingCostCalculationFilename,
  buildAccountingCostStatementFilename,
  buildAccountingMealSheetFilename,
} from '@/utils/accountingDocumentNames'
import { saveBlob } from '@/utils/files'
import { printDocument } from '@/utils/printDocument'
import { printPdfBlob } from '@/utils/printPdf'
import type {
  AccountingCombinedMealSheetRequest,
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

  if (document.kind === 'combined_meal_sheet') {
    return await getAccountingCombinedMealSheetDocument(buildCombinedMealSheetRequest(document, context), context.token)
  }

  if (document.kind === 'cost_calculation') {
    return await getAccountingCostCalculationDocument(buildCostCalculationRequest(document, context), context.token)
  }

  return await getAccountingCostStatementDocument(buildCostStatementRequest(document, context), context.token)
}

export async function printAccountingDocument(
  document: AccountantDocumentItem,
  printableDocument: PrintableDocument,
  context: AccountantDocumentActionContext,
): Promise<string> {
  let pdfFallbackNotice: string | null = null

  if (printableDocument.pdf_available) {
    try {
      const blob = await loadAccountingDocumentPdf(document, context)
      if (printPdfBlob(blob)) {
        return printAccountingDocumentMessage(document, true)
      }
      pdfFallbackNotice = 'PDF не удалось открыть, использована HTML-печать.'
    } catch {
      pdfFallbackNotice = 'PDF не удалось сформировать, использована HTML-печать.'
    }
  } else {
    pdfFallbackNotice = 'PDF-печать недоступна, использована HTML-печать.'
  }

  const htmlPrintMessage = printAccountingDocumentHtml(document, printableDocument)
  return pdfFallbackNotice ? `${pdfFallbackNotice} ${htmlPrintMessage}` : htmlPrintMessage
}

function printAccountingDocumentHtml(document: AccountantDocumentItem, printableDocument: PrintableDocument): string {
  if (!printDocument(printableDocument)) {
    throw new Error('Не удалось открыть окно печати')
  }

  if (document.kind === 'meal_sheet') {
    return `Открыта печатная форма табеля: ${mealTypeLabels[document.mealType]}, ${document.categoryName}`
  }

  if (document.kind === 'combined_meal_sheet') {
    return `Открыта печатная форма общего табеля: ${document.categoryName}`
  }

  if (document.kind === 'cost_calculation') {
    return `Открыта печатная форма расчёта стоимости: ${document.categoryName}`
  }

  return `Открыта печатная форма ведомости стоимости: ${document.categoryName}`
}

function printAccountingDocumentMessage(document: AccountantDocumentItem, pdf: boolean): string {
  const target = pdf ? 'PDF' : 'печатная форма'
  if (document.kind === 'meal_sheet') {
    return `Открыт ${target} табеля: ${mealTypeLabels[document.mealType]}, ${document.categoryName}`
  }

  if (document.kind === 'combined_meal_sheet') {
    return `Открыт ${target} общего табеля: ${document.categoryName}`
  }

  if (document.kind === 'cost_calculation') {
    return `Открыт ${target} расчёта стоимости: ${document.categoryName}`
  }

  return `Открыт ${target} ведомости стоимости: ${document.categoryName}`
}

async function loadAccountingDocumentPdf(
  document: AccountantDocumentItem,
  context: AccountantDocumentActionContext,
): Promise<Blob> {
  if (document.kind === 'meal_sheet') {
    return await downloadAccountingMealSheetPdf(buildMealSheetRequest(document, context), context.token)
  }

  if (document.kind === 'combined_meal_sheet') {
    return await downloadAccountingCombinedMealSheetPdf(buildCombinedMealSheetRequest(document, context), context.token)
  }

  if (document.kind === 'cost_calculation') {
    return await downloadAccountingCostCalculationPdf(buildCostCalculationRequest(document, context), context.token)
  }

  return await downloadAccountingCostStatementPdf(buildCostStatementRequest(document, context), context.token)
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

  if (document.kind === 'combined_meal_sheet') {
    const blob = await downloadAccountingCombinedMealSheetXlsx(
      buildCombinedMealSheetRequest(document, context),
      context.token,
    )
    saveBlob(blob, buildAccountingCombinedMealSheetFilename(document.categoryCode, context.month, context.year))
    return `Excel-файл общего табеля подготовлен: ${document.categoryName}`
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

function buildCombinedMealSheetRequest(
  document: AccountantDocumentItem,
  context: AccountantDocumentActionContext,
): AccountingCombinedMealSheetRequest {
  return {
    month: context.month,
    year: context.year,
    category_id: document.categoryId,
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
