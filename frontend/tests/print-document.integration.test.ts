import { describe, expect, it } from 'vitest'

import { buildPrintableHtml } from '@/utils/printDocument'

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

    expect(html).toContain('.ticket-print-grid--large')
    expect(html).toContain('.ticket-print-card--large')
    expect(html).toContain('height: 14mm;')
  })
})
