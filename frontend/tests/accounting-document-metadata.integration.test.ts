import { describe, expect, it } from 'vitest'

import type { PrintableDocument } from '@/types'
import {
  detectAccountingDocumentMetadataSupport,
  hasCustomAccountingDocumentMetadata,
  resolveAccountingDocumentMetadata,
} from '@/utils/accountingDocumentMetadata'

describe('accountingDocumentMetadata', () => {
  const printable: PrintableDocument = {
    title: 'Ведомость стоимости',
    subtitle: 'Апрель 2026',
    html: '<table><tr><td data-accounting-cell="I8">21.04.2026</td></tr></table>',
    print_mode: 'embedded',
    editable_metadata: [
      {
        key: 'reportDate',
        label: 'Дата составления',
        section: 'Коды и даты',
        cell: 'I8',
        mode: 'value_cell',
        value: '21.04.2026',
      },
      {
        key: 'fundingSource',
        label: 'Источник финансирования',
        section: 'Организация',
        cell: 'C15',
        mode: 'value_cell',
        value: 'Субсидии на иные цели',
        isCustom: true,
      },
    ],
  }

  const systemPrintable: PrintableDocument = {
    title: 'Табель',
    subtitle: 'Апрель 2026',
    html: '<table></table>',
    print_mode: 'embedded',
    editable_metadata: [
      {
        key: 'institution',
        label: 'Учреждение',
        section: 'Организация',
        cell: 'AQ7',
        mode: 'value_cell',
        value: 'МЦК - ЧЭМК Минобразования Чувашии',
        isCustom: false,
      },
    ],
  }

  it('returns backend-provided editable fields without frontend guessing', () => {
    const fields = detectAccountingDocumentMetadataSupport(printable)

    expect(fields.map((field) => field.key)).toEqual(['reportDate', 'fundingSource'])
  })

  it('resolves values directly from the document payload', () => {
    expect(resolveAccountingDocumentMetadata(printable)).toEqual({
      reportDate: '21.04.2026',
      fundingSource: 'Субсидии на иные цели',
    })
  })

  it('detects whether shared metadata overrides are present', () => {
    expect(hasCustomAccountingDocumentMetadata(printable)).toBe(true)
    expect(hasCustomAccountingDocumentMetadata(systemPrintable)).toBe(false)
  })

  it('returns null and false when a document has no editable metadata', () => {
    expect(resolveAccountingDocumentMetadata(null)).toBeNull()
    expect(detectAccountingDocumentMetadataSupport(null)).toEqual([])
    expect(hasCustomAccountingDocumentMetadata(null)).toBe(false)
  })
})
