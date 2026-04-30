import { describe, expect, it, vi } from 'vitest'

import { buildPrintableHtml, printDocument } from '@/utils/printDocument'

describe('printDocument', () => {
  it('renders landscape social meal sheet styles in printable html', () => {
    const html = buildPrintableHtml({
      title: 'Итоговая ведомость питания',
      subtitle: 'Период: 01.04.2026 - 30.04.2026',
      page_orientation: 'landscape',
      html: `
        <section class="social-meal-sheet-page">
          <table class="report-table report-table-wide social-meal-sheet-table">
            <colgroup><col class="social-meal-sheet-day-column"></colgroup>
          </table>
        </section>
      `,
    })

    expect(html).toContain('@page { size: A4 landscape; margin: 6mm; }')
    expect(html).toContain('.social-meal-sheet-table col.social-meal-sheet-day-column { width: 15px; }')
  })

  it('renders large ticket preset styles in printable html', () => {
    const html = buildPrintableHtml({
      title: 'Лист талонов',
      subtitle: '04.2026',
      html: `
        <section class="social-print-page">
          <div class="ticket-print-grid ticket-print-grid--large">
            <article class="ticket-print-card ticket-print-card--large"></article>
          </div>
        </section>
      `,
    })

    expect(html).toContain('ticket-print-grid--large')
    expect(html).toContain('ticket-print-card--large')
    expect(html).toContain('height: 30mm;')
  })

  it('keeps accounting overflow cells visible in print styles', () => {
    const html = buildPrintableHtml({
      title: 'Accounting worksheet',
      print_mode: 'embedded',
      page_orientation: 'landscape',
      html: `
        <section class="accounting-worksheet-page">
          <div class="accounting-worksheet">
            <table class="accounting-worksheet-table">
              <tbody>
                <tr>
                  <td data-accounting-overflow="left"><span>MCK - CHEMK</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      `,
    })

    expect(html).toContain('@page { size: A4 landscape; margin: 5mm; }')
    expect(html).toContain('border-width: 0.15mm !important;')
    expect(html).toContain('.accounting-worksheet-table td[data-accounting-overflow] {')
    expect(html).toContain('overflow: visible !important;')
    expect(html).toContain("td[data-accounting-overflow='left'] > span")
    expect(html).toContain('right: 0 !important;')
    expect(html).toContain('width: max-content !important;')
  })

  it('prints accounting fallback with preview html geometry overrides', () => {
    const html = buildPrintableHtml(
      {
        title: 'Accounting worksheet',
        print_mode: 'embedded',
        page_orientation: 'landscape',
        html: `
          <section class="accounting-worksheet-page">
            <div class="accounting-worksheet">
              <table class="accounting-worksheet-table">
                <colgroup><col style="--accounting-screen-col-width:30mm;--accounting-print-col-width:20mm" /></colgroup>
                <tbody><tr style="--accounting-screen-row-height:6mm;--accounting-print-row-height:4mm"><td>A</td></tr></tbody>
              </table>
            </div>
          </section>
        `,
      },
      { accountingHtmlPrintMode: 'preview-html' },
    )

    expect(html).toContain('accounting-preview-html-print-body')
    expect(html).toContain('transform: scale(var(--accounting-print-scale, 1));')
    expect(html).toContain('width: var(--accounting-screen-col-width) !important;')
    expect(html).toContain('height: var(--accounting-screen-row-height) !important;')
    expect(html).toContain('font-size: var(--accounting-cell-font-size, inherit) !important;')
  })

  it('uses preview-html mode for HTML fallback print windows', () => {
    const writes: string[] = []
    const printWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => writes.push(html)),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
      requestAnimationFrame: undefined,
    } as unknown as Window
    vi.spyOn(window, 'open').mockReturnValue(printWindow)

    expect(
      printDocument({
        title: 'Accounting worksheet',
        print_mode: 'embedded',
        page_orientation: 'landscape',
        html: '<section class="accounting-worksheet-page"><div class="accounting-worksheet"></div></section>',
      }),
    ).toBe(true)

    expect(writes[0]).toContain('accounting-preview-html-print-body')
  })
})
