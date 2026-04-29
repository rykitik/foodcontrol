export const ACCOUNTING_PRINT_STYLES = `
  .accounting-form-page {
    font-family: "Calibri", "Arial Narrow", Arial, sans-serif;
    color: #111111;
  }

  .accounting-form {
    width: 100%;
  }

  .accounting-form-head {
    margin-bottom: 6px;
    text-align: center;
  }

  .accounting-form-title,
  .accounting-statement-title {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
  }

  .accounting-form-period,
  .accounting-form-org,
  .accounting-statement-subtitle,
  .accounting-statement-period {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.2;
  }

  .accounting-form-period-link {
    color: #1d4ed8;
    text-decoration: underline;
    font-weight: 700;
  }

  .accounting-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .accounting-grid th,
  .accounting-grid td {
    border: 1px solid #111111;
    padding: 2px 3px;
    font-size: 10px;
    line-height: 1.15;
    vertical-align: middle;
  }

  .accounting-grid th {
    font-weight: 700;
  }

  .accounting-index-col,
  .accounting-index-cell {
    width: 28px;
    text-align: center;
  }

  .accounting-student-col,
  .accounting-student-cell,
  .accounting-statement-student-col {
    width: 245px;
  }

  .accounting-statement-group-col {
    width: 70px;
  }

  .accounting-statement-amount-col,
  .accounting-statement-amount,
  .accounting-row-total,
  .accounting-summary-total {
    width: 64px;
    text-align: center;
    font-weight: 700;
  }

  .accounting-side-col {
    width: 42px;
    text-align: center;
  }

  .accounting-side-col-price,
  .accounting-day-price {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    letter-spacing: 0.2px;
  }

  .accounting-day-number,
  .accounting-day-meal,
  .accounting-day-price,
  .accounting-day-cell,
  .accounting-total-cell {
    width: 24px;
    text-align: center;
    padding: 1px;
  }

  .accounting-day-cell {
    font-weight: 700;
    font-size: 10px;
  }

  .accounting-cell-note {
    margin-top: 2px;
    font-size: 9px;
  }

  .accounting-summary-row td {
    font-weight: 700;
  }

  .accounting-summary-label {
    text-align: center;
  }

  .accounting-form-footer,
  .accounting-signature-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .accounting-meal-sheet-footer {
    justify-content: center;
    margin-top: 8px;
    font-size: 11px;
  }

  .accounting-signature-line {
    flex: 1;
    min-width: 88px;
    border-bottom: 1px solid #111111;
    height: 12px;
  }

  .accounting-signatures-top,
  .accounting-signatures-bottom {
    display: grid;
    gap: 6px;
    font-size: 11px;
  }

  .accounting-signatures-top {
    max-width: 240px;
    margin-bottom: 10px;
  }

  .accounting-signatures-bottom {
    margin-top: 10px;
  }

  .accounting-statement-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 156px;
    gap: 10px;
    margin-bottom: 8px;
    align-items: start;
  }

  .accounting-statement-main {
    display: grid;
    gap: 3px;
  }

  .accounting-meta-line {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 8px;
    align-items: end;
    font-size: 10px;
  }

  .accounting-meta-line strong {
    display: block;
    min-height: 14px;
    border-bottom: 1px solid #111111;
    font-weight: 400;
  }

  .accounting-codes-box {
    border: 1px solid #111111;
    display: grid;
    gap: 0;
    font-size: 10px;
  }

  .accounting-codes-title {
    border-bottom: 1px solid #111111;
    text-align: center;
    font-weight: 700;
    padding: 3px 4px;
  }

  .accounting-codes-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 62px;
    border-bottom: 1px solid #111111;
  }

  .accounting-codes-row:last-child {
    border-bottom: 0;
  }

  .accounting-codes-row span,
  .accounting-codes-row strong {
    padding: 3px 4px;
    min-height: 18px;
    display: flex;
    align-items: center;
  }

  .accounting-codes-row strong {
    justify-content: center;
    border-left: 1px solid #111111;
  }

  .accounting-grid-cost-statement .accounting-index-col,
  .accounting-grid-cost-statement .accounting-index-cell {
    width: 38px;
  }

  .accounting-grid-cost-statement .accounting-statement-student-col {
    width: auto;
  }

  @media print {
    .accounting-form-page {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }

  .accounting-worksheet-page {
    display: block;
    width: 100%;
    overflow-x: auto;
  }

  .accounting-worksheet {
    display: block;
    width: var(--accounting-screen-width, auto);
    min-width: var(--accounting-screen-width, auto);
    overflow: visible;
    color: #111111;
  }

  .accounting-worksheet-table {
    width: 100%;
    min-width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    overflow: visible;
  }

  .accounting-worksheet-table col {
    width: var(--accounting-screen-col-width) !important;
  }

  .accounting-worksheet-table td {
    padding: 0;
    box-sizing: border-box;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
  }

  @media print {
    .accounting-worksheet-page {
      overflow: visible;
    }

    .accounting-worksheet {
      width: var(--accounting-print-width, auto) !important;
      min-width: var(--accounting-print-width, auto) !important;
    }

    .accounting-worksheet-table {
      width: 100% !important;
      min-width: 100% !important;
    }

    .accounting-worksheet-table col {
      width: var(--accounting-print-col-width) !important;
    }
  }
`
