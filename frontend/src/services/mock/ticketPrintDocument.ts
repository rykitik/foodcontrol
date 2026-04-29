import type { Category, MealType, PrintableDocument, Ticket, TicketPrintPreset } from '@/types'

import type { MockDatabase } from './data'
import { readMockDb } from './store'

type TicketPrintVariant = {
  label: string
  meals: MealType[]
  code: string
}

const MONTH_NAMES = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? String(month).padStart(2, '0')} ${year}`
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}

function formatMoney(value: number | undefined): string {
  if (value === undefined) {
    return ''
  }

  if (Number.isInteger(value)) {
    return `${value} ₽`
  }

  return `${value.toFixed(2).replace('.', ',')} ₽`
}

function resolveCategory(ticket: Ticket, db: MockDatabase): Category | null {
  return db.categories.find((category) => category.id === ticket.category_id) ?? null
}

function resolveStudentGroup(ticket: Ticket, db: MockDatabase): string {
  return db.students.find((student) => student.id === ticket.student_id)?.group_name ?? ''
}

function resolveMealTypes(category: Category | null): MealType[] {
  if (!category) {
    return []
  }

  if (category.meal_types.length > 0) {
    return category.meal_types
  }

  return [
    ...(category.breakfast ? (['breakfast'] as const) : []),
    ...(category.lunch ? (['lunch'] as const) : []),
  ]
}

function buildTicketCode(ticket: Ticket, meals: MealType[]): string {
  const suffix = meals.length === 2 ? '-BL' : meals[0] === 'breakfast' ? '-B' : meals[0] === 'lunch' ? '-L' : ''
  const periodCode = `${ticket.start_date.split('-').join('')}${ticket.end_date.split('-').join('')}`
  const ticketCode = ticket.id.split('-').join('').slice(0, 10).toUpperCase()
  return `${ticket.qr_code}${suffix}-P${periodCode}-T${ticketCode}`
}

function buildTicketVariants(ticket: Ticket, db: MockDatabase): TicketPrintVariant[] {
  const mealTypes = resolveMealTypes(resolveCategory(ticket, db))

  if (mealTypes.includes('breakfast') && mealTypes.includes('lunch')) {
    return [
      { label: 'ЗАВТРАК + ОБЕД', meals: ['breakfast', 'lunch'], code: buildTicketCode(ticket, ['breakfast', 'lunch']) },
      { label: 'ЗАВТРАК', meals: ['breakfast'], code: buildTicketCode(ticket, ['breakfast']) },
      { label: 'ОБЕД', meals: ['lunch'], code: buildTicketCode(ticket, ['lunch']) },
    ]
  }

  if (mealTypes.includes('breakfast')) {
    return [{ label: 'ЗАВТРАК', meals: ['breakfast'], code: buildTicketCode(ticket, ['breakfast']) }]
  }

  if (mealTypes.includes('lunch')) {
    return [{ label: 'ОБЕД', meals: ['lunch'], code: buildTicketCode(ticket, ['lunch']) }]
  }

  return [{ label: 'ПИТАНИЕ', meals: [], code: buildTicketCode(ticket, []) }]
}

function buildPriceLabel(ticket: Ticket, db: MockDatabase, meals: MealType[]): string {
  const category = resolveCategory(ticket, db)
  if (!category || meals.length === 0) {
    return 'Питание'
  }

  return meals.map((meal) => formatMoney(category.meal_prices?.[meal])).filter(Boolean).join(' + ')
}

function renderMockBarcodeSvg(payload: string): string {
  const charCodes = Array.from(payload).map((char) => char.charCodeAt(0))
  let x = 3
  const bars: string[] = []

  charCodes.forEach((code, index) => {
    if (x >= 216) {
      return
    }

    const width = 0.8 + (code % 4) * 0.35
    const height = 28 + ((code + index) % 5) * 2
    const y = 4 + (38 - height) / 2
    bars.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" />`)
    x += width + 0.8 + (code % 3) * 0.35
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 42" preserveAspectRatio="none"><g fill="#000000">${bars.join('')}</g></svg>`
}

