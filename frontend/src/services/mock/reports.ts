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

import { aggregateMealReport } from './domain'
import { requireUser } from './helpers'

const mockGlobalMetadataValues: AccountingDocumentGlobalMetadataResponse['values'] = {}

export function getMealSheetDocument(
  periodStart: string,
  periodEnd: string,
  token?: string | null,
  options?: { category_id?: number; building_id?: number; status?: string },
): PrintableDocument {
  const user = requireUser(token)
  const signatures = [`<div>Составил: ${user.full_name}</div>`]
  if (user.role !== 'social') {
    signatures.push('<div>Проверил: М.М. Суткова</div>')
  }
  const summary = aggregateMealReport(periodStart, periodEnd, options)
  return {
    title: 'Итоговая ведомость питания',
    subtitle: `Период: ${periodStart} - ${periodEnd}`,
    page_orientation: 'landscape',
    html: `
      <section class="social-meal-sheet-page">
        <table class="report-table report-table-wide social-meal-sheet-table">
          <tbody>
          <tr><td>Строк</td><td>${summary.rows.length}</td></tr>
          <tr><td>Сумма</td><td>${summary.totals.amount} ₽</td></tr>
          <tr><td>Период</td><td>${periodStart} - ${periodEnd}</td></tr>
          </tbody>
        </table>
        <div class="mock-signatures">${signatures.join('')}</div>
      </section>
    `.trim(),
  }
}

export function getAccountingMealSheetDocument(
  request: AccountingMealSheetRequest,
  token?: string | null,
): PrintableDocument {
  requireUser(token)
  return {
    title: 'Накопительная ведомость по питанию',
    subtitle: `за ${String(request.month).padStart(2, '0')}.${request.year}`,
    print_mode: 'embedded',
    page_orientation: 'landscape',
    html: `
      <section class="accounting-form-page accounting-form-page-landscape">
        <div class="accounting-form accounting-form-meal-sheet">
          <div class="accounting-form-head">
            <div class="accounting-form-title">Накопительная ведомость по питанию</div>
            <div class="accounting-form-period">Mock-документ за ${String(request.month).padStart(2, '0')}.${request.year}</div>
          </div>
          <table class="accounting-grid accounting-grid-meal-sheet">
            <thead>
              <tr>
                <th>№</th>
                <th>Студент</th>
                <th>Дата</th>
                <th>1</th>
                <th>Итого</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Mock студент</td>
                <td></td>
                <td class="accounting-day-cell">X</td>
                <td>95.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `.trim(),
  }
}

