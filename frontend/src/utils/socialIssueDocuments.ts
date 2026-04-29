import type { PrintableDocument, Student, Ticket } from '@/types'

import { buildPrintableHtml } from './printDocument'

function escapeHtml(value: string): string {
  return value
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;')
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) {
    return value
  }

  return `${day}.${month}.${year}`
}

function buildExcelHtml(title: string, sections: Array<{ heading: string; rows: string[][] }>) {
  const sectionHtml = sections
    .map(
      (section) => `
        <table border="1">
          <tr><th colspan="${Math.max(section.rows[0]?.length ?? 1, 1)}">${escapeHtml(section.heading)}</th></tr>
          ${section.rows
            .map(
              (row) => `
                <tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>
              `,
            )
            .join('')}
        </table>
        <br />
      `,
    )
    .join('')

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body>${sectionHtml}</body>
    </html>
  `.trim()
}

export function buildExcelTableBlob(title: string, sections: Array<{ heading: string; rows: string[][] }>): Blob {
  return new Blob([`\uFEFF${buildExcelHtml(title, sections)}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  })
}

function buildPrintableWorkbookHtml(document: PrintableDocument): string {
  const embeddedDocument: PrintableDocument =
    document.print_mode === 'embedded' ? document : { ...document, print_mode: 'embedded' }

  return buildPrintableHtml(embeddedDocument)
    .replace(
      '<html lang="ru">',
      '<html lang="ru" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">',
    )
    .replace(
      '<head>',
      '<head><meta name="ProgId" content="Excel.Sheet" /><meta name="Generator" content="Microsoft Excel 11" />',
    )
}

export function buildPrintableWorkbookBlob(document: PrintableDocument): Blob {
  return new Blob([`\uFEFF${buildPrintableWorkbookHtml(document)}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  })
}

export function buildStudentListDocument(params: {
  monthLabel: string
  buildingLabel: string
  categoryLabel: string
  students: Student[]
}): PrintableDocument {
  const rows = [...params.students]
    .sort((left, right) => {
      const byGroup = left.group_name.localeCompare(right.group_name, 'ru')
      if (byGroup !== 0) {
        return byGroup
      }

      return left.full_name.localeCompare(right.full_name, 'ru')
    })
    .map(
      (student, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="student-list-student-col">
            <strong>${escapeHtml(student.full_name)}</strong>
            <span>Код: ${escapeHtml(student.student_card)}</span>
          </td>
          <td>${escapeHtml(student.group_name)}</td>
          <td>${escapeHtml(student.category.name)}</td>
          <td>${escapeHtml(student.effective_meal_building_name || student.building_name || `Корпус ${student.building_id}`)}</td>
        </tr>
      `,
    )
    .join('')

  return {
    title: 'Список студентов',
    subtitle: params.monthLabel,
    print_mode: 'embedded',
    html: `
      <section class="report-page social-print-page student-list-page">
        <div class="doc-title">Список студентов</div>
        <div class="doc-subtitle">на питание за ${escapeHtml(params.monthLabel)}</div>
        <div class="student-list-summary">
          <div class="student-list-summary-card">
            <span>Корпус</span>
            <strong>${escapeHtml(params.buildingLabel)}</strong>
          </div>
          <div class="student-list-summary-card">
            <span>Категория</span>
            <strong>${escapeHtml(params.categoryLabel)}</strong>
          </div>
          <div class="student-list-summary-card">
            <span>Студентов</span>
            <strong>${params.students.length}</strong>
          </div>
        </div>
        <table class="report-table student-list-table">
          <thead>
            <tr>
              <th>№</th>
              <th>ФИО / код</th>
              <th>Группа</th>
              <th>Категория</th>
              <th>Корпус питания</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5">Нет студентов для выбранного периода.</td></tr>'}
          </tbody>
        </table>
      </section>
    `.trim(),
  }
}

export function buildTicketRegistryWorkbook(params: {
  monthLabel: string
  buildingLabel: string
  categoryLabel: string
  tickets: Ticket[]
}): Blob {
  const rows = [
    ['Студент', 'Категория', 'Период', 'Корпус питания', 'Статус'],
    ...params.tickets.map((ticket) => [
      ticket.student_name,
      ticket.category_name,
      `${formatDisplayDate(ticket.start_date)} - ${formatDisplayDate(ticket.end_date)}`,
      ticket.effective_meal_building_name || ticket.building_name || '—',
      ticket.status,
    ]),
  ]

  return buildExcelTableBlob(`Талоны ${params.monthLabel}`, [
    {
      heading: `Лист талонов | ${params.buildingLabel} | ${params.categoryLabel}`,
      rows,
    },
  ])
}

export function buildStudentsWorkbook(params: {
  monthLabel: string
  buildingLabel: string
  categoryLabel: string
  students: Student[]
}): Blob {
  return buildPrintableWorkbookBlob(buildStudentListDocument(params))
}

export function buildIssueSummaryWorkbook(document: PrintableDocument): Blob {
  return buildPrintableWorkbookBlob(document)
}