function renderTicketCard(ticket: Ticket, variant: TicketPrintVariant, position: number, total: number, printSize: TicketPrintPreset, db: MockDatabase): string {
  const priceLabel = buildPriceLabel(ticket, db, variant.meals)
  const period = `${formatDisplayDate(ticket.start_date)} — ${formatDisplayDate(ticket.end_date)}`
  const cardClass = printSize === 'large' ? 'ticket-print-card ticket-print-card--large' : 'ticket-print-card'

  return `
    <article class="${cardClass}">
      <div class="ticket-print-card-head">
        <div>
          <div class="ticket-print-card-title">${escapeHtml(variant.label)}</div>
          <div class="ticket-print-card-price">${escapeHtml(priceLabel)}</div>
        </div>
        <div class="ticket-print-card-sequence">${position} из ${total}</div>
      </div>
      <div class="ticket-print-person">
        <div class="ticket-print-student">${escapeHtml(ticket.student_name)}</div>
        <div class="ticket-print-group">${escapeHtml(resolveStudentGroup(ticket, db))}</div>
      </div>
      <div class="ticket-print-barcode-wrap">
        <div class="ticket-print-barcode ticket-print-barcode-single" data-scan-code="${escapeHtml(variant.code.split('-P', 1)[0] ?? variant.code)}" data-barcode-payload="${escapeHtml(variant.code)}">
          ${renderMockBarcodeSvg(variant.code)}
        </div>
      </div>
      <div class="ticket-print-period">${escapeHtml(period)}</div>
    </article>
  `
}

function renderTicketGrid(cards: string[], gridClass: string): string {
  const rows: string[] = []

  for (let index = 0; index < cards.length; index += 2) {
    const rightCard = cards[index + 1] ?? ''
    rows.push(`
      <tr class="ticket-print-row">
        <td class="ticket-print-cell">${cards[index]}</td>
        <td class="ticket-print-cell${rightCard ? '' : ' ticket-print-cell--empty'}">${rightCard}</td>
      </tr>
    `)
  }

  return `<table class="${gridClass}"><tbody>${rows.join('')}</tbody></table>`
}

export function buildTicketPrintDocument(
  title: string,
  subtitle: string,
  tickets: Ticket[],
  printSize: TicketPrintPreset = 'compact',
): PrintableDocument {
  const db = readMockDb()
  const month = tickets[0]?.month ?? Number(subtitle.slice(0, 2))
  const year = tickets[0]?.year ?? Number(subtitle.slice(-4))
  const periodLabel = Number.isFinite(month) && Number.isFinite(year) ? formatMonthYear(month, year) : subtitle
  const cards = tickets.flatMap((ticket) => {
    const variants = buildTicketVariants(ticket, db)
    return variants.map((variant, index) => renderTicketCard(ticket, variant, index + 1, variants.length, printSize, db))
  })
  const gridClass = printSize === 'large' ? 'ticket-print-grid ticket-print-grid--large' : 'ticket-print-grid ticket-print-grid--compact'

  return {
    title,
    subtitle: periodLabel,
    html: `
      <section class="report-page ticket-sheet-page">
        <header class="ticket-sheet-header">
          <div>
            <h1 class="ticket-sheet-title">Лист талонов на питание</h1>
            <p class="ticket-sheet-period">${escapeHtml(periodLabel)}</p>
          </div>
          <div class="ticket-sheet-stats">
            <span>Студентов: ${new Set(tickets.map((ticket) => ticket.student_id)).size}</span>
            <span>Талонов: ${cards.length}</span>
          </div>
        </header>
        ${
          cards.length
            ? renderTicketGrid(cards, gridClass)
            : '<div class="ticket-print-empty">На выбранный месяц нет активных талонов для печати.</div>'
        }
      </section>
    `.trim(),
  }
}
