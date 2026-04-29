import type { PrintableDocument } from '@/types'
import { ACCOUNTING_PRINT_STYLES } from './accountingPrintStyles'
import { SOCIAL_PRINT_STYLES } from './socialPrintStyles'
import { TICKET_PRINT_STYLES } from './ticketPrintStyles'

export function printDocument(document: PrintableDocument): boolean {
  const isTicketSheet = isTicketSheetDocument(document)
  const windowFeatures = isTicketSheet ? 'width=794,height=1123,left=0,top=0' : 'width=1180,height=820'
  const printWindow = window.open('', '_blank', windowFeatures)
  if (!printWindow) {
    return false
  }

  printWindow.document.open()
  printWindow.document.write(buildPrintableHtml(document))
  printWindow.document.close()
  printWindow.focus()
  void printWhenReady(printWindow)
  return true
}

async function printWhenReady(printWindow: Window): Promise<void> {
  const hasFontSet = 'fonts' in printWindow.document
  if (hasFontSet) {
    try {
      await printWindow.document.fonts.ready
    } catch {
      // Ignore font loading failures and continue to print with available layout.
    }
  }

  const raf = printWindow.requestAnimationFrame?.bind(printWindow)
  if (!raf) {
    setTimeout(() => {
      printWindow.print()
    }, 100)
    return
  }

  raf(() => {
    raf(() => {
      printWindow.print()
    })
  })
}

export function buildPrintableHtml(document: PrintableDocument) {
  const isTicketSheet = isTicketSheetDocument(document)
  const isEmbedded = document.print_mode === 'embedded'
  const pageOrientation = isTicketSheet ? 'portrait' : (document.page_orientation ?? 'portrait')
  const pageMargin = isTicketSheet ? '0' : isEmbedded ? '7mm' : pageOrientation === 'landscape' ? '6mm' : '10mm'
  const pageTitle = isTicketSheet ? '' : document.title

  return `<!doctype html>
  <html lang="ru">
    <head>
      <meta charset="UTF-8" />
      <title>${pageTitle}</title>
      <style>
        @page { size: A4 ${pageOrientation}; margin: ${pageMargin}; }
        html, body { width: 100%; min-height: 100%; }
        body { font-family: "Segoe UI", Arial, sans-serif; margin: 10px; color: #111827; }
        body.embedded-print-body { margin: 0; }
        .report-header { margin-bottom: 8px; }
        .report-header h1 { margin: 0 0 4px; font-size: 20px; }
        .report-header p { margin: 0; font-size: 13px; }
        .doc-title { text-align: center; font-size: 24px; font-weight: 700; margin-bottom: 6px; }
        .doc-subtitle, .doc-org { text-align: center; margin-bottom: 6px; }
        .doc-inline-meta { display: flex; justify-content: space-between; gap: 12px; margin: 8px 0; font-size: 12px; }
        .report-table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        .report-table th, .report-table td { border: 1px solid #111827; padding: 6px; font-size: 13px; vertical-align: top; }
        .report-table-wide th, .report-table-wide td { padding: 4px; font-size: 11px; }
        .student-col { min-width: 180px; }
        .day-col, .day-cell, .day-total { width: 26px; text-align: center; }
        .day-cell { font-weight: 700; line-height: 1.1; }
        .totals-row td, .grand-total td { font-weight: 700; }
        .report-footer { margin-top: 20px; }
        .totals { margin-top: 10px; font-weight: 700; }
        .signatures { display: flex; flex-direction: column; gap: 12px; margin-top: 18px; }
        .signature-line { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; }

        @media print {
          body { margin: 0; }
          .report-header { margin-bottom: 4px; }
          .report-header h1 { font-size: 16px; margin-bottom: 2px; }
          .report-header p { font-size: 11px; }
        }

        ${TICKET_PRINT_STYLES}
        ${ACCOUNTING_PRINT_STYLES}
        ${SOCIAL_PRINT_STYLES}
      </style>
    </head>
    <body class="${isTicketSheet ? 'ticket-sheet-print' : ''} ${isEmbedded ? 'embedded-print-body' : ''}">
      ${
        isEmbedded || isTicketSheet
          ? document.html
          : `
      <div class="report-header">
        <h1>${document.title}</h1>
        <p>${document.subtitle}</p>
      </div>
      ${document.html}`
      }
    </body>
  </html>`
}

function isTicketSheetDocument(document: PrintableDocument): boolean {
  return document.html.includes('ticket-sheet-page') || document.html.includes('ticket-print-grid')
}
