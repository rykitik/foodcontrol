import { describe, expect, it, vi } from 'vitest'

import type { AccountantMealSheetDocumentItem } from '@/utils/accountingDocumentCatalog'
import type { PrintableDocument } from '@/types'

const apiMocks = vi.hoisted(() => ({
  downloadAccountingCombinedMealSheetPdf: vi.fn(),
  downloadAccountingCombinedMealSheetXlsx: vi.fn(),
  downloadAccountingCostCalculationPdf: vi.fn(),
  downloadAccountingCostCalculationXlsx: vi.fn(),
  downloadAccountingCostStatementPdf: vi.fn(),
  downloadAccountingCostStatementXlsx: vi.fn(),
  downloadAccountingMealSheetPdf: vi.fn(),
  downloadAccountingMealSheetXlsx: vi.fn(),
  getAccountingCombinedMealSheetDocument: vi.fn(),
  getAccountingCostCalculationDocument: vi.fn(),
  getAccountingCostStatementDocument: vi.fn(),
  getAccountingMealSheetDocument: vi.fn(),
  resetAccountingDocumentMetadata: vi.fn(),
  saveAccountingDocumentMetadata: vi.fn(),
}))

const htmlPrintMocks = vi.hoisted(() => ({
  printDocument: vi.fn(),
}))

const pdfPrintMocks = vi.hoisted(() => ({
  printPdfBlob: vi.fn(),
}))

vi.mock('@/services/api', () => apiMocks)
vi.mock('@/utils/printDocument', () => htmlPrintMocks)
vi.mock('@/utils/printPdf', () => pdfPrintMocks)

import { printAccountingDocument } from '@/utils/accountingDocumentActions'

describe('accountingDocumentActions print', () => {
  const document: AccountantMealSheetDocumentItem = {
    key: 'meal-ovz-breakfast',
    kind: 'meal_sheet',
    categoryId: 1,
    categoryCode: 'ovz',
    categoryName: 'ОВЗ',
    title: 'Табель учета питания',
    description: '',
    badgeLabel: 'Завтрак',
    mealType: 'breakfast',
  }

  const printable: PrintableDocument = {
    title: 'Табель',
    subtitle: '02.2025',
    html: '<section class="accounting-worksheet-page"></section>',
    print_mode: 'embedded',
    page_orientation: 'landscape',
  }

  it('uses PDF printing when the backend marks it available', async () => {
    const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    apiMocks.downloadAccountingMealSheetPdf.mockResolvedValueOnce(pdfBlob)
    pdfPrintMocks.printPdfBlob.mockReturnValueOnce(true)
    htmlPrintMocks.printDocument.mockReturnValueOnce(false)

    const message = await printAccountingDocument(
      document,
      { ...printable, pdf_available: true },
      { month: 2, year: 2025, token: 'token' },
    )

    expect(apiMocks.downloadAccountingMealSheetPdf).toHaveBeenCalledWith(
      { month: 2, year: 2025, category_id: 1, meal_type: 'breakfast' },
      'token',
    )
    expect(pdfPrintMocks.printPdfBlob).toHaveBeenCalledWith(pdfBlob)
    expect(htmlPrintMocks.printDocument).not.toHaveBeenCalled()
    expect(message).toContain('PDF')
  })

  it('falls back to HTML printing when PDF generation fails', async () => {
    apiMocks.downloadAccountingMealSheetPdf.mockRejectedValueOnce(new Error('PDF unavailable'))
    htmlPrintMocks.printDocument.mockReturnValueOnce(true)

    const message = await printAccountingDocument(
      document,
      { ...printable, pdf_available: true },
      { month: 2, year: 2025, token: 'token' },
    )

    expect(pdfPrintMocks.printPdfBlob).not.toHaveBeenCalled()
    expect(htmlPrintMocks.printDocument).toHaveBeenCalledWith({ ...printable, pdf_available: true })
    expect(message).toContain('PDF не удалось сформировать')
    expect(message).toContain('HTML-печать')
  })

  it('explains when PDF printing is disabled and HTML fallback is used', async () => {
    htmlPrintMocks.printDocument.mockReturnValueOnce(true)

    const message = await printAccountingDocument(
      document,
      { ...printable, pdf_available: false },
      { month: 2, year: 2025, token: 'token' },
    )

    expect(apiMocks.downloadAccountingMealSheetPdf).not.toHaveBeenCalled()
    expect(htmlPrintMocks.printDocument).toHaveBeenCalledWith({ ...printable, pdf_available: false })
    expect(message).toContain('PDF-печать недоступна')
    expect(message).toContain('HTML-печать')
  })
})