export function downloadAccountingMealSheetXlsx(
  request: AccountingMealSheetRequest,
  token?: string | null,
): Blob {
  requireUser(token)
  return new Blob([`Meal sheet ${request.category_id} ${request.meal_type}`], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function getAccountingCombinedMealSheetDocument(
  request: AccountingCombinedMealSheetRequest,
  token?: string | null,
): PrintableDocument {
  requireUser(token)
  return {
    title: 'Табель учета питания (общий)',
    subtitle: `за ${String(request.month).padStart(2, '0')}.${request.year}`,
    print_mode: 'embedded',
    page_orientation: 'landscape',
    html: `
      <section class="accounting-form-page accounting-form-page-landscape">
        <div class="accounting-form accounting-form-meal-sheet">
          <div class="accounting-form-head">
            <div class="accounting-form-title">Табель учета питания (общий)</div>
            <div class="accounting-form-period">З - завтрак, О - обед</div>
          </div>
          <table class="accounting-grid accounting-grid-meal-sheet">
            <thead>
              <tr>
                <th>№</th>
                <th>Студент</th>
                <th>1</th>
                <th>Завтрак</th>
                <th>Обед</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Mock студент</td>
                <td class="accounting-day-cell">З/О</td>
                <td>1</td>
                <td>1</td>
                <td>260.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `.trim(),
  }
}

export function downloadAccountingCombinedMealSheetXlsx(
  request: AccountingCombinedMealSheetRequest,
  token?: string | null,
): Blob {
  requireUser(token)
  return new Blob([`Combined meal sheet ${request.category_id}`], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function getAccountingCostStatementDocument(
  request: AccountingCostStatementRequest,
  token?: string | null,
): PrintableDocument {
  requireUser(token)
  return {
    title: 'ВЕДОМОСТЬ',
    subtitle: `Mock-документ за ${String(request.month).padStart(2, '0')}.${request.year}`,
    print_mode: 'embedded',
    page_orientation: 'portrait',
    html: `
      <section class="accounting-form-page accounting-form-page-portrait">
        <div class="accounting-form accounting-form-cost-statement">
          <div class="accounting-statement-head">
            <div class="accounting-statement-main">
              <div class="accounting-statement-title">ВЕДОМОСТЬ</div>
              <div class="accounting-statement-subtitle">стоимости предоставленного питания студентам колледжа</div>
            </div>
          </div>
          <table class="accounting-grid accounting-grid-cost-statement">
            <thead>
              <tr>
                <th>№</th>
                <th>ФИО</th>
                <th>Группа</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Mock студент</td>
                <td>ГР-101</td>
                <td>150.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `.trim(),
  }
}

export function downloadAccountingCostStatementXlsx(
  request: AccountingCostStatementRequest,
  token?: string | null,
): Blob {
  requireUser(token)
  return new Blob([`Cost statement ${request.category_id}`], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function getAccountingCostCalculationDocument(
  request: AccountingCostCalculationRequest,
  token?: string | null,
): PrintableDocument {
  requireUser(token)
  return {
    title: 'Расчет стоимости предоставленного питания',
    subtitle: `Mock-документ за ${String(request.month).padStart(2, '0')}.${request.year}`,
    print_mode: 'embedded',
    page_orientation: 'portrait',
    html: `
      <section class="accounting-form-page accounting-form-page-portrait">
        <div class="accounting-form accounting-form-cost-calculation">
          <div class="accounting-statement-head">
            <div class="accounting-statement-main">
              <div class="accounting-statement-title">РАСЧЕТ</div>
              <div class="accounting-statement-subtitle">стоимости предоставленного питания</div>
            </div>
          </div>
          <table class="accounting-grid accounting-grid-cost-statement">
            <thead>
              <tr>
                <th>№</th>
                <th>ФИО</th>
                <th>Дней</th>
                <th>Питание</th>
                <th>К выдаче</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Mock студент</td>
                <td>26</td>
                <td>175.00</td>
                <td>8191.80</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `.trim(),
  }
}

export function downloadAccountingCostCalculationXlsx(
  request: AccountingCostCalculationRequest,
  token?: string | null,
): Blob {
  requireUser(token)
  return new Blob([`Cost calculation ${request.category_id}`], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function saveAccountingDocumentMetadata(
  request: AccountingDocumentMetadataSaveRequest,
  token?: string | null,
): PrintableDocument {
  requireUser(token)
  return resolveMockAccountingDocument(request, token)
}

export function resetAccountingDocumentMetadata(
  request: AccountingDocumentMetadataResetRequest,
  token?: string | null,
): PrintableDocument {
  requireUser(token)
  return resolveMockAccountingDocument(request, token)
}

export function getAccountingDocumentGlobalMetadata(
  token?: string | null,
): AccountingDocumentGlobalMetadataResponse {
  requireUser(token)
  return { values: { ...mockGlobalMetadataValues } }
}

export function saveAccountingDocumentGlobalMetadata(
  request: AccountingDocumentGlobalMetadataSaveRequest,
  token?: string | null,
): AccountingDocumentGlobalMetadataResponse {
  requireUser(token)
  Object.assign(mockGlobalMetadataValues, request.values)
  return { values: { ...mockGlobalMetadataValues } }
}

export function resetAccountingDocumentGlobalMetadata(
  request: AccountingDocumentGlobalMetadataResetRequest,
  token?: string | null,
): AccountingDocumentGlobalMetadataResponse {
  requireUser(token)
  if (!request.keys?.length) {
    for (const key of Object.keys(mockGlobalMetadataValues)) {
      delete mockGlobalMetadataValues[key]
    }
    return { values: {} }
  }

  for (const key of request.keys) {
    delete mockGlobalMetadataValues[key]
  }
  return { values: { ...mockGlobalMetadataValues } }
}

function resolveMockAccountingDocument(
  request: AccountingDocumentMetadataSaveRequest | AccountingDocumentMetadataResetRequest,
  token?: string | null,
): PrintableDocument {
  if (request.document_kind === 'meal_sheet') {
    return getAccountingMealSheetDocument(
      {
        month: request.month,
        year: request.year,
        category_id: request.category_id,
        meal_type: request.meal_type ?? 'breakfast',
      },
      token,
    )
  }

  if (request.document_kind === 'combined_meal_sheet') {
    return getAccountingCombinedMealSheetDocument(
      {
        month: request.month,
        year: request.year,
        category_id: request.category_id,
      },
      token,
    )
  }

  if (request.document_kind === 'cost_calculation') {
    return getAccountingCostCalculationDocument(
      {
        month: request.month,
        year: request.year,
        category_id: request.category_id,
      },
      token,
    )
  }

  return getAccountingCostStatementDocument(
    {
      month: request.month,
      year: request.year,
      category_id: request.category_id,
    },
    token,
  )
}
